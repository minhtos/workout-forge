import { AuthForm, type AuthResult } from './AuthForm'

interface Props {
  cloudEnabled: boolean
  onStart: () => void
  onSignIn: (email: string, password: string) => Promise<AuthResult>
  onSignUp: (email: string, password: string) => Promise<AuthResult>
  onReset: (email: string) => Promise<AuthResult>
}

const features = [
  { title: 'A plan built around your week', body: 'Choose 2, 3 or 4 training days and a 4- or 6-week block with a deload at the end. Start from a ready-made split or pick every exercise yourself.' },
  { title: 'Log sets in seconds', body: 'Weight and reps for every set, with big touch targets for one-handed use at the gym. Each set saves the moment you check it off, even offline.' },
  { title: 'Know what to lift next', body: 'Targets follow reps in reserve, and your answers on soreness, effort and pump set the next weight, reps and sets. Stall for two sessions and the weight backs off.' },
]

const barbell = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></svg>

export function LandingView({ cloudEnabled, onStart, onSignIn, onSignUp, onReset }: Props) {
  return <div className="landing">
    <header className="landing-bar">
      <div className="landing-brand"><span className="landing-mark">{barbell}</span><span>Workout Forge</span></div>
      <span className="landing-badge">Early access · feedback welcome</span>
    </header>
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-copy">
        <h1 id="landing-title">Train with a plan.<br /><span>Log every set.</span></h1>
        <p>Workout Forge builds your training block, logs your sets, and tells you what to lift next, based on how the last session actually went. Free, and it works offline.</p>
        <div className="landing-actions"><button type="button" className="primary-button large" onClick={onStart}>Get started free</button><span>No account needed. Your data stays on your device.</span></div>
        <ul className="landing-pills" aria-label="Highlights"><li>2–4 day plans</li><li>Weight · reps · RIR targets</li><li>Works offline</li></ul>
      </div>
      {cloudEnabled && <AuthForm idPrefix="landing" onSignIn={onSignIn} onSignUp={onSignUp} onReset={onReset} />}
    </section>
    <section className="landing-features" aria-labelledby="features-title">
      <div className="landing-inner">
        <h2 id="features-title">What you get</h2>
        <div className="feature-grid">{features.map((feature, index) => <article key={feature.title} className="feature-card"><span className="feature-number">{String(index + 1).padStart(2, '0')}</span><h3>{feature.title}</h3><p>{feature.body}</p></article>)}</div>
      </div>
    </section>
    <footer className="landing-foot"><span>Workouts save on your device, and back up to your account if you create one.</span><span>Workout Forge · early access</span></footer>
  </div>
}
