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

## Features

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
- **Use my kitchen only** toggle — constrains recipe generation to exactly the ingredients added; skips Epicure pairings and adds a hard prompt constraint so Claude adds nothing extra
- Ingredient list persisted in DynamoDB with debounced auto-save; old string-array profiles migrated automatically

### Recipe Generation
- **Show Pairings** — Epicure similarity search surfaces safe, flavour-matched ingredients
- **Generate Recipe** — Claude generates novel, restaurant-quality recipes
- Ingredients sorted by expiry date (ascending) before being passed to Claude — expiring items get used first
- Claude receives rich descriptions (e.g. `"2 pieces Chicken Breast (Epicure: chicken)"`) for cut-accurate recipes
- Recipes respect allergen profile, meal type, and cook time
- Prompt caching on the system prompt (~90% cost reduction on repeated calls)
- Food-themed gradient hero on every recipe card with title-hash colour variation across five palettes

### Safe Foods Mode
For users with MCAS, severe allergies, or highly restricted therapeutic diets.

- User builds an explicit list of every ingredient they can safely eat
- Recipe generation is strictly constrained to that list — no unlisted ingredients, substitutions, or garnishes
- Post-generation validation strips any ingredient Claude included outside the safe list
- If no liquid is in the safe list, Claude uses the placeholder `"liquid of choice"` with an in-step note; same for salt/seasoning
- Quick-add chips on the ingredient screen switch to the user's safe foods list
- Mode indicator badge in the app header; toggle in allergen settings
- Safe ingredients and mode preference persisted in DynamoDB

### Navigation & History
- Four-tab navigation — Ingredients, Recipe, History, Saved
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
  └── /api/user/
       ├── profile             DynamoDB read/write (allergens, safe foods, ingredients)
       └── saved-recipes       DynamoDB read/write (full recipe objects)

DynamoDB tables
  ├── fable-users              Per-user profile (allergens, safeIngredients, safeFoodsMode,
  │                            ingredients[]{name, displayName, subtype, quantity, unit,
  │                            area, dateType, useByDate, boughtDate, addedAt})
  └── fable-saved-recipes      Saved recipes with full recipe JSON

In-memory (loaded at server startup)
  ├── Epicure Core embeddings  1,790 × 300 float32 — cosine similarity search
  └── Allergen truth table     1,790 ingredient classifications — O(1) lookup
```

---

## In Progress

- [ ] Collections — organise saved recipes into named collections
- [ ] Drink pairings — Epicure-powered beverage suggestions matched to the recipe's flavour profile
- [ ] Macros toggle — opt-in nutritional information (off by default, eating disorder recovery users in mind)

---

## Roadmap

### Near Term
- [ ] Ingredient substitutes mode — paste any recipe, get allergen-safe ingredient swaps
- [ ] Diet restriction presets — vegan, vegetarian, keto, low-FODMAP
- [ ] Medication flags — e.g. "take Lactaid before eating this" for lactose intolerance
- [ ] High histamine preset — for MCAS users who react to histamine-rich foods

### Medium Term
- [ ] Recipe cost calculator — grocery API integration (Tesco, Sainsbury's, Kroger)
- [ ] Recipe sharing — share generated recipes with a link
- [ ] Food waste dashboard — track expiring ingredients and log waste saved
- [ ] Push notifications — alerts for ingredients expiring soon

### Research & Future
- [ ] Epicure Chem integration — chemical compound layer for cross-reactivity research
- [ ] Medical nutrition database — elemental formulas and medical-grade substitutes for severe MCAS
- [ ] FALCPA and Monash University FODMAP data integration
- [ ] Multilingual UI — Epicure supports 7 languages
- [ ] AI-generated recipe photography

---

## Impact

- **250 million+** people worldwide live with food allergies
- **MCAS** affects an estimated 17% of the population, many with severely restricted diets
- Existing recipe apps are built for abundance — Fable is built for restriction
- Safe Foods Mode is the only known consumer recipe tool that constrains generation to a user-defined safe ingredient list, with server-side validation to catch anything the model adds outside it
- Macros are off by default — a deliberate decision for eating disorder recovery users

---

*Built with Epicure (Kaikaku AI), AWS DynamoDB, Anthropic Claude, and Vercel.*  
*H0 Hackathon submission — June 2026*
