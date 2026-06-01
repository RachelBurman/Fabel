import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const REGION = "eu-west-2";
const FUNCTION_NAME = "fable-feedback-stream-processor";
const LOG_GROUP = "/aws/lambda/fable-feedback-stream-processor";

// Test event shaped exactly like a real DynamoDB Stream record from fable-feedback
const testEvent = {
  Records: [
    {
      eventName: "INSERT",
      eventID: "test-invoke-001",
      dynamodb: {
        NewImage: {
          userId:             { S: "test-user-debug-001" },
          recipeId:           { S: "recipe-abc123" },
          liked:              { BOOL: false },
          recipeTitle:        { S: "Garlic Chicken" },
          timestamp:          { S: new Date().toISOString() },
          recipeIngredients:  { L: [{ S: "chicken" }, { S: "garlic" }, { S: "lemon" }] },
        },
      },
    },
  ],
};

const lambda = new LambdaClient({ region: REGION });
console.log("Invoking Lambda with test event...");
const response = await lambda.send(
  new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    Payload: JSON.stringify(testEvent),
    LogType: "Tail", // returns last 4KB of logs inline
  })
);

const status = response.StatusCode;
const logResult = response.LogResult
  ? Buffer.from(response.LogResult, "base64").toString("utf-8")
  : "(no inline logs)";
const payload = response.Payload ? Buffer.from(response.Payload).toString("utf-8") : "";
const fnError = response.FunctionError;

console.log(`\nStatus: ${status}${fnError ? `  FunctionError: ${fnError}` : ""}`);
if (payload) console.log("Response payload:", payload);
console.log("\n--- Inline log tail ---");
console.log(logResult);

// Also pull from CloudWatch for the full picture
console.log("\n--- Fetching CloudWatch log stream ---");
await new Promise((r) => setTimeout(r, 2000)); // brief wait for logs to flush

const logs = new CloudWatchLogsClient({ region: REGION });
const streams = await logs.send(
  new DescribeLogStreamsCommand({
    logGroupName: LOG_GROUP,
    orderBy: "LastEventTime",
    descending: true,
    limit: 1,
  })
);

if (streams.logStreams?.length) {
  const events = await logs.send(
    new GetLogEventsCommand({
      logGroupName: LOG_GROUP,
      logStreamName: streams.logStreams[0].logStreamName,
      startFromHead: true,
    })
  );
  for (const e of events.events) {
    process.stdout.write(`[${new Date(e.timestamp).toISOString()}] ${e.message}`);
  }
} else {
  console.log("No log streams found yet.");
}
