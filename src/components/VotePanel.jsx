import { useMemo, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

const VOTES_PER_PLAYER = 2

// Shared voting UI used by both Play.jsx (player view) and Admin.jsx (admin-as-player).
export default function VotePanel({ game, names, votes, player }) {
  const submitVotes = useMutation(api.votes.submit)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState([]) // local picks before submit
  const [error, setError] = useState(null)

  const round = game.current_round
  const myVotes = useMemo(
    () => votes.filter((v) => v.player_id === player._id && v.round === round),
    [votes, player._id, round]
  )
  const alreadyVoted = myVotes.length >= VOTES_PER_PLAYER

  const votableNames = useMemo(() => {
    const tiebreak = game.tiebreak_name_ids
    if (tiebreak && tiebreak.length) {
      return names.filter((n) => tiebreak.includes(n._id))
    }
    return names.filter((n) => !n.eliminated)
  }, [names, game.tiebreak_name_ids])

  function pick(nameId) {
    if (alreadyVoted || submitting) return
    if (selected.length >= VOTES_PER_PLAYER) return
    setSelected((s) => [...s, nameId])
  }

  function undo() {
    if (alreadyVoted || submitting) return
    setSelected((s) => s.slice(0, -1))
  }

  async function submit() {
    if (selected.length !== VOTES_PER_PLAYER) return
    setSubmitting(true)
    setError(null)
    try {
      await submitVotes({
        gameId: game._id,
        playerId: player._id,
        nameIds: selected
      })
      setSelected([])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const tally = useMemo(() => {
    const t = {}
    for (const id of selected) t[id] = (t[id] || 0) + 1
    return t
  }, [selected])

  if (alreadyVoted) {
    const myPicks = myVotes.map((v) => names.find((n) => n._id === v.name_id)).filter(Boolean)
    return (
      <div className="vote-panel vote-done">
        <h3>Du har röstat ✓</h3>
        <p className="muted">Väntar på att spelledaren stänger omgången…</p>
        <ul className="my-picks">
          {myPicks.map((n, i) => (
            <li key={i} className="pick-chip">{n.name}</li>
          ))}
        </ul>
      </div>
    )
  }

  const remaining = VOTES_PER_PLAYER - selected.length
  const ready = selected.length === VOTES_PER_PLAYER

  return (
    <div className="vote-panel">
      <div className="vote-header">
        <h3>
          {game.tiebreak_name_ids?.length ? 'Tiebreak — rösta igen' : `Omgång ${round}`}
        </h3>
        <p className="muted">
          Lägg <strong>{VOTES_PER_PLAYER}</strong> röster. Du kan lägga båda på samma namn.
          {' '}
          <span className="muted">Röster kvar: <strong>{remaining}</strong></span>
        </p>
      </div>

      <div className="card-grid">
        {votableNames.map((n) => {
          const picks = tally[n._id] || 0
          return (
            <button
              key={n._id}
              className={`name-card ${picks > 0 ? 'picked' : ''}`}
              onClick={() => pick(n._id)}
              disabled={remaining === 0}
            >
              <div className="name-text">{n.name}</div>
              {picks > 0 && (
                <div className="pick-badge">{'•'.repeat(picks)}</div>
              )}
            </button>
          )
        })}
      </div>

      <div className="vote-actions">
        <button className="btn btn-ghost" onClick={undo} disabled={selected.length === 0}>
          Ångra
        </button>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={!ready || submitting}
        >
          {submitting ? 'Skickar…' : ready ? 'Bekräfta röster' : `Välj ${remaining} till`}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
