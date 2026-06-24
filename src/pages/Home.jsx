import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

export default function Home() {
  const navigate = useNavigate()
  const createGame = useMutation(api.games.create)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const id = await createGame()
      navigate(`/admin/${id}`)
    } catch (e) {
      setError(e.message || String(e))
      setCreating(false)
    }
  }

  return (
    <div className="page page-center">
      <div className="hero">
        <h1 className="title-xl">Robinson</h1>
        <p className="subtitle">Rösta ut ett namn i taget tills bara en överlever.</p>

        <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={creating}>
          {creating ? 'Skapar spel…' : 'Skapa nytt spel'}
        </button>

        {error && <p className="error">{error}</p>}

        <div className="hint">
          <p>Du blir spelledare. Du får länkar att dela ut till spelarna och en separat länk för storbildsvyn (t.ex. Teams).</p>
        </div>
      </div>
    </div>
  )
}
