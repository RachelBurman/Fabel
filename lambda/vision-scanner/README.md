# fable-vision-ingredient-scanner

AWS Lambda (Node 24.x, eu-west-2) triggered via API Gateway HTTP endpoint.

Receives a base64-encoded photo, calls Claude Vision (Haiku 4.5) to identify ingredients and infer storage area, fuzzy-matches results against the 1,790 Epicure keys, and returns a structured ingredient list.

## Endpoint

```
POST https://<api-gateway-url>/scan-ingredients
```

Body:
```json
{
  "image": "<base64 string>",
  "mediaType": "image/jpeg"
}
```

Response:
```json
{
  "inferredArea": "fridge",
  "areaConfident": true,
  "ingredients": [
    { "displayName": "chicken thighs", "epicureKey": "chicken", "confident": false },
    { "displayName": "garlic",         "epicureKey": "garlic",  "confident": true  }
  ]
}
```

`confident: false` when Claude flagged uncertainty OR when the fuzzy match score is below the high-confidence threshold (0.8). The Next.js review screen flags these rows with an Uncertain badge.

## Environment variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key — set in Lambda console or via `deploy.sh` |

## IAM

No DynamoDB permissions needed. The Lambda only calls the Anthropic API. Minimum required policy: allow outbound HTTPS.

## Deploy

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export VISION_SCANNER_ROLE_ARN=arn:aws:iam::546518615025:role/fable-vision-scanner
bash deploy.sh
```

Set `VISION_LAMBDA_URL` in Vercel environment variables to the API Gateway URL.

## Test

```bash
node index.test.mjs
```

## Files

- `index.mjs` — handler + Epicure key matching
- `ingredients.json` — bundled list of all 1,790 Epicure ingredient keys (generated from `data/epicure-core.json`)
