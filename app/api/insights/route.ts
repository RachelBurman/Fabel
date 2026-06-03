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

  const tasteProfile = hasEnoughSignals
    ? {
        preferred: preferenceProfile!.preferred.slice(0, 3).map((k) => k.replace(/_/g, " ")),
        avoided: preferenceProfile!.avoided.slice(0, 3).map((k) => k.replace(/_/g, " ")),
        flavourTerritory: deriveFlavourTerritory(preferenceProfile!.preferred, getEpicureVectors()),
        signalCount: preferenceProfile!.signalCount,
      }
    : null;

  const seedIngredients = hasEnoughSignals
    ? preferenceProfile!.preferred.slice(0, 3)
    : [];

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
