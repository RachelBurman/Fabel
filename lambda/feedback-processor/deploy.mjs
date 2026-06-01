import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import { readFileSync } from "node:fs";

const FUNCTION_NAME = "fable-feedback-processor";
const REGION = "eu-west-2";
const ROLE_ARN = "arn:aws:iam::546518615025:role/fable-feedback-stream-processor";
const HANDLER = "index.handler";
const RUNTIME = "nodejs22.x";
const ENV_VARS = {
  FABLE_USERS_TABLE: "fable-users",
  AWS_REGION_TARGET: "eu-west-2",
};

const client = new LambdaClient({ region: REGION });

const zipBytes = readFileSync("deploy-package.zip");

// Check whether the function already exists
let exists = false;
try {
  await client.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
  exists = true;
} catch (err) {
  if (err.name !== "ResourceNotFoundException") throw err;
}

if (exists) {
  console.log("Function exists — updating code...");
  await client.send(
    new UpdateFunctionCodeCommand({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBytes,
    })
  );
  console.log("Waiting for function to be ready before updating config...");
  await waitForActive();
  console.log("Updating configuration and env vars...");
  await client.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: FUNCTION_NAME,
      Environment: { Variables: ENV_VARS },
    })
  );
} else {
  console.log("Function not found — creating...");
  await client.send(
    new CreateFunctionCommand({
      FunctionName: FUNCTION_NAME,
      Runtime: RUNTIME,
      Handler: HANDLER,
      Role: ROLE_ARN,
      Code: { ZipFile: zipBytes },
      Environment: { Variables: ENV_VARS },
    })
  );
}

// Wait for the function to be Active before verifying
async function waitForActive(maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const r = await client.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    const { State, LastUpdateStatus } = r.Configuration;
    if (State === "Active" && LastUpdateStatus !== "InProgress") return;
    console.log(`  State: ${State}, LastUpdateStatus: ${LastUpdateStatus} — waiting...`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("Timed out waiting for function to become ready");
}
await waitForActive();

// Verify
const result = await client.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
console.log("\nDeployment verified:");
console.log("  FunctionArn:  ", result.Configuration.FunctionArn);
console.log("  Runtime:      ", result.Configuration.Runtime);
console.log("  Handler:      ", result.Configuration.Handler);
console.log("  State:        ", result.Configuration.State);
console.log("  LastModified: ", result.Configuration.LastModified);
console.log("  Env vars:     ", JSON.stringify(result.Configuration.Environment?.Variables));
