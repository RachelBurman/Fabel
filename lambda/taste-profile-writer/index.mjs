/**
 * fable-taste-profile-writer
 *
 * Scheduled Lambda (EventBridge, every 6 hours) that finds users whose taste
 * profile needs recomputing, runs a drift-aware preference analysis over their
 * full feedback history, calls Claude Haiku to generate proactive recipe
 * direction suggestions, and writes a structured tasteProfile object back to
 * fable-users.
 *
 * NOTE: Without the needsRecompute-lastComputedAt-index GSI this handler would
 * require a full table scan of fable-users — not viable at scale. The GSI
 * (PK: needsRecompute String, SK: lastComputedAt String) is the query entry
 * point. The fable-feedback-stream-processor sets needsRecompute = "true" and
 * initialises lastComputedAt = "1970-01-01T00:00:00Z" on every feedback write,
 * ensuring every eligible user is visible to this query.
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY   — Anthropic API key (set in Lambda configuration)
 *   FABLE_USERS_TABLE   — defaults to "fable-users"
 *   FABLE_FEEDBACK_TABLE— defaults to "fable-feedback"
 *   AWS_REGION          — defaults to "eu-west-2"
 */

import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import Anthropic from "@anthropic-ai/sdk";

const USERS_TABLE = process.env.FABLE_USERS_TABLE ?? "fable-users";
const FEEDBACK_TABLE = process.env.FABLE_FEEDBACK_TABLE ?? "fable-feedback";
const GSI_NAME = "needsRecompute-lastComputedAt-index";
const STALE_HOURS = 6;
const MAX_USERS_PER_RUN = 25;

const HAIKU_SYSTEM =
  "You are Fable's culinary intelligence. Analyse a user's taste profile and generate 2-3 recipe direction suggestions for flavour territory they haven't explored yet but would love based on their history. Respond with a valid JSON array and nothing else. No markdown, no preamble.";

// ─── Client factories ─────────────────────────────────────────────────────────

let _dbClient;
let _anthropicClient;

function getDbClient() {
  if (!_dbClient) {
    _dbClient = new DynamoDBClient({
      region: process.env.AWS_REGION ?? "eu-west-2",
    });
  }
  return _dbClient;
}

function getAnthropicClient() {
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic();
  }
  return _anthropicClient;
}

// ─── Entry points ─────────────────────────────────────────────────────────────

export async function handler(event) {
  return handlerWithClients(event, getDbClient(), getAnthropicClient());
}

export async function handlerWithClients(event, dbClient, anthropicClient) {
  const threshold = new Date(
    Date.now() - STALE_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Query GSI for users needing recompute whose profile is older than threshold.
  // needsRecompute = "true" (String) is set by fable-feedback-stream-processor
  // on every feedback write; this query is the only way to find eligible users
  // without scanning the entire fable-users table.
  let gsiItems = [];
  try {
    const result = await dbClient.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: GSI_NAME,
        KeyConditionExpression:
          "needsRecompute = :nr AND lastComputedAt < :threshold",
        ExpressionAttributeValues: marshall({
          ":nr": "true",
          ":threshold": threshold,
        }),
        Limit: MAX_USERS_PER_RUN,
      })
    );
    gsiItems = (result.Items ?? []).map((item) => unmarshall(item));
  } catch (err) {
    console.error("GSI query failed:", err?.message ?? err);
    return { processed: 0, error: "GSI query failed" };
  }

  console.log(
    `Found ${gsiItems.length} user(s) eligible for taste profile recompute`
  );

  let processed = 0;
  for (const user of gsiItems) {
    try {
      await processUser(user.userId, dbClient, anthropicClient);
      processed++;
    } catch (err) {
      console.error(
        `Failed to process userId=${user.userId}:`,
        err?.message ?? err
      );
    }
  }

  console.log(`Completed: ${processed}/${gsiItems.length} user(s) processed`);
  return { processed };
}

// ─── Per-user processing ──────────────────────────────────────────────────────

async function processUser(userId, dbClient, anthropicClient) {
  const feedbackResult = await dbClient.send(
    new QueryCommand({
      TableName: FEEDBACK_TABLE,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: marshall({ ":uid": userId }),
    })
  );

  const records = (feedbackResult.Items ?? [])
    .map((item) => unmarshall(item))
    .sort((a, b) =>
      (b.timestamp ?? "").localeCompare(a.timestamp ?? "")
    );

  // Clear the flag even if there's not enough data — avoids re-querying
  // the same user on every run when they're below threshold.
  if (records.length < 3) {
    console.log(
      `userId=${userId}: ${records.length} record(s) — below threshold, clearing flag`
    );
    await clearNeedsRecompute(userId, dbClient);
    return;
  }

  const profile = computeDriftAwareProfile(records);
  const formatSignals = aggregateFormatSignals(records);
  const recipeSuggestions = await generateRecipeSuggestions(
    profile,
    formatSignals,
    anthropicClient
  );

  const now = new Date().toISOString();
  const tasteProfile = {
    preferred: profile.preferred,
    avoided: profile.avoided,
    emerging: profile.emerging,
    fading: profile.fading,
    formatSignals,
    strength: profile.strength,
    signalCount: records.length,
    recipeSuggestions,
    lastComputedAt: now,
  };

  await dbClient.send(
    new UpdateItemCommand({
      TableName: USERS_TABLE,
      Key: marshall({ userId }),
      UpdateExpression:
        "SET tasteProfile = :tp, lastComputedAt = :lca REMOVE needsRecompute",
      ExpressionAttributeValues: marshall({ ":tp": tasteProfile, ":lca": now }),
    })
  );

  console.log(
    `userId=${userId}: wrote tasteProfile (${recipeSuggestions.length} suggestion(s), strength=${profile.strength})`
  );
}

