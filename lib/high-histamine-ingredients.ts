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
  'swiss_cheese', 'manchego_cheese', 'pecorino_cheese', 'romano_cheese',
  'mozzarella_cheese', 'ricotta_cheese', 'cream_cheese', 'feta_cheese', 'halloumi',
  'sour_cream', 'buttermilk', 'kefir', 'yogurt',

  // Cured and processed meats
  'bacon', 'ham', 'salami', 'pepperoni', 'chorizo', 'prosciutto',
  'smoked_salmon', 'smoked_meat',
  'anchovy', 'tuna', 'sardine',
  'hot_dog', 'sausage', 'mortadella', 'pastrami', 'corned_beef',

  // High histamine vegetables and derivatives
  'tomato', 'sun_dried_tomato', 'spinach', 'avocado', 'eggplant',
  'pasta_sauce',

  // Citrus
  'lemon', 'lime', 'orange', 'grapefruit', 'citrus',

  // High histamine fruits
  'strawberry', 'raspberry', 'pineapple', 'papaya', 'banana',

  // Chocolate and cocoa
  'chocolate', 'cocoa_powder', 'cocoa_mass', 'milk_chocolate',

  // Condiments and triggers
  'ketchup', 'mustard', 'sriracha', 'hot_sauce',

  // Additional vinegars
  'sherry_vinegar', 'malt_vinegar',

  // Additional fermented condiments
  'natto', 'doenjang', 'gochujang',

  // Pickled
  'pickled_vegetable', 'pickled_ginger',

  // Yeast-based
  'yeast', 'marmite',

  // Nuts (common histamine triggers)
  'walnut', 'cashew', 'peanut',
] as const
