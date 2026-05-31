# Fable — Allergen-Aware Recipe Discovery

> Safe ingredients. Bold flavours. Food for everyone.

Fable is an allergen-aware recipe discovery app powered by Epicure — the largest multilingual food embedding model ever built (4.1M recipes, 7 languages, 1,790 ingredients). It uses ingredient embeddings to find flavour-matched pairings and generates novel, restaurant-quality recipes tailored to your dietary restrictions.

Built for the **H0 Hackathon** (AWS + Vercel, May–June 2026).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, Framer Motion |
| Deployment | Vercel |
| Database | AWS DynamoDB |
| Embeddings | Epicure Core (1,790 ingredients × 300 dimensions, cosine similarity) |
| Recipe generation | Anthropic Claude (`claude-sonnet-4-6`) with prompt caching |
| Allergen data | EU Big 14 truth table — 1,790 ingredient classifications, O(1) lookup |
| Package manager | pnpm |
| Testing | Jest 29, ts-jest, React Testing Library — 101 tests across 5 suites |

---

## Local Development

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local  # then fill in the values below

# Create DynamoDB tables (one-time setup)
pnpm setup:dynamodb

# Start the dev server
pnpm dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `AWS_REGION` | AWS region (e.g. `eu-west-2`) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `ANTHROPIC_API_KEY` | Anthropic API key for recipe generation |

> **Note:** the project uses `pnpm`. Running `npm install` will create a `package-lock.json` that conflicts with `pnpm-lock.yaml` and break the Vercel build.

---

## Shipped Features

### Allergen System
- EU Big 14 allergen picker with emoji cards
- Custom allergen search across all 1,790 Epicure ingredients
- Allergen codes mapped to EU standard (`milk` not `dairy`, `tree_nuts` not `tree-nuts`)
- Settings accessible at any time via the header cog; profile persisted in DynamoDB
- Quick-add ingredient chips automatically exclude allergen-flagged items and backfill from a wider pool

### Ingredient Input
- Searchable across all 1,790 Epicure ingredients with autocomplete
- Staging panel on ingredient selection — set subtype, quantity, unit, and date before confirming
  - **Subtype** — e.g. "breast", "ribeye", "baby"; appends to display name and improves recipe accuracy
  - **Quantity + unit** — pieces, grams, kg, ml, litres, tbsp, tsp, cups
  - **Date mode** — "Use by date" (user-entered) or "Bought date" (expected expiry auto-calculated from shelf-life table)
- Kitchen area badges on every ingredient tag — 🧊 Fridge, ❄️ Freezer, 🗄️ Cupboard, 🏠 Pantry
- Expiry warnings on ingredient tags — amber at 2 days, red with "Use today!" at 0–1 days
- Quick-add chips for popular ingredients (adapts to Safe Foods list when mode is active)
- Meal type filter — Snack, Starter, Main Course, Dessert
- Cook time filter — Quick (<30 min), Medium (30–60 min), Slow Cook (60 min+)
- **Cuisine filter** — 13 cuisines + "Surprise me", horizontal-scrollable chip row, single-select with "Any cuisine" default
- **Occasion filter** — Weeknight, Dinner Party, Street Food, Comfort Food, Packed Lunch, Romantic Dinner, Meal Prep, Celebration
- **Servings stepper** — +/− control for 1–12 people (default 2); quantities in the prompt are scaled accordingly
- **Kitchen equipment** — collapsible "What equipment do you have?" section with checkboxes for Hob, Oven, Microwave, Air Fryer, Slow Cooker, Pizza Oven, Barbecue/Grill, Instant Pot; Hob and Oven on by default; preference persisted permanently to DynamoDB
- **Use my kitchen only** toggle — constrains recipe generation to exactly the ingredients added; skips Epicure pairings and adds a hard prompt constraint so Claude adds nothing extra
- Ingredient list persisted in DynamoDB with debounced auto-save; old string-array profiles migrated automatically

### Recipe Generation
- **Show Pairings** — Epicure similarity search surfaces safe, flavour-matched ingredients
- **Generate Recipe** — Claude generates novel, restaurant-quality recipes
- Ingredients sorted by expiry date (ascending) before being passed to Claude — expiring items get used first
- Claude receives rich descriptions (e.g. `"2 pieces Chicken Breast (Epicure: chicken)"`) for cut-accurate recipes
- Ingredient quantities displayed rounded — whole-unit items (pieces, cloves, fillets) always shown as integers
- Recipes respect allergen profile, meal type, and cook time
- Prompt caching on the system prompt (~90% cost reduction on repeated calls)
- Food-themed gradient hero on every recipe card with title-hash colour variation across five palettes

