export function HomeLandingHeroCopy() {
  return (
    <div className="home-hero-copy space-y-3 sm:space-y-4 text-center">
      <h1
        className="athletic-title home-title"
        aria-label="Fuck vibes. Use AI."
      >
        <span className="home-title-primary" data-text="FUCK VIBES.">
          FUCK VIBES...
        </span>
        <span className="home-title-accent" data-text="USE AI.">
          USE AI.
        </span>
      </h1>
      <p className="home-subtitle text-base sm:text-lg md:text-xl text-slate-300 mx-auto">
        Your league mates are guessing. <span className="home-subtitle-ai">WE'RE NOT!</span>
      </p>
      <p className="home-subtitle-detail">
        We use AI to expose roster cracks,
        <br /> trade windows, lineup leverage, and draft value before the rest
        of your league realizes
        <br /> they're playing for second place.
      </p>
    </div>
  );
}
