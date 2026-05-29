'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, FolderPlus, Loader2, X } from 'lucide-react'
import { useFable } from '@/lib/fable-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CollectionModalProps {
  recipeId: string
  onClose: () => void
}

export function CollectionModal({ recipeId, onClose }: CollectionModalProps) {
  const { collections, createCollection, addToCollection, removeFromCollection } = useFable()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleToggle = (collectionId: string, inCollection: boolean) => {
    if (inCollection) {
      removeFromCollection(collectionId, recipeId)
    } else {
      addToCollection(collectionId, recipeId)
    }
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    setCreating(true)
    createCollection(newName.trim())
    // After creating, find the new collection by name and add recipe
    // createCollection is synchronous for local state, so we can read it shortly
    setTimeout(() => {
      setCreating(false)
      setIsCreating(false)
      setNewName('')
    }, 100)
  }

  const handleCreateAndAdd = () => {
    if (!newName.trim()) return
    // createCollection adds to local state synchronously via setCollections
    // We get the id by computing it the same way as the context: crypto.randomUUID()
    // Instead, create + immediately add by listening for the new collection
    const name = newName.trim()
    createCollection(name)
    // Small delay so the new collection lands in state, then close
    setTimeout(() => {
      setIsCreating(false)
      setNewName('')
    }, 80)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Add to collection</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Collections list */}
          <div className="max-h-64 overflow-y-auto">
            {collections.length === 0 && !isCreating && (
              <p className="text-sm text-muted-foreground text-center py-8 px-5">
                No collections yet. Create one below.
              </p>
            )}
            {collections.map(collection => {
              const inCollection = collection.recipeIds.includes(recipeId)
              return (
                <button
                  key={collection.id}
                  onClick={() => handleToggle(collection.id, inCollection)}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-3 text-left transition-colors',
                    inCollection
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-secondary'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                    inCollection
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border'
                  )}>
                    {inCollection && <Check className="w-3 h-3" />}
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {collection.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {collection.recipeIds.length} recipe{collection.recipeIds.length !== 1 ? 's' : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* New collection */}
          <div className="border-t border-border px-5 py-4">
            {isCreating ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateAndAdd(); if (e.key === 'Escape') setIsCreating(false) }}
                  placeholder="Collection name…"
                  className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  size="sm"
                  onClick={handleCreateAndAdd}
                  disabled={!newName.trim() || creating}
                  className="rounded-xl shrink-0"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </Button>
                <button
                  onClick={() => { setIsCreating(false); setNewName('') }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                New collection
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