### Drink Pairings
- Automatically suggested after every recipe is generated
- Top 3 recipe ingredients by quantity run through Epicure cosine similarity to find the closest-matching beverages
- Filtered against a curated list of 55 drinking beverages (cooking wines, vinegars, and non-drink items excluded)
- Allergen profile applied — e.g. milk-allergic users will not see milk or oat milk suggestions
- Context-aware emoji per drink type: 🍵 tea · ☕ coffee · 🥛 milk · 🍺 beer/cider · 🍷 wine · 🧃 juice · 🍸 spirits

### Recipe Feedback
- 👍 / 👎 buttons on every generated recipe
- Dislike opens a compact feedback panel: five reason checkboxes ("Too many ingredients", "Didn't like the ingredients", "Wrong cuisine style", "Too complex", "Wrong meal size") plus a free-text field
- Feedback stored in DynamoDB (`fable-feedback` table): `userId`, `recipeId`, `liked`, `reasons`, `notes`, `recipeTitle`, `recipeIngredients`, `timestamp`
- Recent disliked patterns and ingredients loaded at session start and injected into the Claude prompt — future recipes actively avoid them

### Safe Foods Mode
For users with MCAS, severe allergies, or highly restricted therapeutic diets.

- User builds an explicit list of every ingredient they can safely eat
- Recipe generation is strictly constrained to that list — no unlisted ingredients, substitutions, or garnishes
- Post-generation validation strips any ingredient Claude included outside the safe list
- If no liquid is in the safe list, Claude uses the placeholder `"liquid of choice"` with an in-step note; same for salt/seasoning
- Quick-add chips on the ingredient screen switch to the user's safe foods list
- Mode indicator badge in the app header; toggle in allergen settings
- Safe ingredients and mode preference persisted in DynamoDB

### Dark Mode
- 🌙 / ☀️ toggle in the header alongside the settings cog
- Toggle also available in Allergen Settings
- Preference persisted to DynamoDB — carries across devices
- Full `dark:` variant support via Tailwind and the existing `.dark` CSS variable theme

### Nutritional Information (Macros)
- "Show nutritional information" toggle in Allergen Settings — **off by default**
- Note displayed beneath the toggle: *"Calorie and macro information is hidden by default out of respect for users in eating disorder recovery."*
- When on, Claude estimates calories, protein, carbs, and fat per serving as part of recipe generation
- If the toggle is turned on after a recipe has already been generated, macros are fetched on demand via `/api/macros` (Claude Haiku) and patched into the displayed recipe without regenerating it
- Displayed under the label "Estimated nutritional information" as a four-cell row (Calories · Protein · Carbs · Fat) with a disclaimer: *"Estimates based on ingredients and quantities — consult a nutritionist for precise values."*
- Toggle preference persisted in DynamoDB on the user profile

### Collections
- Saved recipes organised into named collections, persisted in DynamoDB
- "All Saved" and "Collections" tabs on the saved screen
- Collection cards show a gradient colour-strip mosaic preview of the first 3 recipes inside
- Bookmark icon on every saved recipe card opens an add-to-collection modal — toggle recipes in/out of any collection with a single tap
- "New collection" creation inline in both the modal and the collections tab
- Collection detail view shows the full recipe grid; removing a recipe removes it from the collection only (not from saved)
- Collections load on session start alongside profile and saved recipes

### Substitutes Mode
Allergen-safe ingredient substitution using Epicure embeddings, with full recipe adaptation.

- **From my kitchen** — tap any kitchen ingredient to see the top 3 safe substitutes, scored by a weighted combination of similarity to the original (60%) and cosine fit to the rest of the dish (40%)
- **From a recipe** — paste a full recipe or enter an ingredient list; Claude extracts the ingredients, then each one is automatically checked:
  - ✅ **In kitchen** — ingredient is available, included as-is
  - 🔄 **Allergen** — contains a user allergen; best safe kitchen substitute auto-suggested via embedding search
  - ⚠️ **Missing** — not in kitchen, not an allergen; included in the adapted recipe anyway
