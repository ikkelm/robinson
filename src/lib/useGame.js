import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

// One hook that fans out to the four queries we need for a game.
// Convex pushes updates over WebSocket — no polling, no subscription setup.
export function useGame(gameId) {
  const args = gameId ? { gameId } : 'skip'
  const game = useQuery(api.games.get, gameId ? { id: gameId } : 'skip')
  const names = useQuery(api.names.listByGame, args) ?? []
  const players = useQuery(api.players.listByGame, args) ?? []
  const votes = useQuery(api.votes.listForCurrentRound, args) ?? []

  const loading = game === undefined
  return { game, names, players, votes, loading }
}
