import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const listByGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => {
    const rows = await ctx.db
      .query('players')
      .withIndex('by_game', (q) => q.eq('game_id', gameId))
      .collect()
    return rows.sort((a, b) => a._creationTime - b._creationTime)
  }
})

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query('players')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique()
  }
})

export const add = mutation({
  args: {
    gameId: v.id('games'),
    name: v.string(),
    token: v.string()
  },
  handler: async (ctx, { gameId, name, token }) => {
    const existing = await ctx.db
      .query('players')
      .withIndex('by_game', (q) => q.eq('game_id', gameId))
      .collect()
    const isAdmin = existing.length === 0
    return await ctx.db.insert('players', {
      game_id: gameId,
      name,
      token,
      is_admin: isAdmin
    })
  }
})

export const remove = mutation({
  args: { id: v.id('players') },
  handler: async (ctx, { id }) => {
    const p = await ctx.db.get(id)
    if (p?.is_admin) throw new Error('Cannot remove admin')
    await ctx.db.delete(id)
  }
})
