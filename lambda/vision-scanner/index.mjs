import Anthropic from "@anthropic-ai/sdk";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const allIngredientKeys = require("./ingredients.json");

const VISION_PROMPT = `You are analysing a photo of food or a kitchen to identify ingredients for a recipe app.

First, identify where the food is located. Look for visual cues:
- Fridge: shelves, interior lighting, fresh produce, dairy, meat
- Freezer: frost, frozen packaging, ice
- Cupboard: dry goods, tins, packets, wooden shelves
- Pantry: similar to cupboard but larger, more variety
- If food is on a counter, table, or the context is unclear, use "unknown"

Then list every food ingredient you can see. For each ingredient:
- Use the singular form of the name (e.g. "egg" not "eggs", "apple" not "apples")
- Keep names simple and generic (e.g. "egg", "cheddar cheese", "olive oil")
- Note if you are uncertain about what it is

Return ONLY valid JSON in this exact format:
{
  "area": "fridge" | "freezer" | "cupboard" | "pantry" | "unknown",
  "areaConfident": true | false,
  "ingredients": [
    { "name": "egg", "uncertain": false },
    { "name": "something yellow, possibly butter or cheese", "uncertain": true }
  ]
}`;

let _client;
function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function handler(event) {
  return handlerWithClient(event, getClient());
}

export async function handlerWithClient(event, client) {
  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return response(400, { error: "Invalid JSON" });
  }

  const { image, mediaType } = body;
  if (!image || typeof image !== "string") {
    return response(400, { error: "Missing image" });
  }
  const resolvedType = typeof mediaType === "string" ? mediaType : "image/jpeg";

  let visionData;
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: resolvedType, data: image },
            },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return response(502, { error: "No text response from Claude" });
    }

    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    visionData = JSON.parse(raw);
  } catch (err) {
    console.error("[vision-scanner] Claude call failed:", err);
    return response(502, { error: "Vision analysis failed" });
  }

  const validAreas = ["fridge", "freezer", "cupboard", "pantry"];
  const inferredArea = validAreas.includes(visionData.area) ? visionData.area : "unknown";

  const matched = (visionData.ingredients ?? [])
    .map((ing) => {
      if (!ing?.name || typeof ing.name !== "string") return null;
      const result = matchToEpicureKey(ing.name, !!ing.uncertain, allIngredientKeys);
      if (!result) return null;
      return {
        displayName: ing.name,
        epicureKey: result.epicureKey,
        confident: result.confident,
      };
    })
    .filter(Boolean);

  return response(200, {
    inferredArea,
    areaConfident: visionData.areaConfident === true,
    ingredients: matched,
  });
}

/**
 * Match a Claude ingredient name to the closest Epicure key.
 * Returns null when no adequate match is found.
 */
export function matchToEpicureKey(name, uncertain, keys) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const asKey = normalized.replace(/\s+/g, "_");

  if (keys.includes(asKey)) {
    return { epicureKey: asKey, confident: !uncertain };
  }

  // Try stripping a trailing 's' (e.g. "eggs" → "egg", "carrots" → "carrot")
  if (asKey.endsWith("s")) {
    const singular = asKey.slice(0, -1);
    if (keys.includes(singular)) {
      return { epicureKey: singular, confident: !uncertain };
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);

  // Longest prefix match
  for (let len = tokens.length; len >= 1; len--) {
    const candidate = tokens.slice(0, len).join("_");
    if (keys.includes(candidate)) {
      const matchRatio = len / tokens.length;
      return { epicureKey: candidate, confident: !uncertain && matchRatio >= 0.8 };
    }
  }

  // Token overlap scoring
  let bestKey = null;
  let bestScore = 0;

  for (const key of keys) {
    const keyTokens = new Set(key.split("_"));
    const overlap = tokens.filter((t) => keyTokens.has(t)).length;
    const score = overlap / Math.max(tokens.length, keyTokens.size);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  if (bestKey && bestScore >= 0.4) {
    return { epicureKey: bestKey, confident: !uncertain && bestScore >= 0.8 };
  }

  return null;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}