async function clearNeedsRecompute(userId, dbClient) {
  await dbClient.send(
    new UpdateItemCommand({
      TableName: USERS_TABLE,
      Key: marshall({ userId }),
      UpdateExpression: "REMOVE needsRecompute",
    })
  );
}

// ─── Preference computation (mirrors lib/feedback-preferences.ts) ─────────────

function computePreferenceProfile(records) {
  if (records.length < 3) {
    return { preferred: [], avoided: [], scores: {}, strength: "none" };
  }

  const strength = records.length >= 10 ? "full" : "soft";
  const likeCounts = {};
  const dislikeCounts = {};

  for (const record of records) {
    const ings = (record.recipeIngredients ?? []).filter(
      (s) => typeof s === "string" && s.trim().length > 0
    );
    for (const ing of ings) {
      const key = ing.toLowerCase().trim();
      if (record.liked) {
        likeCounts[key] = (likeCounts[key] ?? 0) + 1;
      } else {
        dislikeCounts[key] = (dislikeCounts[key] ?? 0) + 1;
      }
    }
  }

  const allKeys = new Set([
    ...Object.keys(likeCounts),
    ...Object.keys(dislikeCounts),
  ]);
  const scores = {};

  for (const key of allKeys) {
    const likes = likeCounts[key] ?? 0;
    const dislikes = dislikeCounts[key] ?? 0;
    const total = likes + dislikes;
    if (total < 2) continue;
    const score = (likes - dislikes) / total;
    if (score === 0) continue;
    scores[key] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const preferred = sorted
    .filter(([, s]) => s > 0)
    .slice(0, 5)
    .map(([k]) => k);
  const avoided = [...sorted]
    .reverse()
    .filter(([, s]) => s < 0)
    .slice(0, 5)
    .map(([k]) => k);

  return { preferred, avoided, scores, strength };
}

// ─── Drift detection (mirrors lib/drift-profile.ts) ──────────────────────────

function computeDriftAwareProfile(records) {
  const allTime = computePreferenceProfile(records);

  if (allTime.strength === "none") {
    return {
      preferred: [],
      avoided: [],
      scores: {},
      emerging: [],
      fading: [],
      strength: "none",
      signalCount: records.length,
    };
  }

  // Records are pre-sorted descending — slice gives the most recent 10
  const recentRecords = records.slice(0, 10);
  const recent = computePreferenceProfile(recentRecords);

  const allTimePreferredSet = new Set(allTime.preferred);
  const recentPreferredSet = new Set(recent.preferred);

  const emerging = recent.preferred.filter((k) => !allTimePreferredSet.has(k));
  const fading = allTime.preferred.filter((k) => !recentPreferredSet.has(k));

  return {
    preferred: allTime.preferred,
    avoided: allTime.avoided,
    scores: allTime.scores,
    emerging,
    fading,
    strength: allTime.strength,
    signalCount: records.length,
  };
}

// ─── Format signal aggregation (mirrors lib/preference-profile.ts) ────────────

function aggregateFormatSignals(records) {
  const counts = {};
  for (const record of records) {
    const survey = record.surveyResponse;
    if (!survey) continue;
    const signals = [
      ...(survey.recipePositives ?? []),
      ...(survey.recipeNegatives ?? []),
    ];
    for (const signal of signals) {
      counts[signal] = (counts[signal] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([signal]) => signal);
}

// ─── Claude Haiku — recipe direction suggestions ──────────────────────────────

async function generateRecipeSuggestions(profile, formatSignals, anthropicClient) {
  try {
    const { preferred, avoided, emerging, fading } = profile;

    const userMessage =
      `Taste profile:\n` +
      `- Preferred: ${preferred.join(", ") || "not enough data yet"}\n` +
      `- Avoided: ${avoided.join(", ") || "none"}\n` +
      `- Emerging interests: ${emerging.join(", ") || "none"}\n` +
      `- Fading interests: ${fading.join(", ") || "none"}\n` +
      `- Format preferences: ${formatSignals.join(", ") || "none"}\n\n` +
      `Generate 2-3 recipe directions for flavour territory this user hasn't visited but would love. ` +
      `Avoid directions that closely mirror their emerging interests — those are already developing. ` +
      `Be specific — name a dish direction, not just a cuisine.\n\n` +
      `Respond as a JSON array:\n` +
      `[\n` +
      `  {\n` +
      `    "direction": "One sentence naming the dish direction",\n` +
      `    "reasoning": "One or two sentences. Warm, direct, like a knowledgeable friend. Reference their specific profile.",\n` +
      `    "noveltyNote": "One short phrase e.g. \\'First time in North African territory\\'"\n` +
      `  }\n` +
      `]`;

    const message = await anthropicClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: HAIKU_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock) return [];

    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    return JSON.parse(raw);
  } catch (err) {
    console.error(
      "Non-fatal: failed to generate recipe suggestions:",
      err?.message ?? err
    );
    return [];
  }
}
