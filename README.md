# Fable — Allergen-Aware Recipe Discovery

> Safe ingredients. Bold flavours. Food for everyone.

Fable is an allergen-aware recipe discovery app powered by Epicure — the largest multilingual food embedding model ever built (4.1M recipes, 7 languages, 1,790 ingredients). It uses ingredient embeddings to find flavour-matched pairings and generates novel, restaurant-quality recipes tailored to your dietary restrictions.

Built for the **H0 Hackathon** (AWS + Vercel, May–June 2026).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, Framer Motion |
| Auth | Better Auth (`better-auth`) — email/password; Neon Postgres for session/user storage |
| Deployment | Vercel |
| Database | AWS DynamoDB |
| Embeddings | Epicure Core (1,790 ingredients × 300 dimensions, cosine similarity) |
| Recipe generation | Anthropic Claude (`claude-sonnet-4-6`) with prompt caching; `claude-haiku-4-5` for recipe brief |
| Allergen data | EU Big 14 truth table — 1,790 ingredient classifications, O(1) lookup |
| Package manager | pnpm |
| Lambda | AWS Lambda (`nodejs24.x`) — DynamoDB Streams feedback processor · ingredient insights writer · Claude Vision ingredient scanner · Open Food Facts barcode scanner |
| Testing | Jest 29, ts-jest, React Testing Library — 716 tests across 42 suites; 35 Lambda tests (node:test) |

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

### Regenerating PWA icons

If you update `public/icons/fable-leaf.svg`, regenerate the PNG icons with either script:

```bash
# Node.js (requires sharp)
node scripts/generate-icons.mjs

# Python (requires cairosvg)
python scripts/generate-icons.py
```

Both produce `public/icons/icon-512.png`, `public/icons/icon-192.png`, and `public/apple-icon.png`.

### Environment Variables

| Variable | Description |
|---|---|
| `AWS_REGION` | AWS region (e.g. `eu-west-2`) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `ANTHROPIC_API_KEY` | Anthropic API key for recipe generation |
| `VISION_LAMBDA_URL` | API Gateway URL for the `fable-vision-ingredient-scanner` Lambda |
| `BARCODE_LAMBDA_URL` | API Gateway URL for the `fable-barcode-scanner` Lambda |
| `DATABASE_URL` | Neon Postgres connection string (used by Better Auth) |
| `NEXT_PUBLIC_APP_URL` | Public app URL (e.g. `https://v0-allergen-recipe-app.vercel.app`) — used by the Better Auth client |

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

### Guest vs Authenticated Mode
Fable is fully usable without an account — guests get a meaningful experience, with AI features unlocked on sign-in.

- **Always open (no account needed):** kitchen management, allergen/safe foods settings, Epicure ingredient search, community recipe browsing, drink pairings, substitute ingredient matching, Discover tab, recipe saving/liking, dark mode, onboarding tutorial
- **Requires sign-in:**
  - **Photo scanning** — camera icon in the kitchen search bar shows an inline prompt with a "Sign in" link for guests instead of opening the camera
  - **Macros toggle** — in Allergen Settings, tapping the toggle shows "Sign in to see nutritional information." inline for guests instead of enabling it
  - **Recipe brief** (`/api/recipe-brief`) — returns 401 for guests; guest recipe generation proceeds without the personalised direction brief
  - **Macro estimation** (`/api/macros`) — returns 401 for guests; macros section hidden for guest sessions
- **Modified for guests:**
  - **Recipe generation** — guests receive a community DB recipe (same as rate-limited users) with an amber "You're seeing a community recipe — Sign in to generate a personalised recipe with AI." banner; no rate limit consumed; no Claude call made; `RecipeBriefCard` not shown
  - **Substitute explanations** — Epicure similarity matching runs as normal; Claude explanation step is skipped; "Sign in to see why this substitution works." shown where the explanation would appear
