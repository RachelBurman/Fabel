"""
Generates data/allergen-map.json — maps every ingredient to its EU Big 14 allergens.
Run: python scripts/generate-allergen-map.py
"""
import json
from pathlib import Path

data = json.load(open("data/epicure-core.json"))
ingredients = list(data.keys())

ALLERGENS = ["gluten", "crustaceans", "eggs", "fish", "peanuts",
             "soy", "milk", "tree_nuts", "celery", "mustard",
             "sesame", "sulphites", "lupin", "molluscs"]

# ── Helpers ──────────────────────────────────────────────────────────────────

def w(ing, *terms):
    """True if any term matches as a whole word / word-boundary in ingredient."""
    n = ing.replace("_", " ")
    for t in terms:
        t = t.replace("_", " ")
        if n == t or n.startswith(t + " ") or n.endswith(" " + t) or (" " + t + " ") in n:
            return True
    return False

def prefix(ing, *terms):
    """True if ingredient starts with any term (dairy-milk / nut-butter guard)."""
    n = ing.replace("_", " ")
    for t in terms:
        t = t.replace("_", " ")
        if n == t or n.startswith(t + " "):
            return True
    return False

# ── Explicit fish species in the dataset ─────────────────────────────────────

FISH_SPECIES = {
    "abalone",          # ← mollusc, not fish — kept here only as reminder to exclude
    "amberjack", "arctic_char", "basa", "batang_fish", "bluefish",
    "bombay_duck_fish", "branzino", "bream", "butterfish", "capelin", "carp",
    "catfish", "cobia", "cod", "cod_liver", "corvina", "crappie", "cured_fish",
    "dace", "dory", "eel", "fermented_fish", "filefish", "flounder",
    "gourami", "green_fish", "grouper", "haddock", "hake", "halibut",
    "hairtail", "herring", "horse_head_fish", "horse_mackerel", "loach",
    "mackerel", "mahi_mahi", "marlin", "milkfish", "miuy_croaker", "monkfish",
    "mudfish", "mudskipper", "mullet", "needlefish", "orange_roughy",
    "pacific_saury", "pangasius", "perch", "pike", "pollock", "pomfret",
    "pompano", "puffer_fish", "qingjiang_fish", "ray", "red_drum",
    "red_snapper", "rockfish", "salmon", "salt_cod", "sardine", "scad",
    "sea_bass", "sea_bream", "shark", "shark_fin", "skate", "smelt",
    "smoked_salmon", "snakehead_fish", "sole", "sprat", "stinky_mandarin_fish",
    "sturgeon", "sunfish", "swordfish", "tilapia", "tonguefish",
    "topmouth_culter", "trout", "tuna", "turbot", "walleye", "whitebait",
    "whitefish", "whiting", "wolffish", "wuchang_fish", "yellow_croaker",
    "mandarin_fish",
}

FISH_PRODUCTS = {
    "bonito", "bonito_flakes", "bottarga", "caviar", "chiikuwa", "chirimen_jako",
    "crab_claw_fish", "crab_stick", "dashi", "denbu", "fish", "fish_ball",
    "fish_cake", "fish_floss", "fish_maw", "fish_noodle", "fish_oil",
    "fish_paste", "fish_roe", "fish_sauce", "fish_sausage", "fish_skin",
    "fish_stock", "fish_tofu", "furikake", "hanpen", "mentaiko", "mentsuyù",
    "salmon_roe", "shirasu", "tarakó", "tarako", "unagi_kabayaki", "unagi_sauce",
    "worcestershire_sauce",  # contains anchovies
}

CRUSTACEAN_INGREDIENTS = {
    "crab", "crab_roe", "crayfish", "dried_shrimp", "krill", "langoustine",
    "lobster", "mantis_shrimp", "prawn", "shrimp", "shrimp_paste",
    # crab_stick is surimi (fish) but typically contains crab extract too
    "crab_stick",
}

# NOT crustaceans despite containing "crab" or "shrimp" in name:
NOT_CRUSTACEAN = {"crab_apple", "crab_boil_seasoning", "crab_mushroom", "shrimp_mushroom"}

MOLLUSC_INGREDIENTS = {
    "abalone", "clam", "cockle", "conch", "cuttlefish", "dried_oyster",
    "dried_scallop", "geoduck", "mussel", "octopus", "oyster", "oyster_sauce",
    "periwinkle", "razor_clam", "scallop", "sea_hare", "sea_snail", "sea_urchin",
    "snail", "squid", "squid_ink", "whelk",
    # clamato contains clam juice
    "clamato_juice",
}

# NOT molluscs despite name:
NOT_MOLLUSC = {
    "oyster_mushroom", "king_oyster_mushroom", "vegetarian_oyster_sauce",
    "snail_rice_noodle",   # rice noodle dish, snail may not be present
    "sea_cucumber",        # echinoderm, not mollusc
    "jellyfish",           # cnidarian, not mollusc
}

# ── Override table ───────────────────────────────────────────────────────────
# Format: ingredient_name → list of allergens it ACTUALLY contains.
# This takes priority over all rules below.

