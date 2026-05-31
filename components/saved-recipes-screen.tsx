'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Recipe, type Collection } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Clock, Users, Heart, Trash2, BookmarkX, Bookmark, ArrowLeft, FolderOpen, Plus, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RecipeGradient } from '@/components/recipe-gradient'
import { CollectionModal } from '@/components/collection-modal'

// ─── Saved recipe card ─────────────────────────────────────────────────────────

interface SavedRecipeCardProps {
  recipe: Recipe
  index: number
  onRemove: (id: string) => void
  onView: (recipe: Recipe) => void
  onAddToCollection?: (id: string) => void
  removeIcon?: 'trash' | 'x'
}

function SavedRecipeCard({ recipe, index, onRemove, onView, onAddToCollection, removeIcon = 'trash' }: SavedRecipeCardProps) {
  const canView = Boolean(recipe.fullRecipe)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      layout
      onClick={canView ? () => onView(recipe) : undefined}
      className={cn(
        'group bg-card border border-border rounded-2xl overflow-hidden transition-shadow duration-300',
        canView ? 'cursor-pointer hover:shadow-lg hover:border-primary/30' : ''
      )}
    >
      <RecipeGradient title={recipe.title} className="aspect-[4/3]">
        <div className="absolute bottom-0 inset-x-0 p-3">
          <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2 drop-shadow">
            {recipe.title}
          </h3>
        </div>

        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-sm text-white rounded-full">
          <Heart className="w-3.5 h-3.5 fill-current" />
          <span className="text-xs font-medium">Saved</span>
        </div>

        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {onAddToCollection && (
            <button
              onClick={e => { e.stopPropagation(); onAddToCollection(recipe.id) }}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/80 hover:bg-primary hover:text-white flex items-center justify-center transition-all duration-200"
              aria-label="Add to collection"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onRemove(recipe.id) }}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/80 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all duration-200"
            aria-label={removeIcon === 'trash' ? 'Remove recipe' : 'Remove from collection'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </RecipeGradient>

      <div className="p-5">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{recipe.description}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{recipe.cookTime}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{recipe.servings} servings</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Collection card ───────────────────────────────────────────────────────────

interface CollectionCardProps {
  collection: Collection
  previewRecipes: Recipe[]
  onClick: () => void
}

function CollectionCard({ collection, previewRecipes, onClick }: CollectionCardProps) {
  const count = collection.recipeIds.length
  const strips = previewRecipes.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all duration-300"
    >
      {/* Gradient strip preview */}
      <div className="aspect-[4/3] relative overflow-hidden flex">
        {strips.length === 0 ? (
          <div className="flex-1 bg-gradient-to-br from-secondary to-border/30 flex items-center justify-center">
            <Folder className="w-10 h-10 text-muted-foreground/40" />
          </div>
        ) : (
          strips.map((r, i) => (
            <RecipeGradient key={i} title={r.title} className="flex-1 h-full" />
          ))
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent flex flex-col justify-end p-4">
          <p className="text-white/70 text-xs font-medium mb-0.5">
            {count === 0 ? 'Empty' : `${count} recipe${count !== 1 ? 's' : ''}`}
          </p>
          <h3 className="text-white font-semibold text-sm leading-snug">{collection.name}</h3>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Collection detail ─────────────────────────────────────────────────────────

interface CollectionDetailProps {
  collection: Collection
  onBack: () => void
  onViewRecipe: (recipe: Recipe) => void
  onDelete: () => void
}

function CollectionDetail({ collection, onBack, onViewRecipe, onDelete }: CollectionDetailProps) {
  const { savedRecipes, removeFromCollection } = useFable()
  const recipes = savedRecipes.filter(r => collection.recipeIds.includes(r.id))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-foreground truncate">{collection.name}</h2>
          <p className="text-sm text-muted-foreground">
            {recipes.length === 0 ? 'No recipes' : `${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          aria-label="Delete collection"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {recipes.length > 0 ? (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {recipes.map((recipe, index) => (
              <SavedRecipeCard
                key={recipe.id}
                recipe={recipe}
                index={index}
                onRemove={id => removeFromCollection(collection.id, id)}
                onView={onViewRecipe}
                removeIcon="x"
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <FolderOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Collection is empty</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Go to All Saved and use the bookmark icon to add recipes here.
          </p>
        </motion.div>
      )}
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

interface SavedRecipesScreenProps {
  onBack: () => void
  onViewRecipe: (recipe: Recipe) => void
}

export function SavedRecipesScreen({ onBack, onViewRecipe }: SavedRecipesScreenProps) {
  const { savedRecipes, unsaveRecipe, collections, createCollection, deleteCollection } = useFable()

  const [activeTab, setActiveTab] = useState<'saved' | 'collections'>('saved')
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [collectionModalRecipeId, setCollectionModalRecipeId] = useState<string | null>(null)
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return
    createCollection(newCollectionName.trim())
    setNewCollectionName('')
    setIsCreatingCollection(false)
  }

  const handleDeleteCollection = (collection: Collection) => {
    deleteCollection(collection.id)
    if (selectedCollection?.id === collection.id) setSelectedCollection(null)
  }

  // Keep selectedCollection in sync when collections update
  const currentCollection = selectedCollection
    ? (collections.find(c => c.id === selectedCollection.id) ?? null)
    : null

  return (
    <div className="bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">

          {/* Collection detail view */}
          {currentCollection ? (
            <CollectionDetail
              collection={currentCollection}
              onBack={() => setSelectedCollection(null)}
              onViewRecipe={onViewRecipe}
              onDelete={() => handleDeleteCollection(currentCollection)}
            />
          ) : (
            <>
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Heart className="w-6 h-6 text-primary fill-primary" />
                  <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Saved Recipes</h1>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-8 w-fit">
                {(['saved', 'collections'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                      activeTab === tab
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab === 'saved' ? `All Saved${savedRecipes.length > 0 ? ` (${savedRecipes.length})` : ''}` : `Collections${collections.length > 0 ? ` (${collections.length})` : ''}`}
                  </button>
                ))}
              </div>

              {/* All Saved tab */}
              <AnimatePresence mode="wait">
                {activeTab === 'saved' && (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {savedRecipes.length > 0 ? (
                      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                          {savedRecipes.map((recipe, index) => (
                            <SavedRecipeCard
                              key={recipe.id}
                              recipe={recipe}
                              index={index}
                              onRemove={unsaveRecipe}
                              onView={onViewRecipe}
                              onAddToCollection={setCollectionModalRecipeId}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-16"
                      >
                        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                          <BookmarkX className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground mb-2">No saved recipes yet</h2>
                        <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                          When you find recipes you love, save them here for quick access later
                        </p>
                        <Button onClick={onBack} className="rounded-full">Find Recipes</Button>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Collections tab */}
                {activeTab === 'collections' && (
                  <motion.div
                    key="collections"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* New collection row */}
                    <div className="mb-6">
                      {isCreatingCollection ? (
                        <div className="flex gap-2 max-w-sm">
                          <input
                            autoFocus
                            type="text"
                            value={newCollectionName}
                            onChange={e => setNewCollectionName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCreateCollection(); if (e.key === 'Escape') setIsCreatingCollection(false) }}
                            placeholder="Collection name…"
                            className="flex-1 text-sm bg-card border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <Button size="sm" onClick={handleCreateCollection} disabled={!newCollectionName.trim()} className="rounded-xl">
                            Create
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setIsCreatingCollection(false); setNewCollectionName('') }} className="rounded-xl">
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCreatingCollection(true)}
                          className="rounded-full gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          New Collection
                        </Button>
                      )}
                    </div>

                    {collections.length > 0 ? (
                      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                          {collections.map(collection => {
                            const previewRecipes = savedRecipes.filter(r => collection.recipeIds.includes(r.id))
                            return (
                              <CollectionCard
                                key={collection.id}
                                collection={collection}
                                previewRecipes={previewRecipes}
                                onClick={() => setSelectedCollection(collection)}
                              />
                            )
                          })}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-16"
                      >
                        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                          <FolderOpen className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground mb-2">No collections yet</h2>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                          Create a collection to organise your saved recipes
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {/* Add to collection modal */}
      {collectionModalRecipeId && (
        <CollectionModal
          recipeId={collectionModalRecipeId}
          onClose={() => setCollectionModalRecipeId(null)}
        />
      )}
    </div>
  )
}
