#!/usr/bin/env bash
set -euo pipefail

FUNCTION_NAME="fable-vision-ingredient-scanner"
REGION="eu-west-2"
HANDLER="index.handler"
RUNTIME="nodejs24.x"
ZIPFILE="function.zip"

# Role must be created in IAM before first deploy.
# This Lambda only calls Claude (Anthropic API) — no DynamoDB permissions needed.
ROLE_ARN="${VISION_SCANNER_ROLE_ARN:?Set VISION_SCANNER_ROLE_ARN}"

cd "$(dirname "$0")"

echo "Installing dependencies..."
npm install --omit=dev

echo "Zipping..."
zip -r "$ZIPFILE" . --exclude "*.zip" --exclude "*.test.mjs" --exclude "deploy.sh" --exclude "node_modules/.bin/*"

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" > /dev/null 2>&1; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIPFILE" \
    --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY}}" \
    --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file "fileb://$ZIPFILE" \
    --environment "Variables={ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY}}" \
    --region "$REGION"

  echo "Adding API Gateway trigger..."
  echo "Create an HTTP API Gateway pointing to this Lambda and set the URL in VISION_LAMBDA_URL."
fi

echo "Done."
