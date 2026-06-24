import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const listByGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => {
    const rows = await ctx.db
      .query('names')
      .withIndex('by_game', (q) => q.eq('game_id', gameId))
      .collect()
    return rows.sort((a, b) => a._creationTime - b._creationTime)
  }
})

export const add = mutation({
  args: { gameId: v.id('games'), name: v.string() },
  handler: async (ctx, { gameId, name }) => {
    return await ctx.db.insert('names', {
      game_id: gameId,
      name,
      eliminated: false
    })
  }
})

export const remove = mutation({
  args: { id: v.id('names') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  }
})
