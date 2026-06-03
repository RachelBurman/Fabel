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
| Lambda | AWS Lambda (`nodejs24.x`) — DynamoDB Streams feedback processor · ingredient insights writer · Claude Vision ingredient scanner |
| Testing | Jest 29, ts-jest, React Testing Library — 512 tests across 23 suites |

---

## Local Development

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local  # then fill in the values below

# Create DynamoDB tables (one-time setup)
pnpm setup:dynamodb

# Seed the ingredient insights table with realistic starter data
pnpm seed:insights

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
| `VISION_LAMBDA_URL` | API Gateway URL for the `fable-vision-ingredient-scanner` Lambda |

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

### Photo Ingredient Recognition
- Camera icon alongside the kitchen search bar — taps open the device camera or photo library
- Photo is base64-encoded and sent to `POST /api/scan-ingredients` (Next.js proxy → `fable-vision-ingredient-scanner` Lambda)
- Lambda calls Claude Vision (Haiku 4.5) with a structured prompt to identify ingredients and infer storage area from visual cues (fridge, freezer, cupboard, pantry)
- Claude's ingredient names are fuzzy-matched against all 1,790 Epicure keys: exact match, prefix match, then token-overlap scoring; anything below threshold is excluded
- `confident: false` flagged when Claude expressed uncertainty or when the fuzzy match score is below the 0.8 high-confidence threshold
- Full review screen before anything lands in the kitchen: inferred storage area shown as a badge with one-tap editing; changing area applies to all ingredients at once
- Each ingredient row shows the display name, Epicure key beneath, an **Uncertain** badge when confidence is low, and an **In kitchen** badge when already present — pre-deselected to prevent duplicates
- Confirmed ingredients written via `setIngredients` (triggers the existing debounced DynamoDB auto-save — no new endpoint)
- Done with nothing selected = Cancel; no write made
- Error toasts for Lambda timeout, no ingredients found, and network failure (Sonner, now mounted in root layout)

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
- 👍 / 👎 buttons on every generated recipe — feedback saved immediately to DynamoDB, then an optional survey panel appears
- **Feedback survey** — four-section panel of tappable multi-select chips:
  - ✨ **Highlight of the dish** — select ingredients you loved (chips from the generated recipe)
  - 🚫 **Would leave out** — select ingredients you'd skip (same list; mutual exclusion with Section 1)
  - 👌 **What worked** — Perfect complexity · Great cuisine choice · Right amount of ingredients · Quick to make
  - 😬 **What didn't** — Too complex · Too simple · Wrong cuisine vibe · Too many ingredients · Took too long
  - Skip dismisses without any API call; Done with nothing selected is treated as Skip
- Feedback stored in DynamoDB (`fable-feedback` table): `userId`, `recipeId`, `liked`, `reasons`, `notes`, `recipeTitle`, `recipeIngredients`, `allergenProfile`, `timestamp`, `surveyResponse` (optional)
- Survey responses persisted via `PATCH /api/feedback` — updates the existing record, never overwrites base feedback
- Recent disliked patterns and ingredients loaded at session start and injected into the Claude prompt — future recipes actively avoid them
- **Survey-informed generation** — `/api/generate-recipe` reads survey signals from the last 20 feedback records and injects them into the Claude prompt (threshold-gated at 3+ records):
  - `ingredientsHighlighted` boosts ingredient preference score by 1.5×; `ingredientsSkipped` reduces by 1.5× (additive on top of base like/dislike scores)
  - Recipe format signals (`recipePositives`, `recipeNegatives`) injected when a signal appears in 2+ records (noise suppression)
- **Real-time preference signals** — DynamoDB Stream on `fable-feedback` triggers `fable-feedback-stream-processor` Lambda on every write; one `preferenceSignals` entry per ingredient is appended to `fable-users` automatically (event-driven, no polling)

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

### Onboarding Tutorial
A 5-slide introductory slideshow that appears on first launch and is re-launchable from settings.

