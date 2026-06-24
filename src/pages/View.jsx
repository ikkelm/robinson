import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useGame } from '../lib/useGame.js'
import { playersWithFullVotes } from '../lib/gameLogic.js'

const VOTES_PER_PLAYER = 2

export default function View() {
  const { gameId } = useParams()
  const { game, names, players, votes, loading } = useGame(gameId)

  if (loading || !game) {
    return <div className="view view-center"><p className="big-muted">Laddar…</p></div>
  }

  return (
    <div className="view">
      {game.status === 'lobby' && <LobbyView players={players} names={names} />}
      {game.status === 'voting' && (
        <VotingView game={game} names={names} players={players} votes={votes} />
      )}
      {game.status === 'result' && (
        <ResultView game={game} names={names} />
      )}
      {game.status === 'finished' && <FinishedView game={game} names={names} />}
    </div>
  )
}

function LobbyView({ players, names }) {
  return (
    <div className="view-lobby">
      <h1 className="display">Robinson</h1>
      <p className="display-sub">Spelledaren förbereder spelet…</p>

      <div className="rules-card">
        <h2 className="rules-title">Så funkar det</h2>
        <ol className="rules-list">
          <li>Varje omgång lägger ni <strong>2 röster</strong> vardera — båda får sättas på samma namn.</li>
          <li>De <strong>2 namnen med lägst</strong> röster åker ut.</li>
          <li>Sista namnet som är kvar <strong>vinner</strong>.</li>
        </ol>

        <h3 className="rules-subtitle">Vid lika röster på sistaplatsen</h3>
        <ol className="rules-list rules-list-sub">
          <li>Namnet med <strong>flest unika röstare</strong> överlever.</li>
          <li>Fortfarande lika → <strong>ny röstomgång</strong> endast på de inblandade namnen.</li>
          <li>Fortfarande lika efter det → <strong>slumpen avgör</strong>.</li>
        </ol>
      </div>

      <div className="lobby-cols">
        <div>
          <h3 className="muted">Spelare ({players.length})</h3>
          <ul className="big-list">
            {players.map((p) => <li key={p._id}>{p.name}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="muted">Namn att rösta om ({names.length})</h3>
          <ul className="big-list">
            {names.map((n) => <li key={n._id}>{n.name}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

function VotingView({ game, names, players, votes }) {
  const adapted = votes.map((v) => ({ player_id: v.player_id }))
  const voted = playersWithFullVotes(adapted, VOTES_PER_PLAYER)
  const isTiebreak = Boolean(game.tiebreak_name_ids?.length)
  const visibleNames = isTiebreak
    ? names.filter((n) => game.tiebreak_name_ids.includes(n._id))
    : names.filter((n) => !n.eliminated)

  return (
    <div className="view-voting">
      <header className="view-header">
        <h1 className="display">
          {isTiebreak ? 'Tiebreak!' : `Omgång ${game.current_round}`}
        </h1>
        <p className="display-sub">
          {voted.size}/{players.length} spelare har röstat
        </p>
      </header>

      <div className="big-card-grid">
        {visibleNames.map((n) => (
          <div key={n._id} className="big-card">
            <span className="big-card-name">{n.name}</span>
          </div>
        ))}
      </div>

      <footer className="voter-strip">
        {players.map((p) => (
          <div key={p._id} className={`voter-pill ${voted.has(p._id) ? 'voted' : 'waiting'}`}>
            <span className="check">{voted.has(p._id) ? '✓' : '…'}</span>
            <span>{p.name}</span>
          </div>
        ))}
      </footer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Dramatic result reveal
// ────────────────────────────────────────────────────────────────────────────

function ResultView({ game, names }) {
  const eliminatedIds = game.last_eliminated_ids || []
  const [phase, setPhase] = useState('countdown') // countdown | reveal | settled
  const [countdown, setCountdown] = useState(3)
  const [revealIndex, setRevealIndex] = useState(-1)
  const [revealedIds, setRevealedIds] = useState([])

  const boardNames = useMemo(() => {
    return names.filter((n) => {
      if (revealedIds.includes(n._id)) return false
      if (n.eliminated && !eliminatedIds.includes(n._id)) return false
      return true
    })
  }, [names, revealedIds, eliminatedIds])

  const currentReveal = revealIndex >= 0 && revealIndex < eliminatedIds.length
    ? names.find((n) => n._id === eliminatedIds[revealIndex])
    : null

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      const t = setTimeout(() => {
        setPhase('reveal')
        setRevealIndex(0)
      }, 600)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  useEffect(() => {
    if (phase !== 'reveal') return
    if (revealIndex < 0) return

    if (revealIndex >= eliminatedIds.length) {
      const t = setTimeout(() => setPhase('settled'), 1200)
      return () => clearTimeout(t)
    }

    const id = eliminatedIds[revealIndex]
    const showTimer = setTimeout(() => {
      setRevealedIds((r) => [...r, id])
      setRevealIndex((i) => i + 1)
    }, 2800)
    return () => clearTimeout(showTimer)
  }, [phase, revealIndex, eliminatedIds])

  return (
    <div className="view-result">
      <header className="view-header">
        <h1 className="display">Omgång {game.current_round}</h1>
      </header>

      {phase === 'countdown' && (
        <div className="countdown-overlay">
          <div className="countdown-text">{countdown > 0 ? countdown : 'GO!'}</div>
        </div>
      )}

      {phase === 'reveal' && currentReveal && (
        <div className="reveal-overlay">
          <p className="reveal-label">Eliminerad</p>
          <div className="reveal-name">{currentReveal.name}</div>
        </div>
      )}

      <div className="big-card-grid">
        {boardNames.map((n) => (
          <div
            key={n._id}
            className={`big-card ${currentReveal?._id === n._id ? 'being-eliminated' : ''}`}
          >
            <span className="big-card-name">{n.name}</span>
          </div>
        ))}
      </div>

      {phase === 'settled' && (
        <div className="settled-banner">
          <p className="display-sub">Klart — vänta på nästa omgång</p>
        </div>
      )}
    </div>
  )
}

function FinishedView({ game, names }) {
  const winner = names.find((n) => n._id === game.winner_name_id)
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    const fire = (opts) =>
      confetti({
        particleCount: 80,
        spread: 80,
        startVelocity: 55,
        ticks: 220,
        ...opts
      })
    fire({ origin: { x: 0.2, y: 0.4 } })
    fire({ origin: { x: 0.8, y: 0.4 } })
    fire({ origin: { x: 0.5, y: 0.2 }, particleCount: 160, spread: 120 })
    const interval = setInterval(() => {
      fire({ origin: { x: Math.random(), y: Math.random() * 0.3 } })
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="view-finished">
      <p className="winner-label">🏆 Vinnare 🏆</p>
      <h1 className="winner-display">{winner?.name || '—'}</h1>
      <p className="display-sub">Spelet är slut.</p>
    </div>
  )
}
