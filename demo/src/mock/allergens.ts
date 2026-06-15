// EU Big 14 allergens — mirrors ALLERGENS in lib/types.ts
export const ALLERGENS = [
  { id: 'gluten',      name: 'Gluten',    icon: '🌾' },
  { id: 'milk',        name: 'Dairy',     icon: '🥛' },
  { id: 'eggs',        name: 'Eggs',      icon: '🥚' },
  { id: 'peanuts',     name: 'Peanuts',   icon: '🥜' },
  { id: 'tree_nuts',   name: 'Tree Nuts', icon: '🌰' },
  { id: 'crustaceans', name: 'Shellfish', icon: '🦐' },
  { id: 'fish',        name: 'Fish',      icon: '🐟' },
  { id: 'soy',         name: 'Soy',       icon: '🫘' },
  { id: 'sesame',      name: 'Sesame',    icon: '🌱' },
  { id: 'mustard',     name: 'Mustard',   icon: '🟡' },
  { id: 'celery',      name: 'Celery',    icon: '🥬' },
  { id: 'sulphites',   name: 'Sulphites', icon: '🍷' },
  { id: 'lupin',       name: 'Lupin',     icon: '🌸' },
  { id: 'molluscs',    name: 'Molluscs',  icon: '🦪' },
] as const

// Allergens selected in the demo (simulating a new user picking gluten + dairy)
export const DEMO_SELECTED = ['gluten', 'milk']
