import { useMutation } from '@tanstack/react-query'
import { type SurveyResponse } from '@/lib/survey-signals'

export type SubmitSurveyInput = {
  userId: string
  recipeId: string
  surveyResponse: SurveyResponse
}

async function submitSurvey(input: SubmitSurveyInput): Promise<void> {
  await fetch('/api/feedback', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function useSubmitSurvey() {
  return useMutation({ mutationFn: submitSurvey })
}
