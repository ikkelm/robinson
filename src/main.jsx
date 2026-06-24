import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import Home from './pages/Home.jsx'
import Admin from './pages/Admin.jsx'
import Play from './pages/Play.jsx'
import View from './pages/View.jsx'
import './styles.css'

const convexUrl = import.meta.env.VITE_CONVEX_URL
if (!convexUrl) {
  console.error('Missing VITE_CONVEX_URL. Run `npx convex dev` to create your Convex project and fill in .env.')
}
const convex = new ConvexReactClient(convexUrl ?? 'https://placeholder.convex.cloud')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/:gameId" element={<Admin />} />
          <Route path="/play/:token" element={<Play />} />
          <Route path="/view/:gameId" element={<View />} />
        </Routes>
      </BrowserRouter>
    </ConvexProvider>
  </React.StrictMode>
)