- Shown automatically on first app load by checking `fable-onboarding-complete` in `localStorage`; never shown again once dismissed
- Full-screen overlay with a dark backdrop dimming the app behind it; slides animate left/right via Framer Motion
- **Slide 1 — Welcome**: Fable logo, food-gradient hero, brand positioning copy
- **Slide 2 — Allergens**: EU Big 14 allergen picker illustration with active state previews
- **Slide 3 — Your Kitchen**: Fridge and Cupboard ingredient card mockup
- **Slide 4 — Recipe Generation**: Generated recipe card with Claude attribution and gradient hero
- **Slide 5 — Safe Foods Mode**: Safe Foods list with green shield and ingredient checklist
- Skip button (top-right) dismisses at any point; "Let's go" CTA on the final slide — both set `fable-onboarding-complete: true`
- Tapping anywhere on the slide body advances to the next slide (mobile-friendly)
- Dot indicator (pill-shaped active dot) shows current position across all 5 slides
- **Restart tutorial** option in Allergen Settings — clears the localStorage flag and re-shows the overlay
- 8 unit tests covering: show-on-first-load, suppress-when-seen, skip flag, Let's go flag, restart flag, slide count, dot index range

### Navigation & History
- Six-tab navigation — Kitchen, Recipe, Discover, Substitutes, History, Saved
- **Responsive layout** — bottom tab bar on mobile (< 768 px); fixed left sidebar (220 px) on desktop (≥ 768 px) with Fable logo/wordmark at the top and stacked icon + label items; main content area shifts right on desktop; same green active-state highlight and `bg-card/95` theming at both breakpoints
- Recipe tab persists the most recent recipe across navigation
- History tab — all recipes generated this session, newest first
- Saved tab — hearted recipes persisted in DynamoDB; deletable
- **Tab visibility** — Navigation settings let users hide individual tabs; at least 2 must remain visible; persisted to DynamoDB

### Discover Tab
Trending ingredient insights as a dedicated tab (Compass icon), between Recipe and Substitutes.

- **Trending for you** — top 3 recipe types (cuisine + occasion) trending for the user's allergen profile this week; tapping pre-fills the cuisine and occasion filters
- **Trending globally** — top 5 most-liked ingredients across all users this week
- **Most loved ingredients** — all-time top 6 ingredients for the user's allergen profile, shown with a visual score bar
- **Trending pairings** — top 3 drink + cuisine pairings this week for the user's allergen profile
- Section and each sub-section individually toggleable in settings; persisted to DynamoDB
- Powered by `fable-ingredient-insights` — a fifth DynamoDB table aggregated by the Lambda on every liked feedback event
- API route `/api/insights` cached for 1 hour (Next.js route revalidation)
- Subtitle shows "Trending this week · global" when the user has no restrictions; "Trending this week · safe for you" with an "Excluding [allergen list]" secondary line when any EU 14 or custom allergens are set — driven by the user's actual restrictions, not by whether their profile matched a seeded data key

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
  ├── /api/scan-ingredients    Thin proxy → fable-vision-ingredient-scanner Lambda
  ├── /api/feedback            Recipe like/dislike storage and pattern retrieval
  ├── /api/substitutes         Embedding similarity + category scoring + Claude explanations
  ├── /api/macros              Claude Haiku on-demand macro estimation for existing recipes
  ├── /api/extract-ingredients Claude ingredient extraction from arbitrary recipe text
  ├── /api/insights            Ingredient insights (1h cache) — allergen-profile + global trends
  └── /api/user/
       ├── profile             DynamoDB read/write (allergens, safe foods, ingredients)
       ├── saved-recipes       DynamoDB read/write (full recipe objects)
       └── collections         DynamoDB CRUD (GET, POST, PUT, DELETE)

DynamoDB tables
  ├── fable-users              Per-user profile (allergens, safeIngredients, safeFoodsMode,
  │                            ingredients[]{name, displayName, subtype, quantity, unit,
  │                            area, dateType, useByDate, boughtDate, addedAt},
  │                            kitchenEquipment[], darkMode, preferenceSignals[],
  │                            discoverSettings{}, visibleTabs[])
  ├── fable-saved-recipes      Saved recipes with full recipe JSON
  ├── fable-collections        Collections (userId+collectionId, name, recipeIds[], createdAt, updatedAt)
  ├── fable-feedback           Recipe feedback (userId+recipeId, liked, reasons, notes,
  │                            recipeTitle, recipeIngredients, allergenProfile, timestamp,
  │                            surveyResponse?{ingredientsHighlighted, ingredientsSkipped,
  │                              recipePositives, recipeNegatives})
  │                              │
  │                              ▼ DynamoDB Stream
  │                            AWS Lambda — fable-feedback-stream-processor
  │                              │  1. Extracts one preferenceSignal per ingredient → fable-users
  │                              └─ 2. Increments likeCount per ingredient in fable-ingredient-insights
  │                                    (liked events only; non-fatal; updates week + all-time records)
  └── fable-ingredient-insights  Aggregate trending data (allergenProfile PK + timeWindow SK)
                                  trendingIngredients[], trendingPairings[], trendingRecipeTypes[]
                                  Profiles: global, gluten-free, dairy-free, nut-free,
                                            gluten-free#dairy-free, vegan, low-fodmap

