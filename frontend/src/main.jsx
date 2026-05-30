import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'
import App from './App.jsx'
import { getSiteLanguage } from './utils/siteLanguage.js'

// Stamp lang attribute before first render so CSS font rules fire immediately
const storedLang = getSiteLanguage();
if (storedLang) document.documentElement.lang = storedLang;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
