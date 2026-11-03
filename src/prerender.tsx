import { renderToString } from 'react-dom/server'
import { LandingView } from './views/LandingView'

/** Build-time only (scripts/prerender.mjs): the landing as static HTML for crawlers and first paint. The client replaces it on mount. */
export function render(): string {
  const noop = () => {}
  const unavailable = async () => ({ ok: false, message: '' })
  return renderToString(<LandingView cloudEnabled onStart={noop} onSignIn={unavailable} onSignUp={unavailable} onReset={unavailable} onFeedback={unavailable} />)
}

export { faqJsonLd } from './views/landingFaq'
