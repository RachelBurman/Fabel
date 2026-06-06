#!/usr/bin/env bash
set -euo pipefail

FUNCTION_NAME="fable-barcode-scanner"
REGION="eu-west-2"
HANDLER="index.handler"
RUNTIME="nodejs24.x"
ZIPFILE="function.zip"

# Role must be created in IAM before first deploy.
# This Lambda calls Open Food Facts only — no DynamoDB or Anthropic permissions needed.
ROLE_ARN="${BARCODE_SCANNER_ROLE_ARN:?Set BARCODE_SCANNER_ROLE_ARN}"

cd "$(dirname "$0")"

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
    --timeout 10 \
    --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --role "$ROLE_ARN" \
    --timeout 10 \
    --zip-file "fileb://$ZIPFILE" \
    --region "$REGION"

  echo "Adding API Gateway trigger..."
  echo "Add POST /scan-barcode route to the fable-vision-api HTTP API Gateway and set the URL in BARCODE_LAMBDA_URL."
fi

echo "Done."