- Auth overlay rendered via a portal in `FableAppContent`; opened from inline guest prompts; auto-closes on successful sign-in
- `AuthRequiredError` pattern in `lib/get-user-id.ts` — `requireAuth()` throws; callers catch and return `{ error: 'auth_required', message: '...' }` with status 401
- Anthropic spend protection: guest recipe generation costs nothing (DB fallback); guest substitute matching costs nothing (Epicure only)

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

### Barcode Scanning
- The same camera button that triggers photo recognition also auto-detects barcodes — no separate UI; the user never has to choose
- On image capture, the frontend runs `@zxing/browser` (`BrowserMultiFormatReader`) client-side first — works on iOS Safari, desktop Chrome, and Android Chrome (replaces the patchy native BarcodeDetector API)
- If a numeric EAN-8, EAN-13, UPC-A, or UPC-E barcode is found, the image is routed to `POST /api/scan-barcode` (Next.js proxy → `fable-barcode-scanner` Lambda) instead of the Vision Lambda
- `fable-barcode-scanner` validates the barcode (numeric, 8–14 digits; anything else rejected with 400), then calls the Open Food Facts API (`world.openfoodfacts.org/api/v0/product/${barcode}.json`) with a 5-second timeout
- Ingredient extraction prefers the structured `ingredients[]` array; falls back to splitting `ingredients_text` on commas and semicolons
- Each ingredient name is sanitised (alphanumeric + spaces only, max 100 chars) then run through the same three-tier Epicure fuzzy matching as the Vision Lambda: exact → singular-s → prefix → token-overlap
- Matched ingredients default to **Cupboard** storage area (packaged goods); the user can change area on the review screen as normal
- Non-barcode images fall through silently to the Vision Lambda — both paths produce identical `VisionResult` shape and flow into the same review screen
- Error paths: product not found → 404 (falls through to Vision); Open Food Facts timeout → 504; network error → 500; barcode API returns nothing → falls through to Vision
- Security rules enforced at the Lambda: only numeric barcode values are accepted; Open Food Facts is the only external call; ingredient names are sanitised before Epicure matching; no QR code URLs are ever followed

### Recipe Generation
- **Show Pairings** — Epicure similarity search surfaces safe, flavour-matched ingredients
- **Generate Recipe** — Two-step agentic flow: Claude Haiku reasons about taste history and writes a `RecipeBrief` (step 1), then Claude Sonnet generates the recipe guided by the brief (step 2)
- **Recipe Brief Card** — Shown during recipe generation: displays the dish direction, reasoning, novelty note, and rotating cooking hints. For guests or users with insufficient history, shows the default Fable loading hints
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
  - `recipePositives` and `recipeNegatives` aggregated by `buildPreferenceProfile`; signal strings appearing 2+ times converted to prompt clauses via `formatSignalsToClauses` → `RECIPE_SIGNAL_MAP` and injected as soft guidance (e.g. "Keep the method simple", "Keep cook time short")
  - Format signals also surfaced in the taste profile card as "Your preferences" chips with neutral display labels (e.g. `'Too complex'` → `'simpler recipes'`)
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

### Theme
- Three-way theme control: **Light**, **Auto** (follows OS `prefers-color-scheme`), **Dark**
- Header icon button cycles through all three modes (Sun → Moon → Monitor); full segmented control in Allergen Settings
- `colorMode: 'light' | 'dark' | 'system'` stored in DynamoDB, persisted across devices — replaces the old boolean `darkMode` field with automatic migration on first load
- `next-themes` `enableSystem={true}` drives the system mode; `defaultTheme="system"` for new users
- Full `dark:` variant support via Tailwind and the existing `.dark` CSS variable theme

