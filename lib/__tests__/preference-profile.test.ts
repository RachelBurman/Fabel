import { buildPreferenceProfile } from '../preference-profile'

// Mock DynamoDB
jest.mock('../dynamo', () => ({
  dynamo: { send: jest.fn() },
}))

// Mock feedback-preferences (pure, tested separately)
jest.mock('../feedback-preferences', () => ({
  computePreferenceProfile: jest.requireActual('../feedback-preferences').computePreferenceProfile,
  buildTasteProfileClause: jest.requireActual('../feedback-preferences').buildTasteProfileClause,
}))

// Mock survey-signals (pure, tested separately)
jest.mock('../survey-signals', () => ({
  computeSurveyIngredientAdjustments: jest.requireActual('../survey-signals').computeSurveyIngredientAdjustments,
  buildRecipeFormatClauses: jest.requireActual('../survey-signals').buildRecipeFormatClauses,
}))

import { dynamo } from '../dynamo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSend = dynamo.send as jest.MockedFunction<(...args: any[]) => any>

function makeRecord(liked: boolean, ingredients: string[], day: number) {
  return {
    liked,
    recipeIngredients: ingredients,
    timestamp: `2026-05-${String(day).padStart(2, '0')}T12:00:00Z`,
  }
}

describe('buildPreferenceProfile', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns null for null userId', async () => {
    const result = await buildPreferenceProfile(null)
    expect(result).toBeNull()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns null for empty string userId', async () => {
    const result = await buildPreferenceProfile('')
    expect(result).toBeNull()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns null when fewer than 3 feedback records', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecord(true, ['garlic', 'garlic'], 1),
        makeRecord(true, ['garlic', 'garlic'], 2),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result).toBeNull()
  })

  it('returns null when exactly 2 records', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecord(true, ['onion', 'onion'], 1),
        makeRecord(false, ['onion', 'onion'], 2),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result).toBeNull()
  })

  it('returns profile with correct shape when signalCount >= 3', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecord(true, ['garlic', 'garlic'], 1),
        makeRecord(true, ['garlic', 'lemon'], 2),
        makeRecord(true, ['garlic', 'lemon'], 3),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      scores: expect.any(Object),
      preferred: expect.any(Array),
      avoided: expect.any(Array),
      signalCount: expect.any(Number),
      strength: expect.stringMatching(/^(soft|full)$/),
      formatSignals: expect.any(Array),
    })
  })

  it('returns signalCount equal to the number of records (up to 20)', async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeRecord(true, ['garlic', 'lemon'], i + 1)
    )
    mockSend.mockResolvedValueOnce({ Items: items })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.signalCount).toBe(10)
  })

  it('caps signalCount at 20 and uses most recent records', async () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      makeRecord(true, ['garlic', 'lemon'], i + 1)
    )
    mockSend.mockResolvedValueOnce({ Items: items })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.signalCount).toBe(20)
  })

  it('returns strength "soft" for 3–9 records', async () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeRecord(true, ['garlic', 'lemon'], i + 1)
    )
    mockSend.mockResolvedValueOnce({ Items: items })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.strength).toBe('soft')
  })

  it('returns strength "full" for 10+ records', async () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeRecord(true, ['garlic', 'lemon'], i + 1)
    )
    mockSend.mockResolvedValueOnce({ Items: items })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.strength).toBe('full')
  })

  it('preferred contains positively scored ingredients', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecord(true,  ['garlic', 'garlic'], 1),
        makeRecord(true,  ['garlic', 'lemon'],  2),
        makeRecord(false, ['cream',  'cream'],  3),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.preferred).toContain('garlic')
  })

  it('avoided contains negatively scored ingredients', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecord(false, ['cream', 'cream'], 1),
        makeRecord(false, ['cream', 'butter'], 2),
        makeRecord(true,  ['garlic', 'lemon'], 3),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.avoided).toContain('cream')
  })
})

// ─── formatSignals ────────────────────────────────────────────────────────────

function makeRecordWithSurvey(
  liked: boolean,
  ingredients: string[],
  day: number,
  recipePositives: string[],
  recipeNegatives: string[]
) {
  return {
    ...makeRecord(liked, ingredients, day),
    surveyResponse: {
      ingredientsHighlighted: [],
      ingredientsSkipped: [],
      recipePositives,
      recipeNegatives,
    },
  }
}

describe('buildPreferenceProfile — formatSignals', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns empty formatSignals when no survey responses', async () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeRecord(true, ['garlic', 'lemon'], i + 1)
    )
    mockSend.mockResolvedValueOnce({ Items: items })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.formatSignals).toEqual([])
  })

  it('excludes a signal that appears only once (below threshold)', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecordWithSurvey(true, ['garlic', 'lemon'], 1, ['Quick to make'], []),
        makeRecord(true, ['garlic', 'lemon'], 2),
        makeRecord(true, ['garlic', 'lemon'], 3),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.formatSignals).not.toContain('Quick to make')
  })

  it('includes a signal that appears 2+ times (meets threshold)', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecordWithSurvey(false, ['garlic', 'lemon'], 1, [], ['Too complex']),
        makeRecordWithSurvey(false, ['garlic', 'lemon'], 2, [], ['Too complex']),
        makeRecord(true, ['garlic', 'lemon'], 3),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.formatSignals).toContain('Too complex')
  })

  it('deduplicates — each signal appears at most once in formatSignals', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecordWithSurvey(false, ['garlic', 'lemon'], 1, [], ['Too complex']),
        makeRecordWithSurvey(false, ['garlic', 'lemon'], 2, [], ['Too complex']),
        makeRecordWithSurvey(false, ['garlic', 'lemon'], 3, [], ['Too complex']),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    const count = result?.formatSignals.filter(s => s === 'Too complex').length ?? 0
    expect(count).toBe(1)
  })

  it('mixes positives and negatives across records', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        makeRecordWithSurvey(true,  ['garlic', 'lemon'], 1, ['Quick to make'], []),
        makeRecordWithSurvey(false, ['garlic', 'lemon'], 2, [], ['Too many ingredients']),
        makeRecordWithSurvey(true,  ['garlic', 'lemon'], 3, ['Quick to make'], ['Too many ingredients']),
      ],
    })
    const result = await buildPreferenceProfile('user-1')
    expect(result?.formatSignals).toContain('Quick to make')
    expect(result?.formatSignals).toContain('Too many ingredients')
  })
})
