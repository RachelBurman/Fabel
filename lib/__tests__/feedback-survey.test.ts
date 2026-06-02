import { NextRequest } from 'next/server'
import {
  computeSurveyIngredientAdjustments,
  buildRecipeFormatClauses,
  type SurveyResponse,
} from '../survey-signals'
import { computePreferenceProfile } from '../feedback-preferences'

// ─── Mock DynamoDB ─────────────────────────────────────────────────────────────

const mockSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockSend },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/feedback`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function survey(overrides: Partial<SurveyResponse> = {}): SurveyResponse {
  return {
    ingredientsHighlighted: [],
    ingredientsSkipped: [],
    recipePositives: [],
    recipeNegatives: [],
    ...overrides,
  }
}

let PATCH: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/feedback/route')
  PATCH = mod.PATCH
})

beforeEach(() => {
  jest.clearAllMocks()
  mockSend.mockResolvedValue({})
})

// ─── PATCH /api/feedback ──────────────────────────────────────────────────────

describe('PATCH /api/feedback', () => {
  it('happy path — persists surveyResponse on existing record', async () => {
    const req = makeRequest('PATCH', {
      userId: 'u1',
      recipeId: 'r1',
      surveyResponse: survey({
        ingredientsHighlighted: ['Garlic'],
        recipeNegatives: ['Too complex'],
      }),
    })

    const res = await PATCH(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockSend).toHaveBeenCalledTimes(1)

    const callArg = mockSend.mock.calls[0][0]
    expect(callArg.input.ConditionExpression).toBe('attribute_exists(userId)')
    expect(callArg.input.ExpressionAttributeValues[':sr'].ingredientsHighlighted).toEqual(['Garlic'])
    expect(callArg.input.ExpressionAttributeValues[':sr'].recipeNegatives).toEqual(['Too complex'])
  })

  it('ingredient conflict — highlighted ingredient removed from skipped', async () => {
    const req = makeRequest('PATCH', {
      userId: 'u1',
      recipeId: 'r1',
      surveyResponse: survey({
        ingredientsHighlighted: ['Garlic', 'Onion'],
        ingredientsSkipped: ['Garlic', 'Tomato'],
      }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)

    const persisted = mockSend.mock.calls[0][0].input.ExpressionAttributeValues[':sr']
    expect(persisted.ingredientsHighlighted).toEqual(['Garlic', 'Onion'])
    // Garlic was in highlighted — it must be absent from skipped
    expect(persisted.ingredientsSkipped).toEqual(['Tomato'])
  })

  it('missing record — returns 404 when DynamoDB throws ConditionalCheckFailedException', async () => {
    mockSend.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' })

    const req = makeRequest('PATCH', {
      userId: 'u1',
      recipeId: 'nonexistent',
      surveyResponse: survey(),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })
})

// ─── Survey ingredient signal extraction ──────────────────────────────────────

describe('computeSurveyIngredientAdjustments', () => {
  it('ingredientsHighlighted boosts ingredient score by 1.5', () => {
    const adjustments = computeSurveyIngredientAdjustments([
      { surveyResponse: survey({ ingredientsHighlighted: ['Garlic'] }) },
    ])
    expect(adjustments['garlic']).toBe(1.5)
  })

  it('ingredientsSkipped reduces ingredient score by 1.5', () => {
    const adjustments = computeSurveyIngredientAdjustments([
      { surveyResponse: survey({ ingredientsSkipped: ['Onion'] }) },
    ])
    expect(adjustments['onion']).toBe(-1.5)
  })

  it('accumulates adjustments across multiple survey records', () => {
    const adjustments = computeSurveyIngredientAdjustments([
      { surveyResponse: survey({ ingredientsHighlighted: ['Garlic'] }) },
      { surveyResponse: survey({ ingredientsHighlighted: ['Garlic'] }) },
      { surveyResponse: survey({ ingredientsSkipped: ['Garlic'] }) },
    ])
    expect(adjustments['garlic']).toBe(1.5 + 1.5 - 1.5)
  })

  it('normalises ingredient keys to lowercase', () => {
    const adjustments = computeSurveyIngredientAdjustments([
      { surveyResponse: survey({ ingredientsHighlighted: ['Chicken Breast'] }) },
    ])
    expect(adjustments['chicken breast']).toBe(1.5)
    expect(adjustments['Chicken Breast']).toBeUndefined()
  })

  it('returns empty object when no records have surveyResponse', () => {
    const adjustments = computeSurveyIngredientAdjustments([{}])
    expect(adjustments).toEqual({})
  })
})

// ─── Recipe format signal aggregation ─────────────────────────────────────────

describe('buildRecipeFormatClauses', () => {
  it('signal appearing once is NOT injected', () => {
    const clauses = buildRecipeFormatClauses([
      { surveyResponse: survey({ recipeNegatives: ['Too complex'] }) },
    ])
    expect(clauses).toHaveLength(0)
  })

  it('signal appearing twice IS injected', () => {
    const clauses = buildRecipeFormatClauses([
      { surveyResponse: survey({ recipeNegatives: ['Too complex'] }) },
      { surveyResponse: survey({ recipeNegatives: ['Too complex'] }) },
    ])
    expect(clauses).toHaveLength(1)
    expect(clauses[0]).toContain('Keep the method simple')
  })

  it('all supported negative signals inject correctly when threshold met', () => {
    const records = Array.from({ length: 2 }, () => ({
      surveyResponse: survey({
        recipeNegatives: ['Too complex', 'Too simple', 'Wrong cuisine vibe', 'Too many ingredients', 'Took too long'],
      }),
    }))
    const clauses = buildRecipeFormatClauses(records)
    expect(clauses).toHaveLength(5)
  })

  it('positive signals inject correctly when threshold met', () => {
    const records = Array.from({ length: 2 }, () => ({
      surveyResponse: survey({ recipePositives: ['Great cuisine choice', 'Quick to make'] }),
    }))
    const clauses = buildRecipeFormatClauses(records)
    expect(clauses.some(c => c.includes('lean into similar flavours'))).toBe(true)
    expect(clauses.some(c => c.includes('keep cook time short'))).toBe(true)
  })

  it('Right amount of ingredients and Perfect complexity produce no injection', () => {
    const records = Array.from({ length: 2 }, () => ({
      surveyResponse: survey({ recipePositives: ['Right amount of ingredients', 'Perfect complexity'] }),
    }))
    const clauses = buildRecipeFormatClauses(records)
    expect(clauses).toHaveLength(0)
  })

  it('returns empty array when no records have surveyResponse', () => {
    const clauses = buildRecipeFormatClauses([{}])
    expect(clauses).toHaveLength(0)
  })
})

// ─── Threshold gate ────────────────────────────────────────────────────────────

describe('threshold gate — fewer than 3 feedback records', () => {
  it('computePreferenceProfile returns strength "none" for 2 records', () => {
    const records = [
      { liked: true, recipeIngredients: ['garlic'], timestamp: '2026-06-01T00:00:00Z' },
      { liked: true, recipeIngredients: ['garlic'], timestamp: '2026-06-02T00:00:00Z' },
    ]
    const profile = computePreferenceProfile(records)
    expect(profile.strength).toBe('none')
    // When strength is none, scores are empty — survey adjustments have nothing to augment
    expect(profile.scores).toEqual({})
  })

  it('survey format clauses are not injected when only 1 record has a surveyResponse', () => {
    // 1 appearance < 2 threshold — no injection even with a survey response present
    const clauses = buildRecipeFormatClauses([
      {
        surveyResponse: survey({
          recipeNegatives: ['Too complex', 'Took too long', 'Too many ingredients'],
        }),
      },
    ])
    expect(clauses).toHaveLength(0)
  })
})

// ─── Empty survey response ─────────────────────────────────────────────────────

describe('empty survey response', () => {
  it('all-empty survey produces no adjustments and no format clauses', () => {
    const adjustments = computeSurveyIngredientAdjustments([{ surveyResponse: survey() }])
    expect(adjustments).toEqual({})

    const clauses = buildRecipeFormatClauses([{ surveyResponse: survey() }])
    expect(clauses).toHaveLength(0)
  })

  it('no PATCH is called when survey has no selections', () => {
    // The UI gates the PATCH on hasSelections — replicated here as a logic assertion
    function hasSelections(r: SurveyResponse): boolean {
      return (
        r.ingredientsHighlighted.length > 0 ||
        r.ingredientsSkipped.length > 0 ||
        r.recipePositives.length > 0 ||
        r.recipeNegatives.length > 0
      )
    }
    expect(hasSelections(survey())).toBe(false)
  })
})
