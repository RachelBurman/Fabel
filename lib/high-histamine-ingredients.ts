// High histamine ingredients — excluded when lowHistamine preset is active.
// Framed as a dietary filter, not a medical tool. Based on standard low-histamine
// dietary guidelines used by the MCAS and histamine intolerance community.
// Not a substitute for medical advice.
//
// All keys cross-referenced against the Epicure 1,790 ingredient list.
// Keys not present in Epicure are excluded; singular forms used where plural doesn't exist.
//
// Alcohol is included via ALCOHOL_INGREDIENT_KEYS spread — single source of truth.
// Vinegars are listed here (histamine trigger via fermentation) but are NOT in
// ALCOHOL_INGREDIENT_KEYS (correctly excluded as false positives for alcohol).

import { ALCOHOL_INGREDIENT_KEYS } from './alcohol-ingredients'

export const HIGH_HISTAMINE_INGREDIENT_KEYS: readonly string[] = [
  ...ALCOHOL_INGREDIENT_KEYS,

  // Fermented foods
  'sauerkraut', 'kimchi', 'miso', 'tempeh',
  'soy_sauce', 'tamari', 'fish_sauce', 'worcestershire_sauce',

  // Vinegars (fermented — histamine trigger even though not alcoholic)
  'vinegar', 'apple_cider_vinegar', 'red_wine_vinegar',
  'white_wine_vinegar', 'balsamic_vinegar',

  // Aged and fermented dairy
  'parmesan_cheese', 'cheddar_cheese', 'gouda_cheese', 'blue_cheese',
  'camembert_cheese', 'brie_cheese', 'gruyere_cheese', 'emmental_cheese',
  'sour_cream', 'buttermilk', 'kefir', 'yogurt',

  // Cured and processed meats
  'bacon', 'ham', 'salami', 'pepperoni', 'chorizo', 'prosciutto',
  'smoked_salmon', 'smoked_meat',
  'anchovy', 'tuna', 'sardine',

  // High histamine vegetables
  'tomato', 'sun_dried_tomato', 'spinach', 'avocado', 'eggplant',

  // Citrus
  'lemon', 'lime', 'orange', 'grapefruit',

  // High histamine fruits
  'strawberry', 'raspberry', 'pineapple', 'papaya', 'banana',

  // Chocolate and cocoa
  'chocolate', 'cocoa_powder', 'cocoa_mass',

  // Condiments and triggers
  'ketchup', 'mustard',

  // Yeast-based
  'yeast', 'marmite',

  // Nuts (common histamine triggers)
  'walnut', 'cashew', 'peanut',
] as const
