import '@fontsource-variable/google-sans-flex'
import '@fontsource/geist-mono/400.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { seedIfEmpty } from './lib/seed'
import { startSync } from './lib/sync'
import './styles.css'

registerSW({ immediate: true })
void seedIfEmpty().then(startSync)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