### Recipe Sharing
- Every generated recipe has a stable share URL: `${APP_URL}/recipe/${recipeId}`
- **Share button** on every generated recipe card and history card — Share icon (lucide `Share2`) alongside the save/heart button
- Behaviour: `navigator.share` on mobile (native share sheet); clipboard copy + Sonner toast on desktop
- On share tap: recipe is written to `fable-recipe-shares` DynamoDB table (TTL 90 days) so the URL is publicly readable without an account
- **Shared recipe page** (`/recipe/[recipeId]`) — public, no auth required; renders the full recipe (gradient hero, title, description, ingredients, method, cook time, servings) plus drink pairings (no allergen filter applied since viewer's profile is unknown); disclaimer beneath pairings; Fable branding footer with a link to generate your own recipe
- Page metadata (`generateMetadata`) sets `<title>` and OpenGraph tags for rich link previews
- "Recipe no longer available" page shown when the share link has expired or was never created
- Guests and authenticated users both see the share button

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
- `onboardingComplete` flag also persisted to `fable-users` in DynamoDB for authenticated users — tutorial state carries across devices; on sign-in, `false` is written only if the `localStorage` flag is absent (no regression for users who have already seen it)
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

- **Your taste profile** — personalised card rendered once the user has 5+ feedback signals, showing: ingredients they love, ingredients they avoid, a flavour territory (2–4 ingredients from the intersection of their liked ingredients' embedding-space neighbours), and a "Your preferences" row of format signals that appear 2+ times (e.g. "simpler recipes", "shorter cook time"). Computed from `buildPreferenceProfile` + `deriveFlavourTerritory`
- **Trending for you** — top 3 recipe types (cuisine + occasion) trending for the user's allergen profile this week; tapping pre-fills the cuisine and occasion filters and navigates to the ingredient screen. When a user has ≥ 5 signals, each chip also injects their top 3 personally loved ingredient keys as a soft hint into recipe generation
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
  │  lib/barcode-scanner.ts — @zxing/browser BrowserMultiFormatReader runs client-side on every image
  │  Numeric EAN/UPC barcode detected → POST /api/scan-barcode
  │  No barcode (or detection fails)  → POST /api/scan-ingredients  (Vision path)
  │  Both paths produce identical VisionResult shape → same review screen
  │
  ▼
Vercel — Next.js 16 (App Router)
  │
  ├── /api/auth/[...all]         Better Auth — sign-in, sign-up, sign-out, session (Neon Postgres)
  ├── /api/ingredients           Epicure ingredient search (fuzzy, 1,790 items)
  ├── /api/recipes               Cosine similarity + allergen/safe-foods filter
  ├── /api/recipe-brief          Auth-gated · Claude Haiku taste-history reasoning → RecipeBrief (step 1)
  ├── /api/generate-recipe       Rate-limited · Claude Sonnet recipe generation + validation (step 2)
  │                              Guest/rate-limited → community DB fallback (no Claude call)
  ├── /api/drink-pairings        Epicure beverage similarity search + allergen filter (open)
  ├── /api/scan-ingredients      Auth-gated · rate-limited · thin proxy → fable-vision-ingredient-scanner
  │                              (image compressed client-side to JPEG ≤1200px before upload)
  ├── /api/scan-barcode          Auth-gated · rate-limited · thin proxy → fable-barcode-scanner
  │                              (barcode already extracted client-side; only the string is sent)
  ├── /api/feedback              Recipe like/dislike write + preference pattern retrieval
  ├── /api/substitutes           Epicure similarity + category scoring · Claude explanation (auth only)
  ├── /api/macros                Auth-gated · Claude Haiku on-demand macro estimation
  ├── /api/extract-ingredients   Claude ingredient extraction from arbitrary recipe text
  ├── /api/insights              1h-cached · allergen-profile trends + taste profile + suggestions
  ├── /api/recipe-share          POST write share record to fable-recipe-shares (90-day TTL)
  ├── /api/recipe-share/[id]     GET read share record (public, no auth)
  ├── /recipe/[recipeId]         Public shared recipe page — OG metadata, drink pairings, no auth
  └── /api/user/
       ├── profile               DynamoDB read/write (allergens, safe foods, ingredients, colorMode, …)
       ├── saved-recipes         DynamoDB read/write (full recipe objects + history)
       ├── collections           DynamoDB CRUD (GET, POST, PUT, DELETE)
       └── migrate-guest         One-time guest-to-auth data merge (POST, auth-gated)

External APIs (outbound from Lambda or Next.js route)
  ├── Anthropic Claude      claude-haiku-4-5 (Vision · brief · macros) · claude-sonnet-4-6 (recipes)
  │                         System prompt cached — ~90% cost reduction on repeated calls
  └── Open Food Facts       world.openfoodfacts.org/api/v0/product/{barcode}.json
                            Called by fable-barcode-scanner · 5s AbortController timeout
                            Only numeric EAN/UPC barcodes forwarded · no QR URLs ever followed

Auth (Neon Postgres — separate from DynamoDB)
  └── better-auth 1.2.7     Tables: user · session · account · verification
                            Email/password only · serverExternalPackages: ['pg', 'better-auth']

DynamoDB tables
  ├── fable-users              Per-user profile (allergens, safeIngredients, safeFoodsMode,
  │                            ingredients[]{name, displayName, subtype, quantity, unit,
  │                            area, dateType, useByDate, boughtDate, addedAt},
  │                            kitchenEquipment[], colorMode ('light'|'dark'|'system'),
  │                            preferenceSignals[], discoverSettings{}, visibleTabs[],
  │                            tasteProfile{}, needsRecompute, lastComputedAt)
  ├── fable-saved-recipes      Saved recipes + history (userId+recipeId PK·SK)
  │                            Saved: no TTL · Unsaved history: 90-day TTL
  ├── fable-recipe-shares      Public shares (recipeId PK, fullRecipe JSON, 90-day TTL)
  ├── fable-collections        Collections (userId+collectionId, name, recipeIds[], timestamps)
  ├── fable-rate-limits        Dual-window rate counters (userId PK, windowKey SK)
  │                            Atomic ADD via TransactWriteCommand · TTL auto-cleanup · fail-open
  ├── fable-feedback           Recipe feedback (userId+recipeId, liked, reasons, allergenProfile,
  │                            surveyResponse?{ingredientsHighlighted, ingredientsSkipped,
  │                              recipePositives, recipeNegatives}, timestamp)
  │                              │
  │                              ▼ DynamoDB Stream
  │                            AWS Lambda — fable-feedback-stream-processor
  │                              │  1. preferenceSignal per ingredient → fable-users (list_append)
  │                              │  2. likeCount per ingredient → fable-ingredient-insights
  │                              └─ 3. needsRecompute = "true" → fable-users (GSI entry point)
  └── fable-ingredient-insights  Aggregate trending data (allergenProfile PK + timeWindow SK)
                                  trendingIngredients[], trendingPairings[], trendingRecipeTypes[]
                                  Profiles: global · gluten-free · dairy-free · nut-free ·
                                            gluten-free#dairy-free · vegan · low-fodmap

AWS Lambda
  ├── fable-feedback-stream-processor   DynamoDB Stream → preference signals + ingredient insights
  │                                      + needsRecompute flag (nodejs24.x · CJS)
  ├── fable-taste-profile-writer        EventBridge every 6h → needsRecompute-lastComputedAt-index GSI
  │                                      → drift-aware profile (all-time vs recent-10 diff)
  │                                      → Claude Haiku 2-3 recipe suggestions → tasteProfile on fable-users
  │                                      (nodejs24.x · CJS)
  ├── fable-vision-ingredient-scanner   API Gateway POST /scan-ingredients
  │                                      → Claude Vision Haiku 4.5 (image analysis + storage area inference)
  │                                      → three-tier Epicure matching (exact · prefix · token-overlap)
  │                                      → { inferredArea, areaConfident, ingredients[] }
  │                                      (nodejs24.x · CJS · 30s timeout)
  └── fable-barcode-scanner             API Gateway POST /scan-barcode
                                         → Open Food Facts API (5s AbortController timeout)
                                         → ingredient extraction (structured array → text fallback)
                                         → sanitise (alphanumeric + spaces · max 100 chars)
                                         → three-tier Epicure matching (same logic as Vision Lambda)
                                         → { inferredArea: 'cupboard', areaConfident: true, ingredients[] }
                                         (nodejs24.x · CJS · 10s timeout · no npm deps)

Shared server-side libs
  ├── lib/preference-profile.ts  buildPreferenceProfile — DynamoDB query + computePreferenceProfile
  │                              + survey merge + aggregateFormatSignals; called by /api/generate-recipe,
  │                              /api/recipe-brief, and /api/insights
  ├── lib/flavour-territory.ts   deriveFlavourTerritory — cosine-similarity neighbour overlap
  │                              for taste-space anchor ingredients
  ├── lib/survey-signals.ts      formatSignalsToClauses — signal keys → Claude prompt clauses
  │                              via RECIPE_SIGNAL_MAP
  └── lib/vision-scanner.ts      matchToEpicureKey · buildReviewIngredients · buildKitchenIngredients
                                  shared by scan-ingredients route and the review screen

Client-side libs
  └── lib/barcode-scanner.ts     detectBarcodeFromFile — @zxing/browser BrowserMultiFormatReader
                                  EAN-8 · EAN-13 · UPC-A · UPC-E · numeric-only guard
                                  Returns barcode string or null · never throws · always falls through

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
- ✅ Dark mode → Theme — 3-way toggle (Light / Auto / Dark) in header and allergen settings; `colorMode` persisted to DynamoDB; backward-migration from old boolean `darkMode` field
- ✅ Onboarding tutorial slideshow — 5-slide overlay on first launch, re-launchable from settings; `onboardingComplete` persisted to DynamoDB for authenticated users so tutorial state carries across devices
- ✅ DynamoDB Streams + Lambda (`fable-feedback-stream-processor`) — real-time `preferenceSignals` written to `fable-users` on every feedback write; deployed on `nodejs24.x`; 6 unit tests
- ✅ Guest mode indicator — persistent header badge showing save-state context; tapping opens a popover explaining browser-local persistence. UUID persists in `localStorage['fable_user_id']` until the user signs in, at which point guest data is migrated to the authenticated account automatically
- ✅ `fable-ingredient-insights` table — aggregate trending data by allergen profile; seeded with 14 realistic records across 7 profiles × 2 time windows
- ✅ Discover tab — dedicated nav tab (Compass icon) between Recipe and Substitutes; Trending for you, Trending globally, Most loved, Trending pairings; each sub-section individually toggleable in settings
- ✅ Tab visibility settings — hide/show individual nav tabs (incl. Discover); min 2 enforced; persisted to DynamoDB. Supersedes the earlier plan to consolidate to 4 tabs: user-controlled visibility is a more flexible solution than hardcoding a merged "Explore" tab
- ✅ Lambda extended — liked feedback events now also write to `fable-ingredient-insights` (non-fatal); allergenProfile stored per feedback record
- ✅ `/api/insights` route — 1-hour cached; returns profile + global trending data
- ✅ 477 passing tests across 21 test suites
- ✅ Responsive navigation — fixed 220 px left sidebar on desktop (≥ 768 px) with Fable wordmark; bottom tab bar on mobile; same active-state and theming at both breakpoints
- ✅ **Feedback survey** — optional 4-section chip panel after every thumbs up/down; PATCH `/api/feedback` persists `surveyResponse` (all four fields: `ingredientsHighlighted`, `ingredientsSkipped`, `recipePositives`, `recipeNegatives`); ingredient signals weighted 1.5×; recipe format signals threshold-gated at 2+ appearances; 18 new tests (495 total across 22 suites)
- ✅ **Photo ingredient recognition** — camera icon in kitchen tab; Claude Vision (Haiku 4.5) via `fable-vision-ingredient-scanner` Lambda identifies ingredients and infers storage area; fuzzy Epicure key matching with confidence flagging; full review screen with area editing, uncertain badges, and duplicate deselection; Sonner toast notifications; 17 new tests (512 total across 23 suites)
- ✅ **Personal taste profile + personalised discover chips** — `buildPreferenceProfile` shared utility (DynamoDB query + preference scoring + survey merge in one call); `deriveFlavourTerritory` for embedding-space flavour neighbours; taste profile card on Discover (loved · avoided · flavour territory · your preferences) shown at ≥ 5 signals; Trending for you chips carry `seedIngredients` (top 3 liked ingredient keys) injected as a soft prompt hint into recipe generation; 20 new tests (532 total across 25 suites)
- ✅ **Format signal injection** — `recipePositives` + `recipeNegatives` from survey now flow through `buildPreferenceProfile` → `aggregateFormatSignals` (2+ appearance threshold) → `formatSignalsToClauses` → Claude prompt; same signals surface in the taste profile card as "Your preferences" chips with neutral display labels via `SIGNAL_DISPLAY_LABELS`; 5 new tests (538 total across 25 suites)
- ✅ **Agentic two-step recipe generation** — `/api/recipe-brief` (Claude Haiku 4.5) reasons over taste history and returns a `RecipeBrief` (dish direction, reasoning, novelty note, loading hints); `/api/generate-recipe` (Claude Sonnet) receives the brief as creative direction; brief fetch and Epicure pairings run in parallel; brief card replaces the loading spinner during recipe generation; falls back gracefully to guest hints on error or insufficient history; 26 new tests (564 total across 27 suites)
- ✅ **Agentic taste profile evolution** — `fable-taste-profile-writer` Lambda (EventBridge, every 6h) queries the `needsRecompute-lastComputedAt-index` GSI for eligible users, runs `computeDriftAwareProfile` (all-time vs. recent-10 diff for emerging/fading signals), calls Claude Haiku to generate 2-3 proactive recipe direction suggestions, and writes a `StoredTasteProfile` to `fable-users`; `fable-feedback-stream-processor` now sets `needsRecompute = "true"` and initialises `lastComputedAt` on every feedback write; `/api/insights` reads the stored profile when fresh (skips live `buildPreferenceProfile` call) and returns `recipeSuggestions`; Discover tab surfaces suggestions as tappable direction cards — tapping one skips the `/api/recipe-brief` call and uses the pre-computed direction directly; 11 new Jest tests + 12 Lambda tests (575 Jest + 12 node:test)
- ✅ **Rate limiting with community recipe fallback** — new `fable-rate-limits` DynamoDB table (PK: userId, SK: windowKey, atomic ADD counters, TTL auto-cleanup); `lib/rate-limiter.ts` checks and increments dual-window (hour + day) counters via `TransactWriteCommand` (single atomic call, race-condition safe); fail-open on DynamoDB errors; guest limits 10/hour 30/day, auth stubs defined (50/200); `/api/generate-recipe` returns HTTP 200 with `rateLimited: true` + best-matching community recipe rather than a hard error; `lib/community-recipe-fallback.ts` scans `fable-saved-recipes` with allergen/safe-foods hard filter + preference scoring, falls back to 15 pre-seeded allergen-free community recipes; all other rate-limited routes return 429; amber banner in recipe screen, inline messages in substitutes/scan; 40 new tests (617 Jest total across 30 suites)
- ✅ **Better Auth + guest migration** — Custom email/password auth via `better-auth` with Neon Postgres for session/user storage; replaces Clerk entirely. Guest pill in the header: signed-out users see a custom sign-in/sign-up form (name, email, password; toggle between modes; inline errors; loading state); signed-in users see their name, avatar initial, and a sign-out button. All API routes use `lib/get-user-id.ts` — server reads Better Auth session first, falls back to guest UUID from the request if unauthenticated. On first sign-in from a device, `POST /api/user/migrate-guest` merges the guest UUID data into the auth account: allergens and safeIngredients are unioned, kitchen ingredients deduplicated by epicureKey (auth wins on conflict), preferenceSignals appended, auth record wins for discoverSettings/visibleTabs/tasteProfile; feedback, saved recipes, and collections are copied over. Migration fires once per device via `localStorage['fable-guest-migrated']`; success shows a Sonner toast. Neon tables (`user`, `session`, `account`, `verification`) created via `pnpm dlx @better-auth/cli migrate`. `better-auth/react` not used — it calls `React.useRef` at module-init time and crashes Next.js static prerendering; replaced with a direct HTTP client calling `/api/auth/*` endpoints. `better-auth` pinned to `1.2.7` (1.6.x has a broken kysely adapter export). `serverExternalPackages: ['pg', 'better-auth']` added to `next.config.mjs`. No new tests — 637 Jest total across 33 suites maintained. Key engineering decision: Postgres for relational auth (sessions, users), DynamoDB for all app data — right tool for the right job.
- ✅ **Auth-gated Claude routes + guest DB-only mode** — `/api/scan-ingredients`, `/api/macros`, and `/api/recipe-brief` now return 401 for unauthenticated requests via `requireAuth()` + `AuthRequiredError` pattern in `lib/get-user-id.ts`. `/api/generate-recipe` returns a community DB fallback with `guestMode: true` for guests (no Claude call, no rate limit consumed). `/api/substitutes` skips the Claude explanation step for guests. Frontend: camera button shows inline "Sign in" prompt for guests; macros toggle in Settings shows "Sign in to see nutritional information."; recipe screen shows a warm amber "community recipe" banner for guest mode; substitute cards show "Sign in to see why this substitution works." in place of explanations; tutorial slide 4 updated to mention guest mode. Auth overlay portal in `FableAppContent` (opens from inline prompts, auto-closes on sign-in). 10 new tests (637 Jest total across 33 suites)
- ✅ **Recipe sharing** — every generated recipe has a public share URL (`/recipe/${recipeId}`); Share button on recipe cards and history entries; `navigator.share` on mobile, clipboard copy + Sonner toast on desktop; `fable-recipe-shares` DynamoDB table (PK: recipeId, 90-day TTL); shared page renders full recipe with drink pairings (no allergen filter) and Fable branding footer; `generateMetadata` for OG link previews; available to guests and authenticated users alike; `handleViewHistoryRecipe` and `handleViewSavedRecipe` fixed to carry the original stable recipeId through to the share URL. 5 new tests (714 Jest total across 42 suites)
- ✅ **3-way theme toggle** — replaced boolean `darkMode` toggle with `colorMode: 'light' | 'dark' | 'system'`; header button cycles through all three modes (Sun → Moon → Monitor); full segmented control (Light · Auto · Dark) in Allergen Settings; `next-themes` `enableSystem={true}` + `defaultTheme="system"` for new users; automatic migration of legacy boolean `darkMode` field on first GET; `colorMode` persisted to DynamoDB. 2 new tests (714 Jest total)
- ✅ **Barcode scanning** — same camera button auto-routes to `fable-barcode-scanner` Lambda when a numeric EAN/UPC barcode is detected client-side via `@zxing/browser` (cross-platform: iOS Safari, desktop Chrome, Android Chrome); Lambda queries Open Food Facts, extracts and sanitises ingredient names, runs three-tier Epicure fuzzy matching identical to the Vision Lambda, returns `inferredArea: cupboard`; non-barcode images fall through silently to Vision; same review screen for both paths; security rules enforced at Lambda (numeric-only barcodes, sanitised names, no QR URL following); `@zxing/browser` replaces the patchy native `BarcodeDetector` API. 7 new tests (716 Jest total across 42 suites + 23 Lambda tests)
- ✅ **Substitution engine — role-aware context scoring** — three improvements to the scoring logic and Claude prompt, all contained to `/api/substitutes`: (1) co-ingredient hard exclusion drops any candidate whose Epicure key exactly matches a key already in the dish context (pasta cannot substitute for cheese in a pasta bake); (2) relative co-ingredient penalty replaces the fixed context-fit weight — when `averageContextFit > similarityToOriginal + 0.15` a −0.2 penalty applies instead of the context contribution (self-calibrating against the embedding space rather than a fixed threshold, no cliff artefact at the boundary); formula rebalanced to `0.6 × similarity + (0.3 × contextFit or −0.2 co-ingredient penalty) + category adj`; (3) role-aware Claude prompt instructs Haiku to reason about the ingredient's functional role in the specific dish (fat, protein, binding, acidity, texture, or flavour) before explaining each substitute — explanations are now dish-specific rather than generic ingredient comparisons. No changes to API shape, response format, frontend, DynamoDB, allergen filtering, Safe Foods Mode, or guest/auth behaviour.
- ✅ **Demo seed accounts** — Maya (`maya@demo.fable.app`) and Seren (`seren@demo.fable.app`); seeded via `pnpm seed:demo`; Maya demonstrates allergen filtering (gluten + dairy) with full preference history; Seren demonstrates Safe Foods Mode with a 10-ingredient restricted diet.

### In Progress
- 🔄 Spice tolerance onboarding — preference question during onboarding, persisted to `fable-users`, injected into recipe generation prompt

### Near Term
- [ ] "Why is this safe?" explainer — Claude Haiku call explaining in plain English why a recipe or ingredient is safe for the user's specific allergen profile; trust feature for severe allergy and MCAS users
- [ ] **Editable brief direction** — `direction` field editable after brief card appears; user nudges it before generation fires, brief re-sent as updated creative direction
- [ ] High histamine preset — dietary filter excluding known high-histamine ingredients; same pattern as existing vegan/low-FODMAP presets; framed as a filter, not a medical tool, with disclaimer
- [ ] **Multi-turn brief refinement** — "go vegetarian instead" updates direction and regenerates; brief card animates to new direction
- [ ] i18n framework — next-intl, English + Spanish for hackathon; architecture supports Epicure's 7 languages; UI strings only (recipe output language is post-hackathon)
- [ ] Mobile scrolling bugs — batch fix

### Post-Hackathon / Future
- ✅ User authentication — shipped. Email/password via Better Auth 1.2.7, Neon Postgres for session storage, guest mode via UUID fallback, guest data migrated on first sign-in.
- [ ] Better Auth + AWS RDS Postgres — replace Neon with RDS for a full AWS architecture story; schema identical, connection string swap
- [ ] Social auth (Google + GitHub) — Better Auth config ready, Neon schema ready; needs OAuth app setup
- [ ] Latency reduction on `/api/recipe-brief` — on-device AI when PWA limitations are resolved
- [ ] GSI least-privilege IAM — tighter custom policy scoped to specific table ARNs
- [ ] Lambda cold start optimisation for Vision
- [ ] Multilingual recipe output — UI i18n ships for hackathon; recipe generation in user's language is post-hackathon
- [ ] Native mobile app (React Native) — enables camera/barcode features natively; requires App Store and Play Store accounts

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
- **716** passing automated tests across 42 suites (+ 35 Lambda tests) ensuring allergen safety and filter accuracy
- Existing recipe apps are built for abundance — Fable is built for restriction
- Safe Foods Mode is the only known consumer recipe tool that constrains generation to a user-defined safe ingredient list, with server-side validation to catch anything the model adds outside it
- Lactose intolerance include/exclude modes with medication reminders
- Macros are off by default — a deliberate decision for eating disorder recovery users

---

*Built with Epicure (Kaikaku AI), AWS DynamoDB, Anthropic Claude, and Vercel.*  
*H0 Hackathon submission — June 2026*
