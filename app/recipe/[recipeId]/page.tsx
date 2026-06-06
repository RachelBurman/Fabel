import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo } from '@/lib/dynamo'
import { type GeneratedRecipe } from '@/lib/types'
import { type Metadata } from 'next'
import Link from 'next/link'
import { Clock, Users, ShieldCheck, Leaf } from 'lucide-react'
import { RecipeGradient } from '@/components/recipe-gradient'
import { SharedDrinkPairings } from './shared-drink-pairings'

interface Props {
  params: Promise<{ recipeId: string }>
}

async function fetchSharedRecipe(recipeId: string): Promise<{ recipe: GeneratedRecipe; title: string; description: string } | null> {
  try {
    const result = await dynamo.send(new GetCommand({
      TableName: 'fable-recipe-shares',
      Key: { recipeId },
    }))
    if (!result.Item) return null
    return {
      recipe: result.Item.fullRecipe as GeneratedRecipe,
      title: result.Item.title as string,
      description: result.Item.description as string,
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { recipeId } = await params
  const data = await fetchSharedRecipe(recipeId)
  if (!data) {
    return { title: 'Recipe — Fable' }
  }
  return {
    title: `${data.title} — Fable`,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
    },
  }
}

function formatAmount(amount: number | string, unit: string): string {
  const WHOLE_UNITS = new Set([
    'piece', 'pieces', 'clove', 'cloves', 'fillet', 'fillets',
    'leaf', 'leaves', 'sprig', 'sprigs', 'stalk', 'stalks',
    'floret', 'florets', 'strip', 'strips', 'slice', 'slices',
    'wedge', 'wedges', 'ring', 'rings', 'chunk', 'chunks',
    'rasher', 'rashers', 'sheet', 'sheets',
  ])
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount))
  if (isNaN(n)) return String(amount)
  if (WHOLE_UNITS.has(unit.toLowerCase().trim())) return String(Math.round(n))
  return String(Math.round(n * 10) / 10)
}

export default async function SharedRecipePage({ params }: Props) {
  const { recipeId } = await params
  const data = await fetchSharedRecipe(recipeId)

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🍳</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Recipe no longer available</h1>
        <p className="text-muted-foreground max-w-sm mb-8">
          This recipe link has expired or been removed. Shared recipes are available for 90 days.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Open Fable
        </Link>
      </div>
    )
  }

  const { recipe } = data
  const ingredientNames = recipe.ingredients.map(i => i.name)

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* Hero */}
          <RecipeGradient title={recipe.title} className="w-full h-52 rounded-2xl">
            <div className="absolute inset-0 flex flex-col justify-end p-5">
              <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-1.5">Recipe</p>
              <h1 className="text-white text-xl md:text-2xl font-bold leading-snug text-balance drop-shadow">
                {recipe.title}
              </h1>
            </div>
          </RecipeGradient>

          <p className="text-muted-foreground leading-relaxed text-pretty">{recipe.description}</p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 border-y border-border text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{recipe.cookTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{recipe.servings} servings</span>
            </div>
            {recipe.allergenFree && (
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="w-4 h-4" />
                <span>Allergen safe</span>
              </div>
            )}
          </div>

          {/* Ingredients */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Ingredients</h2>
            <ul className="space-y-2.5">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-foreground">
                    <span className="font-medium">{formatAmount(ing.amount, ing.unit)} {ing.unit}</span>
                    {' '}{ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Method */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Method</h2>
            <ol className="space-y-5">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed pt-1">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Drink pairings — client component fetches on mount */}
          <SharedDrinkPairings ingredients={ingredientNames} />

          {/* Fable branding */}
          <div className="border-t border-border pt-8 pb-4 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-primary" />
              </div>
              <span className="text-lg font-semibold text-foreground">Fable</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Safe ingredients. Bold flavours. Food for everyone.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Generate your own recipe
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
