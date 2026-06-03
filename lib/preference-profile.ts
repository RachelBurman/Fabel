import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import {
  computePreferenceProfile,
  type FeedbackRecord,
} from "@/lib/feedback-preferences";
import {
  computeSurveyIngredientAdjustments,
  type SurveyResponse,
} from "@/lib/survey-signals";

export interface PreferenceProfileResult {
  scores: Record<string, number>
  preferred: string[]
  avoided: string[]
  signalCount: number
  strength: "soft" | "full"
  formatSignals: string[]
}

async function fetchRecentFeedback(
  userId: string
): Promise<Array<FeedbackRecord & { surveyResponse?: SurveyResponse }>> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: "fable-feedback",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );
  const all = (result.Items ?? []) as Array<
    FeedbackRecord & { surveyResponse?: SurveyResponse }
  >;
  return all
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);
}

function aggregateFormatSignals(
  records: Array<{ surveyResponse?: SurveyResponse }>
): string[] {
  const counts: Record<string, number> = {};
  for (const record of records) {
    if (!record.surveyResponse) continue;
    const signals = [
      ...(record.surveyResponse.recipePositives ?? []),
      ...(record.surveyResponse.recipeNegatives ?? []),
    ];
    for (const signal of signals) {
      counts[signal] = (counts[signal] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([signal]) => signal);
}

function mergeSurveyAdjustments(
  profile: ReturnType<typeof computePreferenceProfile>,
  recent: Array<{ surveyResponse?: SurveyResponse }>
): ReturnType<typeof computePreferenceProfile> {
  const surveyAdjustments = computeSurveyIngredientAdjustments(recent);
  for (const [key, adj] of Object.entries(surveyAdjustments)) {
    profile.scores[key] = (profile.scores[key] ?? 0) + adj;
  }
  const sorted = Object.entries(profile.scores).sort((a, b) => b[1] - a[1]);
  profile.preferred = sorted.filter(([, s]) => s > 0).slice(0, 5).map(([k]) => k);
  profile.avoided = [...sorted].reverse().filter(([, s]) => s < 0).slice(0, 5).map(([k]) => k);
  return profile;
}

export async function buildPreferenceProfile(
  userId: string | null
): Promise<PreferenceProfileResult | null> {
  if (!userId) return null;

  const recent = await fetchRecentFeedback(userId);
  const profile = computePreferenceProfile(recent);
  if (profile.strength === "none") return null;

  const merged = mergeSurveyAdjustments(profile, recent);

  return {
    scores: merged.scores,
    preferred: merged.preferred,
    avoided: merged.avoided,
    signalCount: recent.length,
    strength: merged.strength as "soft" | "full",
    formatSignals: aggregateFormatSignals(recent),
  };
}
