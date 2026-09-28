// self-hosted fonts: no third-party requests, the app stays fully local
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { startThemeSync } from './lib/theme'

startThemeSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
