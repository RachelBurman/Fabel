// Single source of truth for alcoholic Epicure ingredient keys.
// Import from here — never duplicate this list elsewhere.
//
// apple_cider is included: in UK usage "cider" and "apple cider" are always
// alcoholic drinks. The Epicure dataset uses the US convention where
// hard_cider is the explicitly alcoholic variant, but Fable's primary
// market is UK so both are flagged. hard_cider is also included for completeness.
//
// Confirmed false positives NOT in this list:
// ginger_beer, ginger_ale, root_beer, apple_juice,
// red_wine_vinegar, white_wine_vinegar, sherry_vinegar, champagne_vinegar,
// apple_cider_vinegar, sparkling_water

export const ALCOHOL_INGREDIENT_KEYS: readonly string[] = [
  // Beer & cider
  'beer', 'stout', 'lager', 'hard_cider', 'apple_cider',

  // Wine
  'wine', 'red_wine', 'white_wine', 'rose_wine', 'sparkling_wine', 'ginger_wine',
  'champagne', 'prosecco',
  'port_wine', 'madeira_wine', 'marsala_wine', 'moscatel_wine', 'plum_wine', 'osmanthus_wine',
  'sherry',

  // Asian cooking wines (alcoholic — not the same as vinegar)
  'sake', 'rice_wine', 'korean_rice_wine', 'mei_kuei_lu_wine', 'shaoxing_wine',
  'mirin',

  // Fortified & aromatised
  'vermouth', 'sweet_vermouth',

  // Spirits
  'gin', 'vodka', 'rum', 'whiskey', 'bourbon', 'tequila', 'mezcal',
  'grappa', 'calvados', 'kirschwasser', 'brandy', 'apple_brandy', 'apricot_brandy',
  'goldschlager', 'falernum', 'ouzo',

  // Mead
  'mead',

  // Liqueurs
  'liqueur', 'cherry_liqueur', 'chocolate_liqueur', 'coconut_liqueur',
  'coffee_liqueur', 'cranberry_liqueur', 'cream_liqueur', 'elderflower_liqueur',
  'ginger_liqueur', 'hazelnut_liqueur', 'maraschino_liqueur', 'melon_liqueur',
  'orange_liqueur', 'strega_liqueur',

  // Fermentation by-products
  'wine_lees',
] as const