OVERRIDES = {
    # ── Plant milks – no dairy ───────────────────────────────────────────────
    "almond_milk":          ["tree_nuts"],
    "cashew_milk":          ["tree_nuts"],
    "hazelnut_milk":        ["tree_nuts", "milk"],  # commercial products often add dairy
    "oat_milk":             ["gluten"],
    "rice_milk":            [],
    "soy_milk":             ["soy"],
    "coconut_milk":         [],        # coconut is not a tree nut under EU law
    "coconut_cream":        [],
    "plant_based_milk":     [],        # generic; no declared allergen
    "plant_based_cream":    [],
    "plant_based_cheese":   [],        # typically soy or nut based — no dairy
    "plant_based_ham":      [],

    # ── Coconut products – not tree nuts under EU law ────────────────────────
    "coconut":              [],
    "coconut_aminos":       [],
    "coconut_liqueur":      [],
    "coconut_oil":          [],
    "coconut_sugar":        [],
    "coconut_vinegar":      [],
    "coconut_water":        [],
    "sea_coconut":          [],

    # ── Dairy-like names that are NOT dairy ──────────────────────────────────
    "coffee_creamer":       [],        # typically non-dairy
    "whipped_topping":      [],        # typically non-dairy
    "non_dairy_creamer":    [],

    # ── Nut butters – tree nuts, not milk ───────────────────────────────────
    "almond_butter":        ["tree_nuts"],
    "almond_paste":         ["tree_nuts"],
    "almond_tofu":          ["tree_nuts"],   # set with almond, not soy
    "bitter_almond":        ["tree_nuts"],
    "cashew":               ["tree_nuts"],
    "chocolate_hazelnut_spread": ["tree_nuts", "milk"],
    "hazelnut":             ["tree_nuts"],
    "hazelnut_liqueur":     ["tree_nuts"],
    "hazelnut_oil":         ["tree_nuts"],
    "macadamia_nut":        ["tree_nuts"],
    "marzipan":             ["tree_nuts"],   # almond-based
    "nut_butter":           ["tree_nuts"],
    "nut_oil":              ["tree_nuts"],
    "pecan":                ["tree_nuts"],
    "pine_nut":             ["tree_nuts"],
    "pistachio":            ["tree_nuts"],
    "pistachio_oil":        ["tree_nuts"],
    "praline":              ["tree_nuts", "milk"],
    "walnut":               ["tree_nuts"],
    "walnut_oil":           ["tree_nuts"],
    "candlenut":            ["tree_nuts"],
    "chestnut":             ["tree_nuts"],
    "frangipane":           ["tree_nuts", "eggs", "milk", "gluten"],
    "marzipan":             ["tree_nuts"],
    "amaretti_cookie":      ["tree_nuts", "eggs"],   # almond-based
    "amaretto":             ["tree_nuts"],
    "brazil_nut":           ["tree_nuts"],
    "praline":              ["tree_nuts", "milk"],
    "hickory_nut":          ["tree_nuts"],
    "orgeat":               ["tree_nuts"],   # almond syrup

    # ── Mushrooms with misleading names ─────────────────────────────────────
    "oyster_mushroom":      [],
    "king_oyster_mushroom": [],
    "crab_mushroom":        [],
    "shrimp_mushroom":      [],

    # ── Misidentified crustacean names ───────────────────────────────────────
    "crab_apple":           [],
    "crab_boil_seasoning":  [],   # spice blend, no crustaceans

    # ── Egg products ─────────────────────────────────────────────────────────
    "egg":                  ["eggs"],
    "egg_white":            ["eggs"],
    "egg_yolk":             ["eggs"],
    "duck_egg":             ["eggs"],
    "quail_egg":            ["eggs"],
    "goose_egg":            ["eggs"],
    "pigeon_egg":           ["eggs"],
    "century_egg":          ["eggs"],
    "salted_duck_egg":      ["eggs"],
    "balut":                ["eggs"],
    "egg_noodle":           ["eggs", "gluten"],
    "egg_roll":             ["eggs", "gluten"],
    "egg_roll_wrapper":     ["eggs", "gluten"],
    "egg_substitute":       [],       # designed to replace eggs
    "egg_tofu":             ["eggs"],  # Japanese style: eggs + dashi
    "eggnog":               ["eggs", "milk"],
    "eggplant":             [],       # vegetable, no allergens
    "advocaat":             ["eggs", "milk"],
    "mayonnaise":           ["eggs"],
    "hollandaise_sauce":    ["eggs", "milk"],
    "bearnaise_sauce":      ["eggs", "milk"],
    "aioli":                ["eggs"],
    "meringue":             ["eggs"],
    "custard":              ["eggs", "milk"],
    "custard_powder":       ["eggs", "milk"],
    "creme_anglaise":       ["eggs", "milk"],

    # ── Soy products ─────────────────────────────────────────────────────────
    "tofu":                 ["soy"],
    "dried_tofu":           ["soy"],
    "fermented_tofu":       ["soy"],
    "fried_tofu_puff":      ["soy"],
    "stinky_tofu":          ["soy"],
    "tofu_pudding":         ["soy"],
    "tofu_skin":            ["soy"],
    "blood_tofu":           [],       # made from animal blood, NOT soy
    "rice_tofu":            [],       # made from rice flour, NOT soy
    "milk_tofu":            ["milk"], # set with dairy milk, not soy
    "fish_tofu":            ["fish"], # fish-based, typically not soy
    "almond_tofu":          ["tree_nuts"],  # almond-based, NOT soy
    "edamame":              ["soy"],
    "tempeh":               ["soy"],
    "natto":                ["soy"],
    "miso":                 ["soy", "gluten"],  # most miso contains wheat or barley
    "doenjang":             ["soy"],
    "gochujang":            ["soy", "gluten"],
    "doubanjiang":          ["soy", "gluten"],
    "chunjang":             ["soy", "gluten"],
    "taucu":                ["soy"],
    "kinako":               ["soy"],
    "okara_powder":         ["soy"],
    "soybean":              ["soy"],
    "soybean_oil":          [],       # highly refined, EU exemption applies
    "soybean_paste":        ["soy", "gluten"],
    "soybean_sprout":       ["soy"],
    "soy_protein_isolate":  ["soy"],
    "soy_yogurt":           ["soy"],
    "textured_soy_protein": ["soy"],
    "fermented_black_bean": ["soy"],
    "black_bean_paste":     ["soy", "gluten"],
    "ssämjang":             ["soy", "gluten"],
    "chu_hou_paste":        ["soy", "gluten"],
    "hoisin_sauce":         ["soy", "gluten"],
    "sweet_bean_sauce":     ["soy", "gluten"],
    "mapo_tofu_sauce":      ["soy", "gluten"],
    "teriyaki_sauce":       ["soy", "gluten"],
    "yakisoba_sauce":       ["soy", "gluten"],
    "yakitori_sauce":       ["soy", "gluten"],
    "yakiniku_sauce":       ["soy", "gluten"],
    "sukiyaki_sauce":       ["soy", "gluten"],
    "donburi_sauce":        ["soy", "gluten", "fish"],
    "tonkatsu_sauce":       ["soy", "gluten"],
    "okonomiyaki_sauce":    ["soy", "gluten", "fish"],
    "korean_bbq_sauce":     ["soy", "gluten"],
    "bulgogi":              ["soy", "gluten"],
    "mentsuyù":             ["soy", "gluten", "fish"],
    "ponzu":                ["soy", "gluten", "fish"],
    "shoyu":                ["soy", "gluten"],
    "soy_sauce":            ["soy", "gluten"],
    "tamari":               ["soy"],   # soy, but typically gluten-free
    "dark_soy_sauce":       ["soy", "gluten"],
    "light_soy_sauce":      ["soy", "gluten"],
    "mushroom_soy_sauce":   ["soy", "gluten"],
    "white_soy_sauce":      ["soy", "gluten"],
    "sweet_soy_sauce":      ["soy", "gluten"],
    "shio_koji":            ["gluten"],  # rice + salt + koji, no soy
    "koji":                 [],         # grain-based starter, no allergen by itself

    # ── Soy sauce derivatives / mixed sauces ─────────────────────────────────
    "worcestershire_sauce": ["fish", "gluten"],
    "stir_fry_sauce":       ["soy", "gluten"],
    "char_siu_sauce":       ["soy", "gluten"],
    "xo_sauce":             ["crustaceans", "molluscs", "fish"],
    "oyster_sauce":         ["molluscs"],
    "vegetarian_oyster_sauce": [],
    "seafood_sauce":        ["fish", "crustaceans", "molluscs"],

    # ── Gluten / wheat products ───────────────────────────────────────────────
    "wheat":                ["gluten"],
    "wheat_germ":           ["gluten"],
    "wheat_gluten":         ["gluten"],
    "whole_wheat_flour":    ["gluten"],
    "cream_of_wheat":       ["gluten"],
    "bulgur":               ["gluten"],
    "couscous":             ["gluten"],
    "farro":                ["gluten"],
    "freekeh":              ["gluten"],
    "semolina":             ["gluten"],
    "spelt":                ["gluten"],
    "einkorn":              ["gluten"],
    "emmer":                ["gluten"],
    "seitan":               ["gluten"],
    "wheat_gluten":         ["gluten"],
    "fried_gluten_ball":    ["gluten"],
    "gluten_free_flour":    [],      # specifically gluten-free
    "rye":                  ["gluten"],
    "rye_bread":            ["gluten"],
    "barley":               ["gluten"],
    "barley_grass":         ["gluten"],  # made from barley — declared under EU law
    "malt":                 ["gluten"],
    "malt_vinegar":         ["gluten"],
    "oat":                  ["gluten"],
    "oat_milk":             ["gluten"],
    "buckwheat":            [],      # NOT wheat; gluten-free
    "bread":                ["gluten"],
    "bread_crumbs":         ["gluten"],
    "bagel":                ["gluten", "eggs"],
    "biscuit":              ["gluten", "milk"],
    "bolillo":              ["gluten"],
    "brioche":              ["gluten", "milk", "eggs"],
    "ciabatta":             ["gluten"],
    "cracker":              ["gluten"],
    "crispbread":           ["gluten"],
    "croissant":            ["gluten", "milk"],
    "crouton":              ["gluten"],
    "crumpet":              ["gluten", "milk"],
    "dough":                ["gluten"],
    "doughnut":             ["gluten", "milk", "eggs"],
    "dumpling":             ["gluten"],
    "dumpling_wrapper":     ["gluten"],
    "empanada_shell":       ["gluten"],
    "english_muffin":       ["gluten", "milk"],
    "fideo":                ["gluten"],
    "flatbread":            ["gluten"],
    "flour":                ["gluten"],
    "flour_tortilla":       ["gluten"],
    "focaccia":             ["gluten"],
    "fried_bread":          ["gluten"],
    "fried_dough_twist":    ["gluten"],
    "gnocchi":              ["gluten"],
    "graham_cracker":       ["gluten", "milk"],
    "graham_flour":         ["gluten"],
    "grissini":             ["gluten"],
    "matzo":                ["gluten"],
    "muffin":               ["gluten", "milk", "eggs"],
    "naan":                 ["gluten", "milk"],
    "noodle":               ["gluten"],
    "pancake":              ["gluten", "milk", "eggs"],
    "paratha":              ["gluten", "milk"],
    "pasta":                ["gluten"],
    "phyllo_dough":         ["gluten"],
    "pie_crust":            ["gluten", "milk"],
    "pita_bread":           ["gluten"],
    "pizza_crust":          ["gluten"],
    "poolish":              ["gluten"],
    "pretzel":              ["gluten"],
    "puff_pastry":          ["gluten", "milk"],
    "roti":                 ["gluten"],
    "rusk":                 ["gluten", "milk"],
    "sachima":              ["gluten", "eggs"],
    "simit":                ["gluten", "sesame"],
    "spaetzle":             ["gluten", "eggs"],
    "spring_roll_wrapper":  ["gluten"],
    "steamed_bun":          ["gluten"],
    "sweet_roll":           ["gluten", "milk"],
    "tortilla":             ["gluten"],
    "taco_shell":           [],   # typically corn-based
    "corn_tortilla":        [],
    "udon_noodle":          ["gluten"],
    "vermicelli":           ["gluten"],  # wheat vermicelli (rice vermicelli = no gluten)
    "wafer":                ["gluten", "milk"],
    "waffle":               ["gluten", "milk", "eggs"],
    "wonton":               ["gluten"],
    "wonton_wrapper":       ["gluten", "eggs"],
    "youtiao":              ["gluten"],
    "yufka":                ["gluten"],
    "sanzhi":               ["gluten"],
    "shaaobing":            ["gluten", "sesame"],
    "shaobing":             ["gluten", "sesame"],
    "farina":               ["gluten"],
    "cereal":               ["gluten"],
    "corn_flakes":          ["gluten"],  # typically malted / with barley malt
    "digestive_biscuit":    ["gluten", "milk"],
    "gingerbread":          ["gluten"],
    "gingersnap":           ["gluten"],
    "biscotti":             ["gluten", "tree_nuts", "eggs"],
    "cannoli_shell":        ["gluten"],
    "crescent_roll":        ["gluten", "milk"],
    "crepe":                ["gluten", "milk", "eggs"],
    "crumb_crust":          ["gluten"],
    "cookie":               ["gluten", "milk", "eggs"],
    "cookie_butter":        ["gluten"],
    "speculoos_cookie":     ["gluten"],
    "sponge_cake":          ["gluten", "milk", "eggs"],
    "swiss_roll":           ["gluten", "milk", "eggs"],
    "shortcake":            ["gluten", "milk"],
    "panettone":            ["gluten", "milk", "eggs"],
    "croissant":            ["gluten", "milk"],
    "kadaifi":              ["gluten"],
    "ladyfinger":           ["gluten", "eggs"],
    "idli":                 [],   # fermented rice+lentil, gluten-free
    "ramen_noodle":         ["gluten"],
    "somen_noodle":         ["soy", "gluten"],
    "egg_noodle":           ["gluten", "eggs"],
    "hokkie_noodle":        ["gluten"],
    "hokkien_noodle":       ["gluten"],
    "rice_noodle":          [],   # rice-based
    "glass_noodle":         [],   # mung bean starch
    "shirataki_noodle":     [],   # konjac-based
    "rice_paper":           [],
    "spring_roll":          ["gluten"],
    "ravioli":              ["gluten", "eggs"],
    "tortellini":           ["gluten", "eggs", "milk"],
    "papad":                [],   # lentil-based
    "arepa":                [],   # cornmeal-based
    "tamale":               [],   # cornmeal
    "liang_pi":             ["gluten"],  # wheat starch noodle
    "tarhana":              ["gluten", "milk"],
    "sev":                  ["gluten"],  # chickpea flour (gluten-free) — actually no
    # sev is made from chickpea flour which is gluten-free, remove gluten
    "sev":                  [],   # chickpea-flour snack, naturally gluten-free
    "falafel":              [],   # chickpea-based
    "hummus":               [],   # chickpea-based

    # ── Milk / dairy products ──────────────────────────────────────────────────
    "milk":                 ["milk"],
    "buffalo_milk":         ["milk"],
    "goat_milk":            ["milk"],
    "condensed_milk":       ["milk"],
    "evaporated_milk":      ["milk"],
    "milk_bread":           ["milk", "gluten"],
    "milk_chocolate":       ["milk"],
    "milk_tea":             ["milk"],
    "butter":               ["milk"],
    "buttercream":          ["milk"],
    "buttermilk":           ["milk"],
    "butterscotch":         ["milk"],
    "ghee":                 ["milk"],
    "cream":                ["milk"],
    "clotted_cream":        ["milk"],
    "creme_fraiche":        ["milk"],
    "sour_cream":           ["milk"],
    "cream_cheese":         ["milk"],
    "cream_liqueur":        ["milk"],
    "irish_cream":          ["milk"],
    "whey":                 ["milk"],
    "casein":               ["milk"],
    "lactose":              ["milk"],
    "kefir":                ["milk"],
    "quark":                ["milk"],
    "labneh":               ["milk"],
    "matsoni":              ["milk"],
    "ryazhenka":            ["milk"],
    "ayran":                ["milk"],
    "raita":                ["milk"],
    "tzatziki":             ["milk"],
    "calpis":               ["milk"],
    "dulce_de_leche":       ["milk"],
    "caramel":              ["milk"],
    "fudge":                ["milk"],
    "toffee":               ["milk"],
    "khoya":                ["milk"],
    "paneer":               ["milk"],
    "cajeta":               ["milk"],
    "junket":               ["milk"],
    "kaymaak":              ["milk"],
    "kaymak":               ["milk"],
    "rompope":              ["milk", "eggs"],
    "fromage_blanc":        ["milk"],
    "frosting":             ["milk"],
    "ganache":              ["milk"],
    "ice_cream":            ["milk", "eggs"],
    "ice_cream_cone":       ["gluten"],
    "frozen_yogurt":        ["milk"],
    "pudding":              ["milk"],
    "bechamel":             ["milk", "gluten"],
    "alfredo_sauce":        ["milk"],
    "pink_sauce":           ["milk"],
    "beurre_blanc":         ["milk"],
    "fondant":              ["milk"],
    "nougat":               ["tree_nuts", "eggs"],
    "halva":                ["sesame"],
    "tahini":               ["sesame"],
    "margarine":            [],   # typically dairy-free but may vary; default no
    "shortening":           [],   # typically dairy-free
    "lard":                 [],
    "tallow":               [],
    "suet":                 [],
    "duck_fat":             [],
    "goose_fat":            [],

    # ── Cheese — all dairy ───────────────────────────────────────────────────
    # (handled generically by "cheese" keyword below, but explicit for safety)
    "american_cheese":      ["milk"],
    "asiago_cheese":        ["milk"],
    "bel_paese_cheese":     ["milk"],
    "blue_cheese":          ["milk"],
    "boursin_cheese":       ["milk"],
    "brick_cheese":         ["milk"],
    "brie_cheese":          ["milk"],
    "bryndza":              ["milk"],
    "burrata":              ["milk"],
    "caciocavallo":         ["milk"],
    "camembert_cheese":     ["milk"],
    "cantal_cheese":        ["milk"],
    "cheddar_cheese":       ["milk"],
    "cheese":               ["milk"],
    "cheshire_cheese":      ["milk"],
    "chihuahua_cheese":     ["milk"],
    "colby_cheese":         ["milk"],
    "comte_cheese":         ["milk"],
    "cotija_cheese":        ["milk"],
    "cottage_cheese":       ["milk"],
    "cream_cheese":         ["milk"],
    "edam_cheese":          ["milk"],
    "emmental_cheese":      ["milk"],
    "ezine_cheese":         ["milk"],
    "farmer_cheese":        ["milk"],
    "feta_cheese":          ["milk"],
    "fontina_cheese":       ["milk"],
    "fromage_blanc":        ["milk"],
    "gloucester_cheese":    ["milk"],
    "goat_cheese":          ["milk"],
    "gorgonzola_cheese":    ["milk"],
    "gouda_cheese":         ["milk"],
    "grana_padano":         ["milk"],
    "gruyere_cheese":       ["milk"],
    "halloumi":             ["milk"],
    "havarti_cheese":       ["milk"],
    "jarlsberg_cheese":     ["milk"],
    "kashkaval_cheese":     ["milk"],
    "kasseri_cheese":       ["milk"],
    "kefalotiri":           ["milk"],
    "manchego_cheese":      ["milk"],
    "mascarpone_cheese":    ["milk"],
    "montasio_cheese":      ["milk"],
    "monterey_jack_cheese": ["milk"],
    "mozzarella_cheese":    ["milk"],
    "muenster_cheese":      ["milk"],
    "myzithra_cheese":      ["milk"],
    "neufchatel_cheese":    ["milk"],
    "oaxaca_cheese":        ["milk"],
    "paneer":               ["milk"],
    "panela_cheese":        ["milk"],
    "parmesan_cheese":      ["milk"],
    "pecorino_cheese":      ["milk"],
    "provolone_cheese":     ["milk"],
    "queso_anejo":          ["milk"],
    "queso_blanco":         ["milk"],
    "queso_fresco":         ["milk"],
    "raclette_cheese":      ["milk"],
    "red_leicester_cheese": ["milk"],
    "ricotta_cheese":       ["milk"],
    "ricotta_salata":       ["milk"],
    "robiola_cheese":       ["milk"],
    "romano_cheese":        ["milk"],
    "roquefort_cheese":     ["milk"],
    "scamorza":             ["milk"],
    "smoked_cheese":        ["milk"],
    "stilton_cheese":       ["milk"],
    "stracchino_cheese":    ["milk"],
    "sulguni_cheese":       ["milk"],
    "swiss_cheese":         ["milk"],
    "taleggio_cheese":      ["milk"],
    "tulum_cheese":         ["milk"],
    "velveeta_cheese":      ["milk"],
    "yogurt":               ["milk"],

    # ── Celery ────────────────────────────────────────────────────────────────
    "celery":               ["celery"],
    "celery_seed":          ["celery"],
    "chinese_celery":       ["celery"],
    "cream_of_celery_soup": ["celery", "milk", "gluten"],
    "water_celery":         ["celery"],
    "celeriac":             ["celery"],
    "lovage":               [],   # same family but not classified as celery allergen

    # ── Mustard ───────────────────────────────────────────────────────────────
    "mustard":              ["mustard"],
    "mustard_seed":         ["mustard"],
    "mustard_oil":          ["mustard"],
    "mustard_green":        ["mustard"],
    "mustard_root":         ["mustard"],
    "honey_mustard":        ["mustard"],
    "pickled_mustard_green":["mustard"],
    "sweet_preserved_mustard_green": ["mustard"],
    "dijonnaïse":           ["mustard", "eggs"],
    "dijonnaise":           ["mustard", "eggs"],

    # ── Peanuts ───────────────────────────────────────────────────────────────
    "peanut":               ["peanuts"],
    "peanut_butter":        ["peanuts"],
    "peanut_oil":           ["peanuts"],  # cold-pressed; refined would be exempt
    "peanut_sauce":         ["peanuts"],
    "satay":                ["peanuts"],

    # ── Sesame ────────────────────────────────────────────────────────────────
    "sesame_seed":          ["sesame"],
    "sesame_oil":           ["sesame"],
    "sesame_paste":         ["sesame"],
    "black_sesame_seed":    ["sesame"],
    "tahini":               ["sesame"],
    "furikake":             ["sesame", "fish"],
    "shichimi_togarashi":   ["sesame"],
    "dukkah":               ["sesame", "tree_nuts"],
    "zaatar":               ["sesame"],
    "gomashio":             ["sesame"],

    # ── Sulphites ─────────────────────────────────────────────────────────────
    "wine":                 ["sulphites"],
    "red_wine":             ["sulphites"],
    "white_wine":           ["sulphites"],
    "rose_wine":            ["sulphites"],
    "sparkling_wine":       ["sulphites"],
    "champagne":            ["sulphites"],
    "cava":                 ["sulphites"],
    "prosecco":             ["sulphites"],
    "port_wine":            ["sulphites"],
    "sherry":               ["sulphites"],
    "marsala_wine":         ["sulphites"],
    "madeira_wine":         ["sulphites"],
    "sauternes":            ["sulphites"],
    "moscatel_wine":        ["sulphites"],
    "vin_santo":            ["sulphites"],
    "ginger_wine":          ["sulphites"],
    "wine_lees":            ["sulphites"],
    "mead":                 ["sulphites"],
    "plum_wine":            ["sulphites"],
    "osmanthus_wine":       ["sulphites"],
    "mei_kuei_lu_wine":     ["sulphites"],
    "korean_rice_wine":     ["sulphites"],
    "rice_wine":            ["sulphites"],
    "sake":                 ["sulphites"],
    "beer":                 ["gluten", "sulphites"],
    "stout":                ["gluten", "sulphites"],
    "ale":                  ["gluten", "sulphites"],
    "lager":                ["gluten", "sulphites"],
    "hard_cider":           ["sulphites"],
    "malt_vinegar":         ["gluten", "sulphites"],
    "balsamic_vinegar":     ["sulphites"],
    "red_wine_vinegar":     ["sulphites"],
    "white_wine_vinegar":   ["sulphites"],
    "champagne_vinegar":    ["sulphites"],
    "sherry_vinegar":       ["sulphites"],
    "raisin":               ["sulphites"],
    "prune":                ["sulphites"],
    "sangria":              ["sulphites"],
    "vermouth":             ["sulphites"],
    "sweet_vermouth":       ["sulphites"],
    "verjuice":             ["sulphites"],
    "lillet":               ["sulphites"],

    # ── Specific fish / crustacean clarifications ─────────────────────────────
    "crab":                 ["crustaceans"],
    "crab_roe":             ["crustaceans"],
    "crab_stick":           ["fish", "crustaceans"],
    "crab_claw_fish":       ["fish", "crustaceans"],
    "dried_shrimp":         ["crustaceans"],
    "shrimp":               ["crustaceans"],
    "shrimp_paste":         ["crustaceans"],
    "mantis_shrimp":        ["crustaceans"],
    "prawn":                ["crustaceans"],
    "crayfish":             ["crustaceans"],
    "langoustine":          ["crustaceans"],
    "lobster":              ["crustaceans"],
    "krill":                ["crustaceans"],
    "seafood":              ["fish", "crustaceans", "molluscs"],
    "shellfish":            ["crustaceans", "molluscs"],
    "seafood_stock":        ["fish", "crustaceans", "molluscs"],
    "seafood_seasoning":    ["fish", "crustaceans", "molluscs"],
    "xo_sauce":             ["crustaceans", "molluscs", "fish"],
    "shacha_sauce":         ["fish", "crustaceans"],
    "laksa_paste":          ["crustaceans", "fish"],
    "tom_yum_paste":        ["crustaceans", "fish"],
    "sambal":               [],   # base chili paste, no allergen
    "sambal_oelek":         [],
    "petis":                ["crustaceans"],  # shrimp paste condiment

    # ── Molluscs ──────────────────────────────────────────────────────────────
    "abalone":              ["molluscs"],
    "clamato_juice":        ["molluscs"],
    "clam":                 ["molluscs"],
    "cockle":               ["molluscs"],
    "conch":                ["molluscs"],
    "cuttlefish":           ["molluscs"],
    "dried_oyster":         ["molluscs"],
    "dried_scallop":        ["molluscs"],
    "geoduck":              ["molluscs"],
    "mussel":               ["molluscs"],
    "octopus":              ["molluscs"],
    "oyster":               ["molluscs"],
    "oyster_sauce":         ["molluscs"],
    "periwinkle":           ["molluscs"],
    "razor_clam":           ["molluscs"],
    "scallop":              ["molluscs"],
    "sea_hare":             ["molluscs"],
    "sea_snail":            ["molluscs"],
    "snail":                ["molluscs"],
    "squid":                ["molluscs"],
    "squid_ink":            ["molluscs"],
    "whelk":                ["molluscs"],
    "snail_rice_noodle":    [],  # rice noodle dish; snail debatable but rice noodle = no gluten
    "jellyfish":            [],  # not a mollusc (cnidarian)
    "sea_cucumber":         [],  # echinoderm, not mollusc or fish

    # ── Fish explicit ─────────────────────────────────────────────────────────
    "dashi":                ["fish"],
    "bonito":               ["fish"],
    "bonito_flakes":        ["fish"],
    "bottarga":             ["fish"],
    "caviar":               ["fish"],
    "mentaiko":             ["fish"],
    "tarako":               ["fish"],
    "salmon_roe":           ["fish"],
    "fish_mint":            [],   # herb, not fish
    "worcestershire_sauce": ["fish", "gluten"],
    "chirimen_jako":        ["fish"],
    "shirasu":              ["fish"],
    "unagi_kabayaki":       ["fish"],
    "unagi_sauce":          ["fish"],
    "chiikuwa":             ["fish"],
    "hanpen":               ["fish"],
    "denbu":                ["fish"],
    "fish_sauce":           ["fish"],
    "cured_fish":           ["fish"],
    "fermented_fish":       ["fish"],
    "balyk":                ["fish"],
    "furikake":             ["fish", "sesame"],

    # ── Lupin ─────────────────────────────────────────────────────────────────
    # Not found in this dataset; keeping for completeness

    # ── Generic allergen-free clarifications ─────────────────────────────────
    "water_chestnut":       [],   # aquatic vegetable, not a nut
    "ginkgo_nut":           [],   # not in EU 14 tree nut list
    "fox_nut":              [],   # lotus seed, not a tree nut
    "acorn":                [],   # not in EU 14
    "nutmeg":               [],   # spice, not a tree nut
    "sea_urchin":           [],   # echinoderm, not a mollusc or fish
    "brewer_s_yeast":       ["gluten"],  # grown on barley
    "brewers_yeast":        ["gluten"],
    "yeast":                [],
    "nutritional_yeast":    [],

    # ── Processed / ambiguous sauces ─────────────────────────────────────────
    "caesar_dressing":      ["eggs", "fish", "milk"],
    "ranch_dressing":       ["milk", "eggs"],
    "thousand_island_dressing": ["eggs"],
    "french_dressing":      [],
    "italian_dressing":     [],
    "vinaigrette":          [],
    "salad_cream":          ["eggs", "mustard"],
    "remoulade_sauce":      ["eggs", "mustard"],
    "tartar_sauce":         ["eggs"],
    "pesto":                ["tree_nuts", "milk"],  # basil, pine nuts, parmesan
    "romesco_sauce":        ["tree_nuts"],
    "picada":               ["tree_nuts"],
    "mole":                 [],   # complex sauce; base is allergen-free
    "braising_liquid":      [],
    "gravy":                ["gluten"],
    "demi_glace":           ["gluten"],
    "roux":                 ["gluten", "milk"],
    "brown_sauce":          ["gluten"],
    "pasta_sauce":          [],
    "marinara_sauce":       [],
    "enchilada_sauce":      [],
    "creole_sauce":         [],
    "hot_sauce":            [],
    "chili_sauce":          [],
    "cocktail_sauce":       [],
    "barbecue_sauce":       ["gluten"],
    "steak_sauce":          ["gluten"],
    "browning_sauce":       ["gluten"],
    "buffalo_wing_sauce":   ["milk"],
    "cream_of_mushroom_soup": ["milk", "gluten"],
    "cream_of_chicken_soup":  ["milk", "gluten"],
    "hollandaise_sauce":    ["eggs", "milk"],
    "duck_sauce":           [],
    "plum_sauce":           [],
    "sweet_and_sour_sauce": [],
    "sweet_chili_sauce":    [],
    "hot_and_sour_sauce":   ["gluten"],
    "hoisin_sauce":         ["soy", "gluten"],
    "char_siu_sauce":       ["soy", "gluten"],
    "pepper_jelly":         [],
    "cranberry_sauce":      [],
    "chutney":              [],
    "ajvar":                [],
    "piquante_sauce":       [],
    "pickappeppa_sauce":    ["gluten"],
    "maggi_seasoning":      ["gluten"],
    "vegemite":             ["gluten"],
    "marmite":              ["gluten"],
    "fry_sauce":            ["eggs"],
    "dijonnaïse":           ["mustard", "eggs"],
    "dijonnaise":           ["mustard", "eggs"],
    "dry_pot_sauce":        ["soy", "gluten"],
    "mala_sauce":           ["soy", "gluten"],
    "buldak_sauce":         ["soy", "gluten"],
    "tteokbokki_sauce":     ["soy", "gluten"],
    "hot_pot_base":         ["soy", "gluten"],
    "guizhou_sour_soup":    ["gluten"],
    "gulai_seasoning":      [],
    "balado_seasoning":     [],
    "adobo_sauce":          [],
    "adobo_seasoning":      [],
    "sofrito":              [],
    "hogao":                [],
    "creole_seasoning":     ["gluten"],
    "cajun_seasoning":      [],
    "jerk_seasoning":       [],
    "fajita_seasoning":     [],
    "taco_seasoning":       [],
    "montreal_steak_seasoning": [],
    "greek_seasoning":      [],
    "italian_seasoning":    [],
    "barbecue_seasoning":   [],
    "poultry_seasoning":    [],
    "lemon_pepper":         [],
    "blackening_seasoning": [],
    "baharat":              [],
    "berbere":              [],
    "harissa":              [],
    "ras_el_hanout":        [],
    "garam_masala":         [],
    "curry_powder":         ["celery"],  # many curry powders contain celery seed
    "curry_paste":          ["celery"],
    "green_curry_paste":    ["crustaceans"],  # shrimp paste in Thai green curry
    "red_curry_paste":      ["crustaceans"],
    "yellow_curry_paste":   ["crustaceans"],
    "panang_curry_paste":   ["crustaceans", "tree_nuts"],  # peanuts sometimes
    "massaman_curry_paste": ["crustaceans", "peanuts"],
    "vadouvan":             [],
    "goda_masala":          [],
    "sambar_powder":        [],
    "tikka_masala":         ["milk"],
    "tandoori_masala":      ["milk"],
    "biryani_masala":       [],
    "chaat_masala":         [],
    "panch_phoron":         [],
    "five_spice_powder":    [],
    "chinese_five_spice":   [],
    "baharat":              [],
    "goulash":              [],
    "boquet_garni":         ["celery"],
    "bouquet_garni":        ["celery"],
    "mirepoix":             ["celery"],
    "consomme":             [],
    "broth":                [],
    "chicken_broth":        [],
    "vegetable_stock":      ["celery"],
    "mushroom_stock":       [],
    "meat_stock":           [],
    "game_stock":           [],
    "duck_stock":           [],
    "turkey_stock":         [],
    "pork_stock":           [],
    "superior_stock":       [],
    "bone":                 [],
    "bone_marrow":          [],
    "gelatin":              [],
    "agar":                 [],
    "carrageenan":          [],
    "pectin":               [],
    "lecithin":             [],   # ambiguous; could be soy — not flagging
    "xanthan_gum":          [],
    "guar_gum":             [],
    "gum_paste":            [],
    "sugar":                [],
    "brown_sugar":          [],
    "powdered_sugar":       [],
    "rock_sugar":           [],
    "jaggery":              [],
    "palm_sugar":           [],
    "piloncillo":           [],
    "muscovado_sugar":      [],
    "panela_cheese":        ["milk"],
    "dextrose":             [],
    "glucose_syrup":        [],
    "fructose":             [],
    "erythritol":           [],
    "isomalt":              [],
    "xylitol":              [],
    "stevia":               [],
    "allulose":             [],
    "trehalose":            [],
    "maltose":              [],
    "honey":                [],
    "maple_syrup":          [],
    "agave_syrup":          [],
    "golden_syrup":         [],
    "molasses":             [],
    "black_treacle":        [],
    "corn_syrup":           [],
    "cane_syrup":           [],
    "sorghum_syrup":        [],
    "mizuame":              [],
    "salt":                 [],
    "sea_moss":             [],
    "seaweed":              [],
    "kombu":                [],
    "nori":                 [],
    "wakame":               [],
    "hijiki":               [],
    "aonori":               [],
    "spirulina":            [],
    "kelp":                 [],
    "vinegar":              [],
    "apple_cider_vinegar":  [],
    "rice_vinegar":         [],
    "cane_vinegar":         [],
    "coconut_vinegar":      [],
    "fruit_vinegar":        [],
    "black_vinegar":        [],
    "sushi_vinegar":        [],
    "umeboshi_vinegar":     [],
    "white_vinegar":        [],
    "brine":                [],
    "lye_water":            [],
    "lime_water":           [],
    "club_soda":            [],
    "sparkling_water":      [],
    "tonic_water":          [],
    "root_beer":            [],
    "cola":                 [],
    "ginger_ale":           [],
    "ginger_beer":          [],
    "cream_soda":           [],
    "punch":                [],
    "bloody_mary_mix":      [],
    "sour_mix":             [],
    "lemon_pepper":         [],
    "ascorbic_acid":        [],
    "citric_acid":          [],
    "calcium_chloride":     [],
    "baking_powder":        [],
    "baking_soda":          [],
    "cream_of_tartar":      [],
    "alum":                 [],
    "baker_s_ammonia":      [],
    "bakers_ammonia":       [],
    "food_coloring":        [],
    "food_colouring":       [],
    "edible_gold_leaf":     [],
    "activated_charcoal_powder": [],
    "cooking_spray":        [],
    "liquid_smoke":         [],
    "meat_tenderizer":      [],
    "curing_salt":          [],
    "msg":                  [],
    "nigar_i":              [],
    "nigari":               [],
    "gypsum":               [],
    "glycerin":             [],
    "inulin":               [],
    "psyllium_husk":        [],
    "caraway_seed":         [],
    "fermentation_starter_cake": ["gluten"],
    "bai_ji_mo":            ["gluten"],
    "five_grain_powder":    ["gluten"],
}

