import { migrateGuestToAuth } from '../guest-migration'

jest.mock('../dynamo', () => ({
  dynamo: { send: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { dynamo } = require('../dynamo') as { dynamo: { send: jest.MockedFunction<(cmd: unknown) => Promise<unknown>> } }

function cmdName(cmd: unknown): string {
  return (cmd as { constructor: { name: string } }).constructor.name
}

function cmdTable(cmd: unknown): string {
  return ((cmd as { input: { TableName: string } }).input?.TableName) ?? ''
}

function cmdKey(cmd: unknown): Record<string, unknown> {
  return ((cmd as { input: { Key: Record<string, unknown> } }).input?.Key) ?? {}
}

beforeEach(() => {
  dynamo.send.mockReset()
})

describe('migrateGuestToAuth — no-op when guest record missing', () => {
  it('returns merged:false when guest fable-users record does not exist', async () => {
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest_123') return Promise.resolve({ Item: undefined })
        return Promise.resolve({ Item: { userId: 'auth_456', allergens: [] } })
      }
      return Promise.resolve({ Items: [] })
    })
    const result = await migrateGuestToAuth('guest_123', 'auth_456')
    expect(result.merged).toBe(false)
    expect(result.itemsMerged).toBe(0)
  })
})

describe('migrateGuestToAuth — allergens union', () => {
  it('unions allergens from both records without duplicates', async () => {
    const puts: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest_123') return Promise.resolve({ Item: { userId: 'guest_123', allergens: ['gluten', 'milk'], customAllergens: [], safeIngredients: [], activePresets: [], ingredients: [], preferenceSignals: [] } })
        return Promise.resolve({ Item: { userId: 'auth_456', allergens: ['eggs', 'milk'], customAllergens: [], safeIngredients: [], activePresets: [], ingredients: [], preferenceSignals: [] } })
      }
      if (cmdName(cmd) === 'PutCommand' && cmdTable(cmd) === 'fable-users') {
        puts.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({ Items: [] })
    })

    await migrateGuestToAuth('guest_123', 'auth_456')

    const merged = puts[0]
    expect(merged).toBeDefined()
    const allergens = merged.allergens as string[]
    expect(allergens).toContain('gluten')
    expect(allergens).toContain('milk')
    expect(allergens).toContain('eggs')
    expect(allergens.length).toBe(3) // no duplicates
  })
})

describe('migrateGuestToAuth — kitchen deduplication', () => {
  it('merges kitchen ingredients with auth winning on conflict', async () => {
    const puts: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest_123') {
          return Promise.resolve({
            Item: {
              userId: 'guest_123', allergens: [], customAllergens: [], safeIngredients: [], activePresets: [], preferenceSignals: [],
              ingredients: [
                { name: 'chicken', area: 'fridge', guestField: true },
                { name: 'rice', area: 'pantry', guestField: true },
              ],
            },
          })
        }
        return Promise.resolve({
          Item: {
            userId: 'auth_456', allergens: [], customAllergens: [], safeIngredients: [], activePresets: [], preferenceSignals: [],
            ingredients: [
              { name: 'chicken', area: 'freezer', authField: true }, // same key, auth wins
            ],
          },
        })
      }
      if (cmdName(cmd) === 'PutCommand' && cmdTable(cmd) === 'fable-users') {
        puts.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({ Items: [] })
    })

    await migrateGuestToAuth('guest_123', 'auth_456')

    const merged = puts[0]
    const ingredients = merged.ingredients as Array<Record<string, unknown>>
    const chicken = ingredients.find(i => i.name === 'chicken')
    const rice = ingredients.find(i => i.name === 'rice')

    expect(chicken?.area).toBe('freezer')     // auth value wins
    expect(chicken?.authField).toBe(true)       // auth record kept
    expect(rice).toBeDefined()                  // guest gap filled
    expect(ingredients.length).toBe(2)
  })
})

describe('migrateGuestToAuth — preferenceSignals append', () => {
  it('appends guest signals after auth signals', async () => {
    const puts: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest_123') {
          return Promise.resolve({ Item: { userId: 'guest_123', allergens: [], customAllergens: [], safeIngredients: [], activePresets: [], ingredients: [], preferenceSignals: [{ ingredient: 'rice', score: 1 }] } })
        }
        return Promise.resolve({ Item: { userId: 'auth_456', allergens: [], customAllergens: [], safeIngredients: [], activePresets: [], ingredients: [], preferenceSignals: [{ ingredient: 'chicken', score: 1 }] } })
      }
      if (cmdName(cmd) === 'PutCommand' && cmdTable(cmd) === 'fable-users') {
        puts.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({ Items: [] })
    })

    await migrateGuestToAuth('guest_123', 'auth_456')

    const signals = puts[0].preferenceSignals as Array<{ ingredient: string }>
    expect(signals[0].ingredient).toBe('chicken') // auth first
    expect(signals[1].ingredient).toBe('rice')     // guest appended
    expect(signals.length).toBe(2)
  })
})

describe('migrateGuestToAuth — feedback migration', () => {
  it('copies feedback records to auth userId', async () => {
    const putItems: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest_123') return Promise.resolve({ Item: { userId: 'guest_123', allergens: [], customAllergens: [], safeIngredients: [], activePresets: [], ingredients: [], preferenceSignals: [] } })
        return Promise.resolve({ Item: undefined })
      }
      if (cmdName(cmd) === 'QueryCommand') {
        const table = cmdTable(cmd)
        if (table === 'fable-feedback') {
          return Promise.resolve({ Items: [
            { userId: 'guest_123', recipeId: 'r1', liked: true },
            { userId: 'guest_123', recipeId: 'r2', liked: false },
          ] })
        }
        return Promise.resolve({ Items: [] })
      }
      if (cmdName(cmd) === 'PutCommand') {
        putItems.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({})
    })

    await migrateGuestToAuth('guest_123', 'auth_456')

    const feedbackPuts = putItems.filter(i => i.recipeId !== undefined)
    expect(feedbackPuts.length).toBe(2)
    expect(feedbackPuts.every(i => i.userId === 'auth_456')).toBe(true)
  })
})

describe('migrateGuestToAuth — non-fatal on partial failure', () => {
  it('returns merged:true even when a step throws', async () => {
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest_123') return Promise.resolve({ Item: { userId: 'guest_123', allergens: [], customAllergens: [], safeIngredients: [], activePresets: [], ingredients: [], preferenceSignals: [] } })
        return Promise.resolve({ Item: undefined })
      }
      if (cmdName(cmd) === 'QueryCommand') return Promise.reject(new Error('DynamoDB down'))
      return Promise.resolve({})
    })

    const result = await migrateGuestToAuth('guest_123', 'auth_456')
    expect(result.merged).toBe(true)
  })
})
