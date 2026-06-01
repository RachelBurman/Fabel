import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const TABLE = process.env.FABLE_USERS_TABLE ?? "fable-users";

// Lazily initialised so Lambda container env vars are fully resolved before first use
let _client;
function getClient() {
  if (!_client) {
    _client = new DynamoDBClient({ region: process.env.AWS_REGION_TARGET ?? "eu-west-2" });
    console.log("DynamoDB client initialised, region:", process.env.AWS_REGION_TARGET ?? "eu-west-2");
  }
  return _client;
}

export async function handler(event, _ctx, _testClient) {
  // Lambda passes (event, context, callback) — _testClient would receive the callback
  // function in production. Guard with a duck-type check so only real injected clients
  // (with a .send method) override the default; Lambda's callback is ignored.
  const client = (typeof _testClient?.send === "function") ? _testClient : getClient();
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

  const { userId, liked, recipeIngredients } = item;

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
        "SET preferenceSignals = list_append(if_not_exists(preferenceSignals, :empty), :signals)",
      ExpressionAttributeValues: {
        ":signals": { L: signals },
        ":empty": { L: [] },
      },
    })
  );

  console.log(`Successfully wrote ${ingredientList.length} signal(s) for userId=${userId}`);
}
