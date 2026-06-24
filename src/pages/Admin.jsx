import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useGame } from '../lib/useGame.js'
import { generateToken, playerVoteCount, playersWithFullVotes } from '../lib/gameLogic.js'
import VotePanel from '../components/VotePanel.jsx'

const VOTES_PER_PLAYER = 2

export default function Admin() {
  const { gameId } = useParams()
  const { game, names, players, votes, loading } = useGame(gameId)

  if (loading || !game) {
    return <div className="page page-center"><p className="muted">Laddar spel…</p></div>
  }

  const admin = players.find((p) => p.is_admin) || null

  return (
    <div className="page admin">
      <header className="admin-header">
        <h1 className="title-lg">Spelledare</h1>
        <ShareLinks gameId={gameId} />
      </header>

      {game.status === 'lobby' && <Lobby game={game} names={names} players={players} />}
      {game.status === 'voting' && admin && (
        <VotingPhase game={game} names={names} players={players} votes={votes} admin={admin} />
      )}
      {game.status === 'result' && (
        <ResultPhase game={game} names={names} />
      )}
      {game.status === 'finished' && <FinishedPhase game={game} names={names} />}
    </div>
  )
}

function ShareLinks({ gameId }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const viewUrl = `${origin}/view/${gameId}`
  return (
    <div className="share-links">
      <CopyField label="Storbildsvy (Teams)" value={viewUrl} />
    </div>
  )
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <div className="copy-field">
      <label>{label}</label>
      <div className="copy-row">
        <input readOnly value={value} onClick={(e) => e.target.select()} />
        <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? 'Kopierat!' : 'Kopiera'}</button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Lobby
// ────────────────────────────────────────────────────────────────────────────

