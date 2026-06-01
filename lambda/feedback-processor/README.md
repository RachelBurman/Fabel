# fable-feedback-stream-processor

Lambda function that listens to the `fable-feedback` DynamoDB Stream and updates user preference profiles in `fable-users`.

## What it does

For each write to `fable-feedback`, the function:

1. Skips `REMOVE` events (deletions carry no preference signal).
2. Reads `userId`, `liked` (boolean), and `recipeIngredients` (string list) from the new image.
3. Writes one `preferenceSignals` entry per ingredient into `fable-users`, appending to the existing list.

Each signal entry looks like:

```json
{
  "ingredientKey": "cilantro",
  "liked": false,
  "timestamp": "2026-06-01T17:45:54.808Z"
}
```

Partial failures are non-fatal: if one record in a batch fails, the error is logged and processing continues.

## Infrastructure

| Resource | Value |
|---|---|
| Trigger table | `fable-feedback` |
| Stream ARN | `arn:aws:dynamodb:eu-west-2:546518615025:table/fable-feedback/stream/...` |
| IAM role | `arn:aws:iam::546518615025:role/fable-feedback-stream-processor` |
| Target table | `fable-users` |
| Runtime | `nodejs22.x` |
| Region | `eu-west-2` |

## Deploy

```bash
cd lambda/feedback-processor
bash deploy.sh
```

The script installs production dependencies, zips the bundle, then calls `create-function` on the first run and `update-function-code` on subsequent runs.

## Environment variables

Set these in the Lambda console (or via the deploy script):

| Variable | Value |
|---|---|
| `FABLE_USERS_TABLE` | `fable-users` |
| `AWS_REGION_TARGET` | `eu-west-2` |

## Manual test via Lambda console

Use the **Test** tab with the following event to simulate a single feedback write:

```json
{
  "Records": [
    {
      "eventName": "INSERT",
      "eventID": "test-001",
      "dynamodb": {
        "NewImage": {
          "userId":           { "S": "user-123" },
          "liked":            { "BOOL": true },
          "recipeIngredients": {
            "L": [
              { "S": "garlic" },
              { "S": "lemon" },
              { "S": "thyme" }
            ]
          }
        }
      }
    }
  ]
}
```

After running, check `fable-users` for `userId = user-123` and confirm three positive `preferenceSignals` entries were appended.
