import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PrivacyPolicy, TermsOfService } from './LegalPages.tsx'

// Two static pages don't justify a router.
const pages: Record<string, () => React.JSX.Element> = {
  '/privacy': PrivacyPolicy,
  '/terms': TermsOfService,
}
const Page = pages[window.location.pathname] ?? App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
