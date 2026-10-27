/** Static stand-in for the setup screen while a signed-in user's program loads from their account. No motion on purpose. */
export function LoadingView() {
  return <section className="onboarding" aria-busy="true">
    <div className="eyebrow">YOUR TRAINING SYSTEM</div>
    <p className="lede" role="status">Loading your program…</p>
    <div className="loading-skeleton" aria-hidden="true">
      <div className="loading-bar wide" />
      <div className="loading-bar" />
      <div className="loading-bar short" />
      <div className="loading-grid"><i /><i /><i /></div>
    </div>
  </section>
}