- Substitution plan displayed as a formatted list before committing, with quantities where known (e.g. `🔄 Butter (2 tbsp) → Olive Oil (82% match) from your kitchen`)
- **Cook with these substitutions** — builds the adapted ingredient list and generates a full recipe via Claude, maintaining the spirit of the original dish
- **Functional category scoring** — same-category substitutes get a +0.1 score bonus, different-category a −0.3 penalty; grain ingredients (pasta, rice, flour) are hard-filtered from fat/dairy/liquid targets regardless of embedding score
- **Expiry-aware ranking** (From my kitchen) — kitchen substitutes expiring within 2 days are boosted up the ranking; expiry badge shown on result cards (red for today, amber for 2 days). Boost only applies if the base score is ≥ 45%
- Swap icon (↔) on every ingredient row in the generated recipe screen opens Substitutes pre-loaded with that ingredient and the rest of the recipe as context
- Find Substitutes button on the ingredients screen; dedicated Substitutes tab in the bottom navigation

### Diet & Lifestyle Presets
One-tap diet restriction setup above the EU Big 14 allergen grid.

- **Four presets**: 🌱 Vegan, 🥗 Vegetarian, 🥑 Keto, 🟢 Low-FODMAP — each maps to a curated list of Epicure ingredient keys excluded from recipe generation and pairings
- **Lactose Intolerance** toggle with two sub-modes (expand when enabled):
  - **Include dairy with reminders** — dairy stays in recipes; Claude adds a Lactaid note to the description; a 🥛 banner appears on the recipe screen; dairy kitchen ingredients show a 🥛 indicator on their tag
  - **Exclude dairy entirely** — treats dairy exactly like a milk allergen, filtered from all results and recipe generation
- `lactoseMode: 'include' | 'exclude'` persisted in DynamoDB alongside the toggle flag
- Presets stack with EU Big 14 allergens and custom allergen selections; exclusions are computed at call time (`effectiveCustomAllergens`) without mutating stored preferences
- Collapsible section auto-expands on load when any option is active (watches `isLoadingProfile` to handle async DynamoDB load)
- Header subtitle reflects the full restriction picture: "Vegan + 3 allergens active"
- Substitutes "From a recipe" allergen mode: ingredients below the 45% combined score threshold show `❌ [ingredient] — contains [allergen], no suitable substitute found — will be omitted` rather than the 🔄 swap format

### Navigation & History
- Five-tab navigation — Kitchen, Recipe, Substitutes, History, Saved
- Recipe tab persists the most recent recipe across navigation
- History tab — all recipes generated this session, newest first
- Saved tab — hearted recipes persisted in DynamoDB; deletable

---

## Architecture

```
Browser
  │
  ▼
Vercel — Next.js 16 (App Router)
  │
  ├── /api/ingredients         Epicure ingredient search (fuzzy, 1,790 items)
  ├── /api/recipes             Cosine similarity + allergen/safe-foods filter
  ├── /api/generate-recipe     Anthropic Claude recipe generation + validation
  ├── /api/drink-pairings      Epicure beverage similarity search + allergen filter
  ├── /api/feedback            Recipe like/dislike storage and pattern retrieval
  ├── /api/substitutes         Embedding similarity + category scoring + Claude explanations
  ├── /api/macros              Claude Haiku on-demand macro estimation for existing recipes
  ├── /api/extract-ingredients Claude ingredient extraction from arbitrary recipe text
  └── /api/user/
       ├── profile             DynamoDB read/write (allergens, safe foods, ingredients)
       ├── saved-recipes       DynamoDB read/write (full recipe objects)
       └── collections         DynamoDB CRUD (GET, POST, PUT, DELETE)

DynamoDB tables
  ├── fable-users              Per-user profile (allergens, safeIngredients, safeFoodsMode,
  │                            ingredients[]{name, displayName, subtype, quantity, unit,
  │                            area, dateType, useByDate, boughtDate, addedAt},
  │                            kitchenEquipment[], darkMode)
  ├── fable-saved-recipes      Saved recipes with full recipe JSON
  ├── fable-collections        Collections (userId+collectionId, name, recipeIds[], createdAt, updatedAt)
  └── fable-feedback           Recipe feedback (userId+recipeId, liked, reasons, notes,
                               recipeTitle, recipeIngredients, timestamp)

In-memory (loaded at server startup)
  ├── Epicure Core embeddings  1,790 × 300 float32 — cosine similarity search
  └── Allergen truth table     1,790 ingredient classifications — O(1) lookup
```

---

## Roadmap