# ── Keyword-based fallback rules ──────────────────────────────────────────────
# Applied only when no override exists.

def classify_by_rules(ing):
    n = ing.replace("_", " ")
    allergens = set()

    # GLUTEN
    if w(ing, "wheat", "rye", "barley", "spelt", "gluten", "semolina",
         "bulgur", "couscous", "farro", "freekeh", "seitan", "einkorn"):
        allergens.add("gluten")
    if prefix(ing, "oat"):
        allergens.add("gluten")
    if prefix(ing, "malt") and ing not in ("maltose",):
        allergens.add("gluten")
    if prefix(ing, "bread") or ing.endswith("_bread"):
        allergens.add("gluten")
    if prefix(ing, "flour") or ing.endswith("_flour"):
        if ing not in ("gluten_free_flour", "rice_flour", "cassava_flour",
                       "chickpea_flour", "corn_flour", "potato_flour",
                       "tapioca_flour", "almond_flour", "coconut_flour",
                       "buckwheat_flour", "teff_flour", "amaranth_flour",
                       "sorghum_flour", "glutinous_rice_flour", "mung_bean_flour"):
            allergens.add("gluten")
    if prefix(ing, "pasta") or prefix(ing, "noodle"):
        if ing not in ("rice_noodle", "glass_noodle", "shirataki_noodle",
                       "mung_bean_noodle", "rice_paper"):
            allergens.add("gluten")
    if w(ing, "beer", "ale", "stout", "lager"):
        allergens.add("gluten")
        allergens.add("sulphites")

    # MILK — prefix match only for "milk" and "butter" to avoid plant milks / nut butters
    if prefix(ing, "milk"):
        allergens.add("milk")
    if prefix(ing, "butter") and ing not in ("butterfly_pea_flower", "butterfish",
                                               "butternut_squash", "buttercup"):
        allergens.add("milk")
    if w(ing, "cheese", "cream", "yogurt", "ghee", "whey", "casein",
         "lactose", "kefir", "quark", "buttermilk", "labneh"):
        allergens.add("milk")
    if w(ing, "buffalo milk", "goat milk", "condensed milk", "evaporated milk"):
        allergens.add("milk")

    # EGGS
    if w(ing, "egg") and ing not in ("eggplant",):
        allergens.add("eggs")

    # FISH
    if ing in FISH_SPECIES or ing in FISH_PRODUCTS:
        allergens.add("fish")
    if w(ing, "fish") and ing not in ("starfish", "fish_mint", "cuttlefish",
                                       "jellyfish", "crawfish"):
        allergens.add("fish")
    if w(ing, "anchovy", "salmon", "tuna", "sardine", "herring", "mackerel",
         "cod", "haddock", "trout", "bass", "perch", "catfish", "eel",
         "carp", "pike", "mullet", "flounder", "sole", "halibut", "turbot",
         "grouper", "snapper", "bream", "monkfish", "pollock", "hake",
         "sturgeon", "swordfish", "marlin", "tilapia", "dace", "loach",
         "sprat", "capelin", "smelt", "whitebait", "bluefish", "barramundi",
         "branzino", "corvina", "walleye", "rockfish", "pompano", "pomfret"):
        allergens.add("fish")

    # CRUSTACEANS
    if ing in CRUSTACEAN_INGREDIENTS and ing not in NOT_CRUSTACEAN:
        allergens.add("crustaceans")
    if w(ing, "shrimp", "prawn", "crab", "lobster", "crayfish", "langoustine", "krill") \
            and ing not in NOT_CRUSTACEAN:
        allergens.add("crustaceans")

    # MOLLUSCS
    if ing in MOLLUSC_INGREDIENTS and ing not in NOT_MOLLUSC:
        allergens.add("molluscs")
    if w(ing, "oyster", "mussel", "clam", "squid", "octopus", "scallop",
         "snail", "cockle", "whelk", "abalone", "conch", "cuttlefish") \
            and ing not in NOT_MOLLUSC:
        allergens.add("molluscs")

    # SOY
    if w(ing, "soy", "soya", "tofu", "tempeh", "miso", "edamame",
         "soybean", "natto", "kinako"):
        allergens.add("soy")

    # PEANUTS
    if w(ing, "peanut", "groundnut"):
        allergens.add("peanuts")

    # TREE NUTS
    if w(ing, "almond", "hazelnut", "walnut", "cashew", "pecan",
         "brazil nut", "pistachio", "macadamia", "pine nut", "chestnut",
         "candlenut", "hickory nut"):
        allergens.add("tree_nuts")

    # SESAME
    if w(ing, "sesame", "tahini"):
        allergens.add("sesame")

    # MUSTARD
    if w(ing, "mustard"):
        allergens.add("mustard")

    # CELERY
    if w(ing, "celery", "celeriac"):
        allergens.add("celery")

    # SULPHITES — wine and derived vinegars
    if w(ing, "wine") and ing not in ("wine_lees",):
        allergens.add("sulphites")
    if w(ing, "champagne", "prosecco", "cava", "sherry", "vermouth",
         "mead", "sake", "sauternes"):
        allergens.add("sulphites")
    if w(ing, "raisin", "prune"):
        allergens.add("sulphites")

    # LUPIN
    if w(ing, "lupin"):
        allergens.add("lupin")

    return sorted(allergens)

