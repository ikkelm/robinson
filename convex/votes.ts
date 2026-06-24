import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const VOTES_PER_PLAYER = 2

export const listForCurrentRound = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId)
    if (!game) return []
    return await ctx.db
      .query('votes')
      .withIndex('by_game_round', (q) =>
        q.eq('game_id', gameId).eq('round', game.current_round)
      )
      .collect()
  }
})

export const submit = mutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    nameIds: v.array(v.id('names'))
  },
  handler: async (ctx, { gameId, playerId, nameIds }) => {
    if (nameIds.length !== VOTES_PER_PLAYER) {
      throw new Error(`Must submit exactly ${VOTES_PER_PLAYER} votes`)
    }
    const game = await ctx.db.get(gameId)
    if (!game) throw new Error('Game not found')
    if (game.status !== 'voting') throw new Error('Not accepting votes right now')

    // Prevent double-voting in same round
    const existing = await ctx.db
      .query('votes')
      .withIndex('by_player_round', (q) =>
        q.eq('player_id', playerId).eq('round', game.current_round)
      )
      .collect()
    if (existing.length > 0) {
      throw new Error('Already voted this round')
    }

    for (const nameId of nameIds) {
      await ctx.db.insert('votes', {
        game_id: gameId,
        player_id: playerId,
        name_id: nameId,
        round: game.current_round
      })
    }
  }
})
