import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Disable all console outputs across the app
;(() => {
  const methods = ['log', 'error', 'warn', 'info', 'debug', 'trace']
  for (const method of methods) {
    try {
      // eslint-disable-next-line no-console
      console[method] = () => {}
    } catch {}
  }
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
