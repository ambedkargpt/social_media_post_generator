import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

// Hand off from the static boot screen in index.html. Removed after paint
// rather than before, so there is no frame where neither is on screen.
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
});
