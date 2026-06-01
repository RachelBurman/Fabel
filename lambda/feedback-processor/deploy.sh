#!/usr/bin/env bash
set -euo pipefail

FUNCTION_NAME="fable-feedback-stream-processor"
ROLE_ARN="arn:aws:iam::546518615025:role/fable-feedback-stream-processor"
REGION="eu-west-2"
HANDLER="index.handler"
RUNTIME="nodejs22.x"
ZIPFILE="function.zip"

cd "$(dirname "$0")"

echo "Installing dependencies..."
npm install --omit=dev

echo "Zipping..."
zip -r "$ZIPFILE" . --exclude "*.zip" --exclude "*.test.mjs" --exclude "deploy.sh"

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" > /dev/null 2>&1; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIPFILE" \
    --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={FABLE_USERS_TABLE=fable-users,AWS_REGION_TARGET=eu-west-2}" \
    --region "$REGION"
else
  echo "Creating function for the first time..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file "fileb://$ZIPFILE" \
    --environment "Variables={FABLE_USERS_TABLE=fable-users,AWS_REGION_TARGET=eu-west-2}" \
    --region "$REGION"
fi

echo "Done."
