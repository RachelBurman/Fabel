import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import {
  computePreferenceProfile,
  type FeedbackRecord,
} from "@/lib/feedback-preferences";
import {
  computeSurveyIngredientAdjustments,
  buildRecipeFormatClauses,
  type SurveyResponse,
} from "@/lib/survey-signals";

export interface PreferenceProfileResult {
  scores: Record<string, number>
  preferred: string[]
  avoided: string[]
  signalCount: number
  strength: "soft" | "full"
  formatClauses: string[]
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
  const formatClauses = buildRecipeFormatClauses(recent);

  return {
    scores: merged.scores,
    preferred: merged.preferred,
    avoided: merged.avoided,
    signalCount: recent.length,
    strength: merged.strength as "soft" | "full",
    formatClauses,
  };
}
