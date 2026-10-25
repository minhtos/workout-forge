import { baseExercises, createBlock, listWorkouts, resolveWorkout, type ScheduledWorkout } from '../domain/program'
import { applyWorkoutSet, findWorkoutSet, workoutSets } from '../domain/workoutSets'
import { AuthForm, type AuthResult } from './AuthForm'
import { FeedbackForm } from './FeedbackForm'

interface Props {
  cloudEnabled: boolean
  onStart: () => void
  onSignIn: (email: string, password: string) => Promise<AuthResult>
  onSignUp: (email: string, password: string) => Promise<AuthResult>
  onReset: (email: string) => Promise<AuthResult>
  onFeedback: (message: string, email: string) => Promise<AuthResult>
}

const features = [
  { title: 'A plan built around your week', body: 'Choose 2, 3 or 4 training days and a 4, 6, 8 or 12-week program, with a deload at the end of each block. Start from a ready-made split or pick every exercise yourself.' },
  { title: 'Log sets in seconds', body: 'Weight and reps for every set, with big touch targets for one-handed use at the gym. Each set saves the moment you check it off, even offline.' },
  { title: 'Know what to lift next', body: 'Targets follow reps in reserve, and your answers on soreness, effort and pump set the next weight, reps and sets. Stall for two sessions and the weight backs off.' },
  { title: 'What is a deload?', body: 'The last week of every block is a deload: the same exercises at about half your usual weight, stopping well short of failure. Hard weeks stack up fatigue in your muscles, joints and recovery. A lighter week lets it clear while you keep your strength, so you start the next block fresher and ready to lift heavier. The app works out the weight for you.' },
]

const steps = [
  { title: 'Build your block', body: 'Pick your days and a ready-made split — or choose every exercise yourself. The plan, the weights and the deload are worked out for you.' },
  { title: 'Log every set', body: 'Big targets, one hand, mid-workout. Check a set off and it is saved on the spot, with or without a connection.' },
  { title: 'Lift more next time', body: 'Your soreness, effort and pump answers set the next session\u2019s weight, reps and sets. No spreadsheets, no guessing.' },
]

/**
 * Week 1 of the ready-made Push | Pull | Legs split, built by the app's own
 * program builder — what the landing page shows is what the app generates.
 */
const sampleBlock = applyWorkoutSet(createBlock(3, 6), findWorkoutSet('push-pull-legs') ?? workoutSets.find((set) => set.recommendedDays === 3)!)
const sampleWeek: ScheduledWorkout[] = listWorkouts(sampleBlock)
  .filter((workout) => workout.weekNumber === 1)
  .map((workout) => resolveWorkout(sampleBlock, workout, baseExercises))

const barbell = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></svg>

function PhonePreview({ workout }: { workout: ScheduledWorkout }) {
  const [first, ...rest] = workout.exercises
  return <div className="phone" role="img" aria-label={`Preview of a Workout Forge session: ${workout.title}, starting with ${first.name}`}>
    <div className="phone-notch" aria-hidden="true" />
    <div className="phone-head">
      <span className="phone-eyebrow">Today</span>
      <span className="phone-title">{workout.title}</span>
      <span className="phone-sub">Week 1 · {workout.exercises.length} exercises</span>
    </div>
    <div className="phone-exercise current">
      <div className="phone-exercise-row"><strong>{first.name}</strong><span>{first.sets} × {first.repRange.min}–{first.repRange.max}</span></div>
      <div className="phone-sets" aria-hidden="true">
        {Array.from({ length: first.sets }, (_, index) => <span key={index} className={index < first.sets - 1 ? 'phone-set done' : 'phone-set'}>{index < first.sets - 1 ? '✓' : index + 1}</span>)}
      </div>
    </div>
    {rest.slice(0, 3).map((exercise) => <div className="phone-exercise" key={exercise.id}>
      <div className="phone-exercise-row"><strong>{exercise.name}</strong><span>{exercise.sets} × {exercise.repRange.min}–{exercise.repRange.max}</span></div>
    </div>)}
    <div className="phone-next"><span>Up next</span><strong>{rest[0]?.name}</strong></div>
  </div>
}

export function LandingView({ cloudEnabled, onStart, onSignIn, onSignUp, onReset, onFeedback }: Props) {
  return <div className="landing">
    <header className="landing-bar">
      <div className="landing-brand"><span className="landing-mark">{barbell}</span><span>Workout Forge</span></div>
      <a className="landing-badge" href="#feedback">Early access · feedback welcome</a>
    </header>
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-copy">
        <h1 id="landing-title">Train with a plan.<br /><span>Log every set.</span></h1>
        <p>Workout Forge builds your training block, logs your sets, and tells you what to lift next, based on how the last session actually went. Free, and it works offline.</p>
        <div className="landing-actions"><button type="button" className="primary-button large" onClick={onStart}>Get started free</button><span>No account needed. Your data stays on your device.</span></div>
        <ul className="landing-pills" aria-label="Highlights"><li>2–4 day plans</li><li>Weight · reps · RIR targets</li><li>Works offline</li><li>Installs like an app — no app store</li></ul>
      </div>
      {cloudEnabled && <AuthForm idPrefix="landing" onSignIn={onSignIn} onSignUp={onSignUp} onReset={onReset} />}
    </section>
    <section className="landing-peek" aria-labelledby="peek-title">
      <div className="landing-inner peek-grid">
        <PhonePreview workout={sampleWeek[0]} />
        <div className="peek-copy">
          <h2 id="peek-title">How it works</h2>
          <ol className="steps">
            {steps.map((step, index) => <li key={step.title} className="step"><span className="feature-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}
          </ol>
        </div>
      </div>
    </section>
    <section className="landing-week" aria-labelledby="week-title">
      <div className="landing-inner">
        <h2 id="week-title">A week, built for you</h2>
        <p className="landing-lede">This is week 1 of the Push | Pull | Legs split, generated by the same builder the app uses. Pick a different split — or every exercise — and yours looks like this in about a minute.</p>
        <div className="week-grid">
          {sampleWeek.map((workout) => <article className="week-card" key={workout.id}>
            <h3>{workout.title}</h3>
            <ul>{workout.exercises.map((exercise) => <li key={exercise.id}><span>{exercise.name}</span><span className="week-sets">{exercise.sets} × {exercise.repRange.min}–{exercise.repRange.max}</span></li>)}</ul>
          </article>)}
        </div>
      </div>
    </section>
    <section className="landing-features" aria-labelledby="features-title">
      <div className="landing-inner">
        <h2 id="features-title">What you get</h2>
        <div className="feature-grid">{features.map((feature, index) => <article key={feature.title} className="feature-card"><span className="feature-number">{String(index + 1).padStart(2, '0')}</span><h3>{feature.title}</h3><p>{feature.body}</p></article>)}</div>
      </div>
    </section>
    <section className="landing-feedback" id="feedback" aria-labelledby="feedback-title">
      <div className="landing-inner feedback-grid">
        <div>
          <h2 id="feedback-title">Help shape it</h2>
          <p className="landing-lede">Workout Forge is in early access and built in the open. Missing an exercise? Something feel off mid-workout? Tell us — feedback is read by a human and decides what gets built next.</p>
        </div>
        {cloudEnabled
          ? <FeedbackForm idPrefix="landing-feedback" onSubmit={onFeedback} />
          : <p className="landing-lede">Feedback is unavailable in this build.</p>}
      </div>
    </section>
    <footer className="landing-foot"><span>Workouts save on your device, and back up to your account if you create one.</span><span>Workout Forge · early access</span></footer>
  </div>
}
