import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { Doc, Id } from './_generated/dataModel'
// @ts-ignore – plain JS module with no types
import { resolveElimination, eliminationCountFor } from '../src/lib/gameLogic.js'

const VOTES_PER_PLAYER = 2

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.insert('games', {
      status: 'lobby',
      current_round: 1
    })
  }
})

export const get = query({
  args: { id: v.id('games') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  }
})

export const startGame = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => {
    await ctx.db.patch(gameId, { status: 'voting', current_round: 1 })
  }
})

export const nextRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => {
    const g = await ctx.db.get(gameId)
    if (!g) throw new Error('Game not found')
    await ctx.db.patch(gameId, {
      status: 'voting',
      current_round: g.current_round + 1,
      tiebreak_name_ids: undefined,
      tiebreak_slots: undefined
    })
  }
})

export const closeRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId)
    if (!game) throw new Error('Game not found')
    if (game.status !== 'voting') throw new Error(`Cannot close round in status ${game.status}`)

    const isTiebreak = Boolean(game.tiebreak_name_ids?.length)

    const allNames = await ctx.db
      .query('names')
      .withIndex('by_game', (q) => q.eq('game_id', gameId))
      .collect()

    const candidatePool: Doc<'names'>[] = isTiebreak
      ? allNames.filter((n) => game.tiebreak_name_ids!.includes(n._id))
      : allNames.filter((n) => !n.eliminated)

    const eliminateCount: number = isTiebreak
      ? game.tiebreak_slots || 1
      : eliminationCountFor(candidatePool.length)

    const votes = await ctx.db
      .query('votes')
      .withIndex('by_game_round', (q) =>
        q.eq('game_id', gameId).eq('round', game.current_round)
      )
      .collect()

    // Pass Convex docs to the shared logic. It only reads `.id`-like fields,
    // so adapt to { id, ... } shape.
    const candidates = candidatePool.map((n) => ({ id: n._id, ...n }))
    const votesForLogic = votes.map((v) => ({
      name_id: v.name_id,
      player_id: v.player_id
    }))

    const result: {
      eliminated: Id<'names'>[]
      tiebreak: Id<'names'>[] | null
      tiebreakSlots: number
    } = resolveElimination(candidates, votesForLogic, eliminateCount, isTiebreak)

    // Apply confirmed eliminations
    for (const id of result.eliminated) {
      await ctx.db.patch(id, {
        eliminated: true,
        eliminated_round: game.current_round
      })
    }

    // Accumulate across a tiebreak chain so every elimination gets the
    // dramatic reveal — even ones that happened in a "skipped" sub-round.
    const previouslyAccumulated = isTiebreak ? (game.last_eliminated_ids || []) : []
    const accumulatedEliminations = [...previouslyAccumulated, ...result.eliminated]

    if (result.tiebreak && result.tiebreak.length > 0) {
      await ctx.db.patch(gameId, {
        status: 'voting',
        current_round: game.current_round + 1,
        tiebreak_name_ids: result.tiebreak,
        tiebreak_slots: result.tiebreakSlots,
        last_eliminated_ids: accumulatedEliminations
      })
      return
    }

    const allActive = allNames.filter(
      (n) => !n.eliminated && !result.eliminated.includes(n._id)
    )

    if (allActive.length <= 1) {
      await ctx.db.patch(gameId, {
        status: 'finished',
        tiebreak_name_ids: undefined,
        tiebreak_slots: undefined,
        last_eliminated_ids: accumulatedEliminations,
        winner_name_id: allActive[0]?._id
      })
    } else {
      await ctx.db.patch(gameId, {
        status: 'result',
        tiebreak_name_ids: undefined,
        tiebreak_slots: undefined,
        last_eliminated_ids: accumulatedEliminations
      })
    }
  }
})
