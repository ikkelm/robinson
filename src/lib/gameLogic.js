// Pure game logic. No Supabase calls — easier to reason about and test.

export function generateToken(len = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I confusion
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

// Returns { totals: {nameId: count}, voters: {nameId: Set<playerId>}, playersVoted: Set<playerId> }
export function tallyVotes(votes) {
  const totals = {}
  const voters = {}
  const playersVoted = new Set()
  for (const v of votes) {
    totals[v.name_id] = (totals[v.name_id] || 0) + 1
    if (!voters[v.name_id]) voters[v.name_id] = new Set()
    voters[v.name_id].add(v.player_id)
    playersVoted.add(v.player_id)
  }
  return { totals, voters, playersVoted }
}

// How many vote slots a single player has cast this round.
export function playerVoteCount(votes, playerId) {
  return votes.filter((v) => v.player_id === playerId).length
}

// Returns the set of player_ids who have cast all `votesPerPlayer` votes.
export function playersWithFullVotes(votes, votesPerPlayer = 2) {
  const counts = {}
  for (const v of votes) counts[v.player_id] = (counts[v.player_id] || 0) + 1
  return new Set(
    Object.entries(counts)
      .filter(([, n]) => n >= votesPerPlayer)
      .map(([id]) => id)
  )
}

/**
 * Determine elimination for a round.
 *
 * @param {Array} candidateNames  Names that are eligible to be eliminated this round (active or in a tiebreak pool).
 * @param {Array} votes            Vote rows for this round (already filtered to round + game).
 * @param {number} eliminateCount  How many names to eliminate.
 * @param {boolean} allowRandomFallback  If true, ties that survive both steps are resolved with random. If false, a tiebreak revote is requested.
 *
 * @returns {{ eliminated: string[], tiebreak: string[] | null, tiebreakSlots: number }}
 *   - eliminated: name ids definitively eliminated
 *   - tiebreak:   name ids that need a revote (null if none)
 *   - tiebreakSlots: how many of the tiebreak names should be eliminated after the revote
 */
export function resolveElimination(candidateNames, votes, eliminateCount, allowRandomFallback = false) {
  if (eliminateCount <= 0 || candidateNames.length === 0) {
    return { eliminated: [], tiebreak: null, tiebreakSlots: 0 }
  }
  // Don't eliminate more than candidates - 1 (must leave at least one survivor in the pool)
  // — except when we're at the final round and there must be exactly one winner.
  // Caller is responsible for clamping `eliminateCount` appropriately.

  const { totals, voters } = tallyVotes(votes)
  const total = (n) => totals[n.id] || 0
  const uniq = (n) => (voters[n.id] ? voters[n.id].size : 0)

  // Sort by total votes ascending (lowest first → most-eliminated first)
  const sorted = [...candidateNames].sort((a, b) => total(a) - total(b))
  const cutoff = total(sorted[Math.min(eliminateCount, sorted.length) - 1])
  const definitelyEliminated = sorted.filter((n) => total(n) < cutoff).map((n) => n.id)
  const atCutoff = sorted.filter((n) => total(n) === cutoff)
  const slotsLeft = eliminateCount - definitelyEliminated.length

  if (atCutoff.length <= slotsLeft) {
    return {
      eliminated: [...definitelyEliminated, ...atCutoff.map((n) => n.id)],
      tiebreak: null,
      tiebreakSlots: 0
    }
  }

  // Tiebreak step 1: fewest unique voters → eliminated.
  const byVoters = [...atCutoff].sort((a, b) => uniq(a) - uniq(b))
  const voterCutoff = uniq(byVoters[slotsLeft - 1])
  const elimByVoters = byVoters.filter((n) => uniq(n) < voterCutoff).map((n) => n.id)
  const stillTied = byVoters.filter((n) => uniq(n) === voterCutoff)
  const slotsAfterVoterTiebreak = slotsLeft - elimByVoters.length

  if (stillTied.length <= slotsAfterVoterTiebreak) {
    return {
      eliminated: [...definitelyEliminated, ...elimByVoters, ...stillTied.map((n) => n.id)],
      tiebreak: null,
      tiebreakSlots: 0
    }
  }

  if (allowRandomFallback) {
    // Step 3: random.
    const shuffled = [...stillTied].sort(() => Math.random() - 0.5)
    const elimRandom = shuffled.slice(0, slotsAfterVoterTiebreak).map((n) => n.id)
    return {
      eliminated: [...definitelyEliminated, ...elimByVoters, ...elimRandom],
      tiebreak: null,
      tiebreakSlots: 0
    }
  }

  // Step 2: revote on the still-tied names.
  return {
    eliminated: [...definitelyEliminated, ...elimByVoters],
    tiebreak: stillTied.map((n) => n.id),
    tiebreakSlots: slotsAfterVoterTiebreak
  }
}

// How many names to eliminate this round.
// Default 2 per spec, but never enough to wipe everyone — leave a single winner.
export function eliminationCountFor(activeCount) {
  if (activeCount <= 1) return 0
  if (activeCount === 2) return 1
  return 2
}
