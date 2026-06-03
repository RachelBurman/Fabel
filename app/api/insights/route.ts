import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { getInsightProfileKey, getISOWeekString } from "@/lib/insight-profile";
import { type IngredientInsightsRecord } from "@/lib/types";
import { buildPreferenceProfile } from "@/lib/preference-profile";
import { deriveFlavourTerritory } from "@/lib/flavour-territory";
import { getEpicureVectors } from "@/lib/epicure";

// Cache responses for 1 hour — insights don't need to be real-time
export const revalidate = 3600;

// Map a Claude-generated ingredient name to the nearest Epicure key.
// Claude writes verbose descriptions ("lamb shoulder or leg, cut into 2cm cubes");
// the Epicure vector map uses simple keys ("lamb", "soy_sauce").
// Strategy: (1) normalize spaces to underscores and try direct lookup,
// (2) strip punctuation and try each token left-to-right.
function resolveToEpicureKey(
  name: string,
  vectors: Record<string, number[]>
): string | null {
  const normalized = name.replace(/\s+/g, "_");
  if (normalized in vectors) return normalized;
  const tokens = name
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.find((t) => t in vectors) ?? null;
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Fetch user profile to determine allergen profile key
  const profileResult = await dynamo.send(
    new GetCommand({ TableName: "fable-users", Key: { userId } })
  );

  const profile = profileResult.Item ?? {};
  const allergens: string[] = profile.allergens ?? [];
  const activePresets: string[] = profile.activePresets ?? [];
  const profileKey = getInsightProfileKey(allergens, activePresets);
  const weekStr = getISOWeekString();

  const TABLE = "fable-ingredient-insights";

  // Fetch profile+week, profile+all-time, global+week, and preference profile in parallel
  const [profileWeekRes, profileAllTimeRes, globalWeekRes, preferenceProfile] = await Promise.all([
    dynamo
      .send(new GetCommand({ TableName: TABLE, Key: { allergenProfile: profileKey, timeWindow: weekStr } }))
      .catch(() => ({ Item: undefined })),
    dynamo
      .send(new GetCommand({ TableName: TABLE, Key: { allergenProfile: profileKey, timeWindow: "all-time" } }))
      .catch(() => ({ Item: undefined })),
    profileKey === "global"
      ? Promise.resolve({ Item: undefined })
      : dynamo
          .send(new GetCommand({ TableName: TABLE, Key: { allergenProfile: "global", timeWindow: weekStr } }))
          .catch(() => ({ Item: undefined })),
    buildPreferenceProfile(userId).catch(() => null),
  ]);

  const hasEnoughSignals = preferenceProfile !== null && preferenceProfile.signalCount >= 5;

  const epicureVectors = getEpicureVectors();

  // Resolve Claude's verbose ingredient names to clean Epicure keys.
  // Drops anything that can't be matched (e.g. "grapes" not in 1790-ingredient set).
  const resolvedPreferred = hasEnoughSignals
    ? preferenceProfile!.preferred
        .map((k) => resolveToEpicureKey(k, epicureVectors))
        .filter((k): k is string => k !== null)
    : [];
  const resolvedAvoided = hasEnoughSignals
    ? preferenceProfile!.avoided
        .map((k) => resolveToEpicureKey(k, epicureVectors))
        .filter((k): k is string => k !== null)
    : [];

  const toDisplayName = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const tasteProfile = hasEnoughSignals
    ? {
        preferred: resolvedPreferred.slice(0, 3).map(toDisplayName),
        avoided: resolvedAvoided.slice(0, 3).map(toDisplayName),
        flavourTerritory: deriveFlavourTerritory(resolvedPreferred, epicureVectors),
        signalCount: preferenceProfile!.signalCount,
        formatSignals: preferenceProfile!.formatSignals,
      }
    : null;

  // seedIngredients uses resolved Epicure keys so /api/generate-recipe can look them up
  const seedIngredients = resolvedPreferred.slice(0, 3);

  const profileWeekRecord = (profileWeekRes.Item ?? null) as IngredientInsightsRecord | null;
  const trendingForYou = (profileWeekRecord?.trendingRecipeTypes ?? []).slice(0, 3).map((rt) => ({
    cuisine: rt.cuisine,
    occasion: rt.occasion,
    seedIngredients,
  }));

  return NextResponse.json({
    profileKey,
    weekStr,
    allergens,
    customAllergens: (profile.customAllergens ?? []) as string[],
    profileWeek: profileWeekRecord,
    profileAllTime: (profileAllTimeRes.Item ?? null) as IngredientInsightsRecord | null,
    globalWeek: profileKey === "global"
      ? profileWeekRecord
      : (globalWeekRes.Item ?? null) as IngredientInsightsRecord | null,
    tasteProfile,
    trendingForYou,
  });
}