AWS Lambda
  ├── fable-feedback-stream-processor   DynamoDB Stream → preference signals + ingredient insights
  └── fable-vision-ingredient-scanner   API Gateway HTTP POST → Claude Vision (Haiku 4.5)
                                         → fuzzy Epicure key matching → structured ingredient list

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
- ✅ Onboarding tutorial slideshow — 5-slide overlay on first launch, re-launchable from settings
- ✅ DynamoDB Streams + Lambda (`fable-feedback-stream-processor`) — real-time `preferenceSignals` written to `fable-users` on every feedback write; deployed on `nodejs24.x`; 6 unit tests
- ✅ Guest mode indicator — persistent header badge showing save-state context; tapping opens a popover explaining browser-local persistence and the coming account system
- ✅ `fable-ingredient-insights` table — aggregate trending data by allergen profile; seeded with 14 realistic records across 7 profiles × 2 time windows
- ✅ Discover tab — dedicated nav tab (Compass icon) between Recipe and Substitutes; Trending for you, Trending globally, Most loved, Trending pairings; each sub-section individually toggleable in settings
- ✅ Tab visibility settings — hide/show individual nav tabs (incl. Discover); min 2 enforced; persisted to DynamoDB. Supersedes the earlier plan to consolidate to 4 tabs: user-controlled visibility is a more flexible solution than hardcoding a merged "Explore" tab
- ✅ Lambda extended — liked feedback events now also write to `fable-ingredient-insights` (non-fatal); allergenProfile stored per feedback record
- ✅ `/api/insights` route — 1-hour cached; returns profile + global trending data
- ✅ 477 passing tests across 21 test suites
- ✅ Responsive navigation — fixed 220 px left sidebar on desktop (≥ 768 px) with Fable wordmark; bottom tab bar on mobile; same active-state and theming at both breakpoints
- ✅ **Feedback survey** — optional 4-section chip panel after every thumbs up/down; PATCH `/api/feedback` persists `surveyResponse`; ingredient signals weighted 1.5×; recipe format signals threshold-gated at 2+ appearances; 18 new tests (495 total across 22 suites)
- ✅ **Photo ingredient recognition** — camera icon in kitchen tab; Claude Vision (Haiku 4.5) via `fable-vision-ingredient-scanner` Lambda identifies ingredients and infers storage area; fuzzy Epicure key matching with confidence flagging; full review screen with area editing, uncertain badges, and duplicate deselection; Sonner toast notifications; 17 new tests (512 total across 23 suites)

### In Progress

### Near Term
- [ ] Onboarding state in DynamoDB — `onboardingComplete` flag currently lives in `localStorage` only. Add `onboardingComplete: boolean` to `fable-users` schema for authenticated users, so tutorial state persists across devices. Migration path: on auth, write `onboardingComplete: false` only if the `localStorage` flag is absent.
- [ ] **Agentic taste profile evolution** — currently Fable computes ingredient preference scores fresh on each `/api/generate-recipe` call from raw feedback history. The next step is a background Lambda function that periodically reviews a user's full feedback history, identifies drift and emerging patterns in their taste profile, rewrites a structured `tasteProfile` object on `fable-users`, and proactively surfaces recipe direction suggestions in the Discover tab. The data layer (DynamoDB Streams, Lambda, `preferenceSignals`, `fable-ingredient-insights`) is already in place. This is the natural evolution from personalised inference pipeline to a genuinely agentic personalisation loop.
- [ ] Nutritional database integration — USDA FoodData Central for accurate macros
- [ ] Barcode/QR scanning — scan food products, auto-populate kitchen via Open Food Facts API
- [ ] Ingredient substitutes improvements — better functional category matching
- [ ] Equipment-aware ingredient substitution — when a recipe step requires equipment the user doesn't have, use Epicure similarity search to suggest alternative ingredients that achieve the same result with available equipment (e.g. slow cooker → hob-friendly cuts)

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

