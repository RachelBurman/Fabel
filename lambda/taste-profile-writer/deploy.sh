#!/usr/bin/env bash
# Deploy fable-taste-profile-writer to AWS Lambda (eu-west-2).
# The function, EventBridge schedule, and GSI are assumed to already exist.
# Usage: bash deploy.sh   (run from this directory; AWS credentials must be set)
set -euo pipefail

FUNCTION_NAME="fable-taste-profile-writer"
REGION="eu-west-2"
ZIPFILE="function.zip"

cd "$(dirname "$0")"

echo "Installing production dependencies..."
npm install --omit=dev

echo "Building zip..."
# AWS SDK v3 is provided by the nodejs24.x runtime — only @anthropic-ai/sdk needs bundling
powershell -Command "Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath $ZIPFILE -Force"

echo "Updating function code..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$ZIPFILE" \
  --region "$REGION" \
  --query "{CodeSize:CodeSize,LastModified:LastModified}"

echo "Waiting for code update..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

echo "Updating configuration..."
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --timeout 300 \
  --environment "Variables={FABLE_USERS_TABLE=fable-users,FABLE_FEEDBACK_TABLE=fable-feedback,ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY}"

echo "Waiting for config update..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

echo "Verifying..."
aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query "{State:State,Runtime:Runtime,Handler:Handler,Timeout:Timeout,LastModified:LastModified}"

echo "Done."
