import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SettingsProvider, applySettings, loadSettings } from './lib/settings'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/ui'
import './styles/glass.css'
import './styles/polish.css'

applySettings(loadSettings()) // paint the right theme before React mounts

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </SettingsProvider>
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
