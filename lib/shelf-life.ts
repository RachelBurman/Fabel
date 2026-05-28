// Fridge shelf life in days for common ingredients.
// Used to calculate expected use-by date when the user records a bought date.
const SHELF_LIFE_DAYS: Record<string, number> = {
  // Fruit & Veg
  spinach: 5,
  tomato: 7,
  banana: 4,
  carrot: 14,
  broccoli: 5,
  lettuce: 4,
  cucumber: 7,
  pepper: 7,
  mushroom: 5,
  strawberry: 3,
  apple: 21,
  potato: 14,
  onion: 30,
  garlic: 30,
  lemon: 21,
  lime: 21,
  kale: 7,
  zucchini: 7,
  avocado: 5,
  sweet_potato: 14,
  // Meat
  chicken: 2,
  beef: 3,
  pork: 3,
  fish: 2,
  salmon: 2,
  mince: 2,
  // Dairy
  milk: 7,
  yogurt: 14,
  butter: 30,
  cheese: 14,
  egg: 28,
  eggs: 28,
}

const DEFAULT_SHELF_LIFE = 7

export function getShelfLifeDays(name: string): number {
  return SHELF_LIFE_DAYS[name.toLowerCase()] ?? DEFAULT_SHELF_LIFE
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function getEffectiveUseByDate(item: {
  name: string
  dateType?: string
  useByDate?: string
  boughtDate?: string
}): string | undefined {
  if (item.dateType === 'bought' && item.boughtDate) {
    return addDays(item.boughtDate, getShelfLifeDays(item.name))
  }
  return item.useByDate
}
