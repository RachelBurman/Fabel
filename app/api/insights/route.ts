import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { getInsightProfileKey, getISOWeekString } from "@/lib/insight-profile";
import { type IngredientInsightsRecord, type StoredTasteProfile } from "@/lib/types";
import { buildPreferenceProfile } from "@/lib/preference-profile";
import { deriveFlavourTerritory } from "@/lib/flavour-territory";
import { getEpicureVectors } from "@/lib/epicure";

// Force dynamic — this route serves personalized data (tasteProfile, recipeSuggestions)
// per userId. Data freshness is governed by the stored profile's lastComputedAt (6h),
// not by HTTP caching. A stale cached response would silently omit recipeSuggestions.
export const dynamic = "force-dynamic";

const FRESH_HOURS = 6;

function isProfileFresh(lastComputedAt: string): boolean {
  try {
    const age = Date.now() - new Date(lastComputedAt).getTime();
    return age < FRESH_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

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

  // Use the pre-computed tasteProfile from fable-users when it is fresh.
  // This avoids re-querying fable-feedback and re-running preference computation
  // on every insights request — the taste-profile-writer Lambda handles that.
  const storedProfile = (profile.tasteProfile ?? null) as StoredTasteProfile | null;
  const useStoredProfile = storedProfile !== null && isProfileFresh(storedProfile.lastComputedAt);

  const TABLE = "fable-ingredient-insights";

  // Fetch insights records and (conditionally) the live preference profile in parallel
  const [profileWeekRes, profileAllTimeRes, globalWeekRes, livePreferenceProfile] =
    await Promise.all([
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
      // Skip live computation when the stored profile is fresh
      useStoredProfile
        ? Promise.resolve(null)
        : buildPreferenceProfile(userId).catch(() => null),
    ]);

  // Normalise to a single profile shape regardless of source
  const preferenceProfile = useStoredProfile
    ? {
        preferred: storedProfile!.preferred,
        avoided: storedProfile!.avoided,
        formatSignals: storedProfile!.formatSignals,
        signalCount: storedProfile!.signalCount,
        strength: storedProfile!.strength,
      }
    : livePreferenceProfile;

  const hasEnoughSignals =
    preferenceProfile !== null && preferenceProfile.signalCount >= 5;

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

  // recipeSuggestions are only available from the stored profile (Lambda-generated)
  const recipeSuggestions =
    useStoredProfile && storedProfile!.recipeSuggestions?.length > 0
      ? storedProfile!.recipeSuggestions
      : undefined;

  const tasteProfile = hasEnoughSignals
    ? {
        preferred: resolvedPreferred.slice(0, 3).map(toDisplayName),
        avoided: resolvedAvoided.slice(0, 3).map(toDisplayName),
        flavourTerritory: deriveFlavourTerritory(resolvedPreferred, epicureVectors),
        signalCount: preferenceProfile!.signalCount,
        formatSignals: preferenceProfile!.formatSignals,
        ...(recipeSuggestions ? { recipeSuggestions } : {}),
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

  console.log(`[insights] userId=${userId} useStoredProfile=${useStoredProfile} hasEnoughSignals=${hasEnoughSignals} recipeSuggestions=${recipeSuggestions?.length ?? 0} tasteProfile=${tasteProfile !== null}`);

  return NextResponse.json({
    profileKey,
    weekStr,
    allergens,
    customAllergens: (profile.customAllergens ?? []) as string[],
    profileWeek: profileWeekRecord,
    profileAllTime: (profileAllTimeRes.Item ?? null) as IngredientInsightsRecord | null,
    globalWeek:
      profileKey === "global"
        ? profileWeekRecord
        : (globalWeekRes.Item ?? null) as IngredientInsightsRecord | null,
    tasteProfile,
    trendingForYou,
  });
}
