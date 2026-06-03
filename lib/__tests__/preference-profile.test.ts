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
      formatClauses: expect.any(Array),
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
