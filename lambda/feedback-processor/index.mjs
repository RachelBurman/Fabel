import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const defaultClient = new DynamoDBClient({ region: process.env.AWS_REGION_TARGET ?? "eu-west-2" });
const TABLE = process.env.FABLE_USERS_TABLE ?? "fable-users";

export async function handler(event, _ctx, client = defaultClient) {
  for (const record of event.Records) {
    try {
      await processRecord(record, client);
    } catch (err) {
      console.error("Failed to process record", { eventID: record.eventID, err });
    }
  }
}

async function processRecord(record, client) {
  if (record.eventName === "REMOVE") return;

  const image = record.dynamodb?.NewImage;
  if (!image) return;

  const item = unmarshall(image);
  const { userId, liked, recipeIngredients } = item;

  if (!userId || !Array.isArray(recipeIngredients) || recipeIngredients.length === 0) return;

  const likedBool = Boolean(liked);
  const timestamp = new Date().toISOString();

  const signals = recipeIngredients.map((ingredientKey) => ({
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
}
