export function getInsightProfileKey(allergens: string[], activePresets: string[]): string {
  if (activePresets.includes('vegan')) return 'vegan'
  if (activePresets.includes('low_fodmap')) return 'low-fodmap'
  const hasGluten = allergens.includes('gluten')
  const hasDairy = allergens.includes('milk')
  const hasNuts = allergens.includes('tree_nuts') || allergens.includes('peanuts')
  if (hasGluten && hasDairy) return 'gluten-free#dairy-free'
  if (hasGluten) return 'gluten-free'
  if (hasDairy) return 'dairy-free'
  if (hasNuts) return 'nut-free'
  return 'global'
}

export function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
