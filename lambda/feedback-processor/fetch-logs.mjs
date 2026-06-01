import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const client = new CloudWatchLogsClient({ region: "eu-west-2" });
const LOG_GROUP = "/aws/lambda/fable-feedback-processor";

const streams = await client.send(
  new DescribeLogStreamsCommand({
    logGroupName: LOG_GROUP,
    orderBy: "LastEventTime",
    descending: true,
    limit: 3,
  })
);

if (!streams.logStreams?.length) {
  console.log("No log streams found — function may not have been invoked yet.");
  process.exit(0);
}

for (const stream of streams.logStreams) {
  console.log(`\n=== Stream: ${stream.logStreamName} (last event: ${new Date(stream.lastEventTimestamp).toISOString()}) ===`);
  const events = await client.send(
    new GetLogEventsCommand({
      logGroupName: LOG_GROUP,
      logStreamName: stream.logStreamName,
      startFromHead: true,
    })
  );
  for (const e of events.events) {
    process.stdout.write(`[${new Date(e.timestamp).toISOString()}] ${e.message}`);
  }
}
