import { useParams } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useGame } from '../lib/useGame.js'
import VotePanel from '../components/VotePanel.jsx'

export default function Play() {
  const { token } = useParams()
  const player = useQuery(api.players.getByToken, { token })

  if (player === undefined) {
    return <div className="page page-center"><p className="muted">Hämtar din länk…</p></div>
  }
  if (player === null) {
    return (
      <div className="page page-center">
        <div className="hero">
          <h1 className="title-lg">Länken hittades inte</h1>
          <p className="muted">Be spelledaren skicka länken igen.</p>
        </div>
      </div>
    )
  }
  return <PlayInner player={player} />
}

function PlayInner({ player }) {
  const { game, names, votes, loading } = useGame(player.game_id)

  if (loading || !game) {
    return <div className="page page-center"><p className="muted">Laddar spel…</p></div>
  }

  const winner = names.find((n) => n._id === game.winner_name_id)

  return (
    <div className="page play">
      <header className="play-header">
        <div className="me">
          <span className="muted small">Du röstar som</span>
          <h1 className="title-md">{player.name}{player.is_admin && ' (admin)'}</h1>
        </div>
      </header>

      {game.status === 'lobby' && (
        <div className="info-card">
          <h2>Väntar på att spelet startar…</h2>
          <p className="muted">Spelledaren förbereder allt. Håll dig kvar här.</p>
        </div>
      )}

      {game.status === 'voting' && (
        <VotePanel game={game} names={names} votes={votes} player={player} />
      )}

      {game.status === 'result' && (
        <div className="info-card">
          <h2>Räknar röster…</h2>
          <p className="muted">Resultatet visas på storbildsskärmen. Snart är det dags igen.</p>
        </div>
      )}

      {game.status === 'finished' && (
        <div className="info-card winner-card">
          <h2>🏆 Vinnare</h2>
          <p className="winner-name">{winner?.name || '—'}</p>
        </div>
      )}
    </div>
  )
}
