import {
  DynamoDBClient,
  CreateTableCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function createTable(params: Parameters<typeof CreateTableCommand>[0]) {
  const tableName = params.TableName!;
  try {
    await client.send(new CreateTableCommand(params));
    console.log(`✓ Created table: ${tableName}`);
  } catch (err) {
    if (err instanceof ResourceInUseException) {
      console.log(`- Table already exists, skipping: ${tableName}`);
    } else {
      console.error(`✗ Failed to create table: ${tableName}`, err);
    }
  }
}

async function main() {
  await createTable({
    TableName: "fable-users",
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "userId", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  });

  await createTable({
    TableName: "fable-saved-recipes",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "recipeId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "recipeId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await createTable({
    TableName: "fable-collections",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "collectionId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "collectionId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await createTable({
    TableName: "fable-feedback",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "recipeId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "recipeId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await createTable({
    TableName: "fable-ingredient-insights",
    KeySchema: [
      { AttributeName: "allergenProfile", KeyType: "HASH" },
      { AttributeName: "timeWindow", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "allergenProfile", AttributeType: "S" },
      { AttributeName: "timeWindow", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  // Rate limiting: PK=userId, SK=windowKey (e.g. "hour#2026-06-04T15" or "day#2026-06-04")
  // TTL attribute name: "ttl" — enable TTL on this table in the AWS console after creation
  await createTable({
    TableName: "fable-rate-limits",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "windowKey", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "windowKey", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });
}

main();
