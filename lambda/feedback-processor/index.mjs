import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

const TABLE = process.env.FABLE_USERS_TABLE ?? "fable-users";
const INSIGHTS_TABLE = process.env.FABLE_INSIGHTS_TABLE ?? "fable-ingredient-insights";

// Lazily initialised so Lambda container env vars are fully resolved before first use
let _client;
function getClient() {
  if (!_client) {
    _client = new DynamoDBClient({ region: process.env.AWS_REGION_TARGET ?? "eu-west-2" });
    console.log("DynamoDB client initialised, region:", process.env.AWS_REGION_TARGET ?? "eu-west-2");
  }
  return _client;
}

export async function handler(event) {
  return handlerWithClient(event, getClient());
}

// Exported for testing only — allows a stub client to be injected without
// touching the production handler signature.
export async function handlerWithClient(event, client) {
  console.log(`Processing batch of ${event.Records.length} record(s), client type: ${client?.constructor?.name}`);
  for (const record of event.Records) {
    console.log("Raw record:", JSON.stringify(record));
    try {
      await processRecord(record, client);
    } catch (err) {
      console.error("Failed to process record", { eventID: record.eventID, err });
    }
  }
}

async function processRecord(record, client) {
  if (record.eventName === "REMOVE") {
    console.log(`Skipping REMOVE event (eventID: ${record.eventID})`);
    return;
  }

  const image = record.dynamodb?.NewImage;
  if (!image) {
    console.log(`Skipping record — no NewImage (eventID: ${record.eventID})`);
    return;
  }

  const item = unmarshall(image);
  console.log("Unmarshalled item:", JSON.stringify(item));
  console.log("recipeIngredients type:", typeof item.recipeIngredients, Array.isArray(item.recipeIngredients) ? "Array" : item.recipeIngredients instanceof Set ? "Set" : "other");

  const { userId, liked, recipeIngredients, allergenProfile } = item;

  if (!userId) {
    console.log(`Skipping record — missing userId (eventID: ${record.eventID})`);
    return;
  }

  // recipeIngredients may be a JS Set (DynamoDB SS type) or an Array (DynamoDB L type)
  const ingredientList = Array.isArray(recipeIngredients)
    ? recipeIngredients
    : recipeIngredients instanceof Set
    ? [...recipeIngredients]
    : null;

  if (!ingredientList || ingredientList.length === 0) {
    console.log(`Skipping record — missing or empty recipeIngredients (userId: ${userId}, type: ${typeof recipeIngredients})`);
    return;
  }

  const likedBool = Boolean(liked);
  const timestamp = new Date().toISOString();

  console.log(`Writing ${ingredientList.length} signal(s) for userId=${userId}, liked=${likedBool}`);

  const signals = ingredientList.map((ingredientKey) => ({
    M: {
      ingredientKey: { S: String(ingredientKey) },
      liked: { BOOL: likedBool },
      timestamp: { S: timestamp },
    },
  }));

  await client.send(
    new UpdateItemCommand({
      TableName: TABLE,
      Key: { userId: { S: String(userId) } },
      UpdateExpression:
        "SET preferenceSignals = list_append(if_not_exists(preferenceSignals, :empty), :signals), needsRecompute = :nr, lastComputedAt = if_not_exists(lastComputedAt, :epoch)",
      ExpressionAttributeValues: {
        ":signals": { L: signals },
        ":empty": { L: [] },
        ":nr": { S: "true" },
        ":epoch": { S: "1970-01-01T00:00:00Z" },
      },
    })
  );

  console.log(`Successfully wrote ${ingredientList.length} signal(s) for userId=${userId}`);

  // Non-fatal: update ingredient insights for liked recipes only
  if (likedBool) {
    const profileKey = allergenProfile ?? "global";
    const weekStr = getISOWeekString();
    try {
      await updateInsights(client, profileKey, ingredientList, weekStr);
      // Also update all-time aggregate
      await updateInsights(client, profileKey, ingredientList, "all-time");
      console.log(`Updated insights for profile=${profileKey}, week=${weekStr}`);
    } catch (err) {
      console.error("Non-fatal: failed to update ingredient insights", err?.message ?? err);
    }
  }
}

// Safe Foods Mode placeholder strings — never count as real trending ingredients
const PLACEHOLDER_INGREDIENTS = new Set(['liquid of choice', 'seasoning of choice'])

async function updateInsights(client, allergenProfile, ingredientList, timeWindow) {
  // Read existing record
  let existing = { trendingIngredients: [], trendingPairings: [], trendingRecipeTypes: [] };
  try {
    const result = await client.send(
      new GetItemCommand({
        TableName: INSIGHTS_TABLE,
        Key: {
          allergenProfile: { S: allergenProfile },
          timeWindow: { S: timeWindow },
        },
      })
    );
    if (result.Item) {
      existing = unmarshall(result.Item);
    }
  } catch (err) {
    console.warn("Could not fetch existing insights record:", err?.message ?? err);
  }

  // Merge ingredient likes into the trending list
  const ingredientsMap = new Map(
    (existing.trendingIngredients ?? []).map((i) => [i.key, i])
  );
  for (const key of ingredientList.filter((k) => !PLACEHOLDER_INGREDIENTS.has(String(k).toLowerCase()))) {
    const current = ingredientsMap.get(key) ?? { key, likeCount: 0, score: 0.6 };
    const newLikeCount = current.likeCount + 1;
    const newScore = Math.round(Math.min(0.95, 0.6 + (newLikeCount - 1) * 0.05) * 100) / 100;
    ingredientsMap.set(key, { key, likeCount: newLikeCount, score: newScore });
  }

  const updatedIngredients = Array.from(ingredientsMap.values())
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 20);

  await client.send(
    new PutItemCommand({
      TableName: INSIGHTS_TABLE,
      Item: marshall({
        allergenProfile,
        timeWindow,
        trendingIngredients: updatedIngredients,
        trendingPairings: existing.trendingPairings ?? [],
        trendingRecipeTypes: existing.trendingRecipeTypes ?? [],
        lastUpdated: new Date().toISOString(),
      }),
    })
  );
}

function getISOWeekString(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
