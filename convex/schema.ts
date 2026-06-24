import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  games: defineTable({
    status: v.union(
      v.literal('lobby'),
      v.literal('voting'),
      v.literal('result'),
      v.literal('finished')
    ),
    current_round: v.number(),
    tiebreak_name_ids: v.optional(v.array(v.id('names'))),
    tiebreak_slots: v.optional(v.number()),
    last_eliminated_ids: v.optional(v.array(v.id('names'))),
    winner_name_id: v.optional(v.id('names'))
  }),

  names: defineTable({
    game_id: v.id('games'),
    name: v.string(),
    eliminated: v.boolean(),
    eliminated_round: v.optional(v.number())
  }).index('by_game', ['game_id']),

  players: defineTable({
    game_id: v.id('games'),
    name: v.string(),
    token: v.string(),
    is_admin: v.boolean()
  })
    .index('by_game', ['game_id'])
    .index('by_token', ['token']),

  votes: defineTable({
    game_id: v.id('games'),
    player_id: v.id('players'),
    name_id: v.id('names'),
    round: v.number()
  })
    .index('by_game_round', ['game_id', 'round'])
    .index('by_player_round', ['player_id', 'round'])
})
