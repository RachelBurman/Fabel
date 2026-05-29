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
}

main();