## Upcoming Engineering Work

### AWS & Database Enhancements

#### ~~1. Close the feedback loop~~ ✅ Done
`/api/generate-recipe` reads the last 20 feedback records, computes ingredient preference scores, injects top 5 preferred and top 5 avoided into the Claude prompt. Auto-swap replaces avoided ingredients (score < −0.3) with the nearest Epicure cosine neighbour.

#### ~~2. DynamoDB Streams + AWS Lambda — real-time preference learning~~ ✅ Done
`fable-feedback-stream-processor` Lambda (`lambda/feedback-processor/`) fires on every write to the `fable-feedback` Stream, extracts one `preferenceSignal` per ingredient, and appends it to `fable-users.preferenceSignals[]` via `list_append`. Non-fatal on partial batch failure. 6 unit tests passing. Deployed on `nodejs24.x`.

#### ~~3. `fable-ingredient-insights` table — aggregate analytics layer~~ ✅ Done
`fable-ingredient-insights` (allergenProfile PK, timeWindow SK) is written to by the Lambda on every liked feedback event. Tracks trending ingredients, pairings, and recipe types per allergen profile. Surfaced in the new Discover section above the generation flow. Seeded with 14 records across 7 profiles.

#### ~~4. TTL on recipe history~~ ✅ Done
TTL enabled on `fable-saved-recipes` in AWS console. Unsaved recipes expire after 90 days (7,776,000 seconds). Saved recipes never expire. Backwards-compatible — old records without the field are treated as saved.

#### ~~5. AWS Lambda — Claude Vision ingredient recognition~~ ✅ Done
`fable-vision-ingredient-scanner` Lambda (`lambda/vision-scanner/`) accepts a base64 image via API Gateway HTTP POST, calls Claude Vision (Haiku 4.5) to identify ingredients and infer storage area, fuzzy-matches results against all 1,790 Epicure keys, and returns a structured ingredient list with confidence flags. Full review screen in the app before anything lands in the kitchen. Deployed on `nodejs24.x` in `eu-west-2`.

### Key Architecture Decisions

**Feedback as a personalisation engine** — `fable-feedback` is not a log. It is the input to a preference model that shapes every subsequent Claude prompt for that user. Like/dislike + reason tags → weighted constraints → better generation over time.

**DynamoDB Streams for event-driven preference updates** — preference profiles in `fable-users` are updated reactively via Lambda on every feedback write, not on request. No latency cost at generation time.

**TTL for data lifecycle hygiene** — unsaved recipe history entries carry a TTL. Deliberate data expiry is not an afterthought; it is part of the table design.

**Lambda as compute boundary** — Claude Vision calls and stream processors run in Lambda, not in Next.js API routes. `fable-vision-ingredient-scanner` handles the heavy Vision call in isolation; `fable-feedback-stream-processor` handles the stream. Keeps serverless functions lean and gives each concern its own scaling profile. The Next.js proxy route (`/api/scan-ingredients`) keeps the Lambda URL server-side so it can be rotated without a frontend deploy.

**API Gateway as Lambda entry point for Vision** — `fable-vision-ingredient-scanner` is invoked via an HTTP API Gateway endpoint rather than a Function URL. Keeps the invocation pattern consistent with standard AWS architecture, allows route-level configuration, and means the Lambda URL is rotatable without any frontend changes.

---

## Impact

- **250 million+** people worldwide live with food allergies
- **MCAS** affects an estimated 17% of the population, many with severely restricted diets
- **512** passing automated tests across 23 suites ensuring allergen safety and filter accuracy
- Existing recipe apps are built for abundance — Fable is built for restriction
- Safe Foods Mode is the only known consumer recipe tool that constrains generation to a user-defined safe ingredient list, with server-side validation to catch anything the model adds outside it
- Lactose intolerance include/exclude modes with medication reminders
- Macros are off by default — a deliberate decision for eating disorder recovery users

---

*Built with Epicure (Kaikaku AI), AWS DynamoDB, Anthropic Claude, and Vercel.*  
*H0 Hackathon submission — June 2026*