### ✅ Completed
- ✅ Allergen truth table with edge cases (oat milk, almond milk etc)
- ✅ Custom allergen search across all 1,790 ingredients
- ✅ Safe Foods Mode for MCAS and restricted diets
- ✅ Kitchen areas (fridge, freezer, cupboard, pantry)
- ✅ Use-by and bought date tracking with shelf life calculation
- ✅ Expiry prioritisation in recipe generation
- ✅ Quantities and subtypes per ingredient
- ✅ Use my kitchen only mode
- ✅ Meal type filter (Snack, Starter, Main, Dessert)
- ✅ Cook time filter (Quick, Medium, Slow Cook)
- ✅ Drink pairings via Epicure embeddings
- ✅ Collections feature with DynamoDB persistence
- ✅ Like/dislike feedback system
- ✅ Macros toggle (off by default, eating disorder safe)
- ✅ Substitutes mode with context-aware scoring
- ✅ Recipe adaptation from pasted recipes
- ✅ Diet restriction presets (Vegan, Vegetarian, Keto, Low-FODMAP)
- ✅ Lactose intolerance with include/exclude modes and Lactaid reminder
- ✅ Quick-add chips filter allergens automatically
- ✅ Cuisine inspiration filter — 13 cuisines + Surprise me, horizontal scroll chip row
- ✅ Occasion filter — Weeknight, Dinner Party, Street Food, Comfort Food, Packed Lunch, Romantic Dinner, Meal Prep, Celebration
- ✅ Servings stepper — scale recipe quantities for 1–12 people (default 2)
- ✅ Kitchen equipment — Hob, Oven, Microwave, Air Fryer, Slow Cooker, Pizza Oven, Barbecue, Instant Pot (collapsible, persisted to DynamoDB)
- ✅ Dark mode — Moon/Sun toggle in header and allergen settings, persisted to DynamoDB
- ✅ 230 passing tests across 10 test suites

### In Progress
- [ ] Guest mode indicator — persistent header badge showing save-state context; tapping opens a popover explaining browser-local persistence and the coming account system

### Near Term
- [ ] Onboarding tutorial slideshow — 4-5 slides on first launch
- [ ] Nutritional database integration — USDA FoodData Central for accurate macros
- [ ] Barcode/QR scanning — scan food products, auto-populate kitchen via Open Food Facts API
- [ ] Photo recognition — take a photo of fridge/cupboard, Claude Vision auto-populates ingredients
- [ ] Ingredient substitutes improvements — better functional category matching
- [ ] Equipment-aware ingredient substitution — when a recipe step requires equipment the user doesn't have, use Epicure similarity search to suggest alternative ingredients that achieve the same result with available equipment (e.g. slow cooker → hob-friendly cuts)
- [ ] Navigation consolidation — reduce from 5 tabs to 4 on mobile by combining Substitutes and History into an "Explore" tab. Evaluate collapsible sidebar as an alternative navigation pattern for tablet/desktop breakpoints where bottom tabs feel less natural. Current 5-tab layout works for hackathon submission.

### Medium Term
- [ ] Health platform integration — Garmin Connect, Apple HealthKit, Google Health for activity-aware suggestions
- [ ] Recipe cost calculator — grocery API integration (Tesco, Sainsbury's, Kroger)
- [ ] Push notifications — expiring ingredient alerts
- [ ] Recipe sharing — share generated recipes with friends
- [ ] Native mobile app — iOS and Android for camera/barcode features

### Research & Future
- [ ] User authentication — Clerk or NextAuth for cross-device persistence, replacing anonymous UUID system. Guest mode remains fully functional.
- [ ] Epicure Chem integration — chemical compound layer for cross-reactivity research
- [ ] On-device AI — Liquid AI LFM2.5 for private on-device allergen filtering
- [ ] Medical nutrition database — elemental formulas for severe MCAS
- [ ] Multilingual UI — Epicure supports 7 languages
- [ ] Garmin/Apple Health/Google Health integration for glucose-aware suggestions for diabetic users
- [ ] High histamine preset for MCAS

---

## Impact

- **250 million+** people worldwide live with food allergies
- **MCAS** affects an estimated 17% of the population, many with severely restricted diets
- **230** passing automated tests across 10 suites ensuring allergen safety and filter accuracy
- Existing recipe apps are built for abundance — Fable is built for restriction
- Safe Foods Mode is the only known consumer recipe tool that constrains generation to a user-defined safe ingredient list, with server-side validation to catch anything the model adds outside it
- Lactose intolerance include/exclude modes with medication reminders
- Macros are off by default — a deliberate decision for eating disorder recovery users

---

*Built with Epicure (Kaikaku AI), AWS DynamoDB, Anthropic Claude, and Vercel.*  
*H0 Hackathon submission — June 2026*