function Lobby({ game, names, players }) {
  const addName = useMutation(api.names.add)
  const removeName = useMutation(api.names.remove)
  const addPlayer = useMutation(api.players.add)
  const removePlayer = useMutation(api.players.remove)
  const startGame = useMutation(api.games.startGame)

  const [nameInput, setNameInput] = useState('')
  const [playerInput, setPlayerInput] = useState('')
  const [starting, setStarting] = useState(false)
  const [err, setErr] = useState(null)

  async function handleAddName() {
    const name = nameInput.trim()
    if (!name) return
    setNameInput('')
    await addName({ gameId: game._id, name })
  }

  async function handleAddPlayer() {
    const name = playerInput.trim()
    if (!name) return
    setPlayerInput('')
    await addPlayer({ gameId: game._id, name, token: generateToken() })
  }

  async function handleStart() {
    if (names.length < 3) {
      setErr('Lägg till minst 3 namn att rösta om.')
      return
    }
    if (players.length < 2) {
      setErr('Lägg till minst 2 spelare.')
      return
    }
    setStarting(true)
    setErr(null)
    try {
      await startGame({ gameId: game._id })
    } catch (e) {
      setErr(e.message || String(e))
      setStarting(false)
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="lobby">
      <section className="card">
        <h2>1. Namn att rösta om</h2>
        <p className="muted">Lägg till alla namn som ska röstas ut. Minst 3.</p>
        <div className="inline-form">
          <input
            placeholder="Skriv ett namn…"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddName()}
          />
          <button className="btn btn-primary" onClick={handleAddName}>Lägg till</button>
        </div>
        <ul className="chip-list">
          {names.map((n) => (
            <li key={n._id} className="chip">
              {n.name}
              <button className="chip-x" onClick={() => removeName({ id: n._id })} aria-label="Ta bort">×</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>2. Spelare</h2>
        <p className="muted">Lägg till dig själv först (du blir admin). Sen alla andra. Dela ut länkarna.</p>
        <div className="inline-form">
          <input
            placeholder={players.length === 0 ? 'Ditt namn (admin)…' : 'Spelarens namn…'}
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
          />
          <button className="btn btn-primary" onClick={handleAddPlayer}>Lägg till spelare</button>
        </div>
        <ul className="player-list">
          {players.map((p) => (
            <li key={p._id} className="player-row">
              <div className="player-name">
                {p.name}
                {p.is_admin && <span className="tag">Admin (du)</span>}
              </div>
              <CopyField label="Länk" value={`${origin}/play/${p.token}`} />
              {p.is_admin ? (
                <span className="muted small">Du röstar i admin-vyn</span>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => removePlayer({ id: p._id })}>Ta bort</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>3. Starta spelet</h2>
        <p className="muted">Alla spelare måste ha sin länk öppen innan du startar.</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleStart}
          disabled={starting}
        >
          {starting ? 'Startar…' : 'Starta omgång 1'}
        </button>
        {err && <p className="error">{err}</p>}
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Voting phase
// ────────────────────────────────────────────────────────────────────────────

function VotingPhase({ game, names, players, votes, admin }) {
  const closeRound = useMutation(api.games.closeRound)
  const [closing, setClosing] = useState(false)
  const [err, setErr] = useState(null)

  // Adapt votes to gameLogic's shape (which expects player_id).
  const adapted = votes.map((v) => ({ player_id: v.player_id, name_id: v.name_id }))
  const voted = playersWithFullVotes(adapted, VOTES_PER_PLAYER)
  const allVoted = players.every((p) => voted.has(p._id))

  async function handleClose() {
    setClosing(true)
    setErr(null)
    try {
      await closeRound({ gameId: game._id })
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="voting-phase">
      <section className="card">
        <h2>Vem har röstat?</h2>
        <ul className="voter-status">
          {players.map((p) => {
            const count = playerVoteCount(adapted, p._id)
            const done = count >= VOTES_PER_PLAYER
            return (
              <li key={p._id} className={`voter-row ${done ? 'done' : 'waiting'}`}>
                <span className="dot" />
                <span>{p.name}{p.is_admin && ' (du)'}</span>
                <span className="muted small">{done ? 'Klar' : `${count}/${VOTES_PER_PLAYER}`}</span>
              </li>
            )
          })}
        </ul>
        <button
          className={`btn ${allVoted ? 'btn-primary' : 'btn-warn'} btn-lg`}
          onClick={handleClose}
          disabled={closing}
        >
          {closing ? 'Räknar röster…' : allVoted ? 'Alla har röstat — stäng omgången' : 'Stäng omgången ändå'}
        </button>
        {err && <p className="error">{err}</p>}
      </section>

      <section className="card">
        <h2>Din röst</h2>
        <VotePanel game={game} names={names} votes={votes} player={admin} />
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Result phase (between rounds)
// ────────────────────────────────────────────────────────────────────────────

function ResultPhase({ game, names }) {
  const nextRound = useMutation(api.games.nextRound)
  const [advancing, setAdvancing] = useState(false)
  const eliminated = (game.last_eliminated_ids || [])
    .map((id) => names.find((n) => n._id === id))
    .filter(Boolean)

  async function handleNext() {
    setAdvancing(true)
    try {
      await nextRound({ gameId: game._id })
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div className="result-phase">
      <section className="card">
        <h2>Omgång {game.current_round} — resultat</h2>
        <p className="muted">Storbildsvyn visar dramatisk avslöjning. Här är sammanfattningen:</p>
        {eliminated.length === 0 ? (
          <p>Inga eliminerades.</p>
        ) : (
          <ul className="eliminated-list">
            {eliminated.map((n) => (
              <li key={n._id} className="eliminated">💀 {n.name}</li>
            ))}
          </ul>
        )}
        <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={advancing}>
          {advancing ? 'Startar…' : `Starta omgång ${game.current_round + 1}`}
        </button>
      </section>
    </div>
  )
}

function FinishedPhase({ game, names }) {
  const winner = names.find((n) => n._id === game.winner_name_id)
  return (
    <div className="result-phase">
      <section className="card winner-card">
        <h2>🏆 Vi har en vinnare!</h2>
        <p className="winner-name">{winner?.name || '—'}</p>
        <p className="muted">Storbildsvyn firar med konfetti.</p>
      </section>
    </div>
  )
}