# ── Build the map ─────────────────────────────────────────────────────────────

allergen_map = {}
for ing in sorted(ingredients):
    if ing in OVERRIDES:
        allergen_map[ing] = sorted(set(OVERRIDES[ing]))
    else:
        allergen_map[ing] = classify_by_rules(ing)

# ── Write output ──────────────────────────────────────────────────────────────

out = Path("data/allergen-map.json")
out.write_text(json.dumps(allergen_map, indent=2), encoding="utf-8")
print(f"Written {len(allergen_map)} ingredients to {out}")

# ── Spot-check edge cases ─────────────────────────────────────────────────────
checks = [
    "oat_milk", "almond_milk", "soy_milk", "coconut_milk", "rice_milk",
    "peanut_butter", "almond_butter", "butter", "milk",
    "oyster_mushroom", "king_oyster_mushroom", "oyster", "oyster_sauce",
    "crab_apple", "crab", "crab_boil_seasoning",
    "buckwheat", "wheat", "soy_sauce", "tamari",
    "soybean_oil", "coconut", "water_chestnut", "eggplant",
    "fish_mint", "worcestershire_sauce", "miso", "blood_tofu",
    "rice_tofu", "egg_tofu", "almond_tofu",
]
print("\nSpot-checks:")
for c in checks:
    print(f"  {c}: {allergen_map.get(c, 'NOT FOUND')}")
