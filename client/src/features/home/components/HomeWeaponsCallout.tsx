export function HomeWeaponsCallout() {
  return (
    <div className="home-weapons-callout">
      <p className="home-weapons-callout-title">
        <span className="home-weapons-callout-blue">THESE AREN’T FEATURES.</span>
        <span className="home-weapons-callout-orange">THEY’RE WEAPONS.</span>
      </p>
      <p className="home-weapons-callout-copy">
        <span className="home-weapons-copy-line">
          Run the scan. Find the weakness. Send the offer.
        </span>
        <br />
        {' '}
        <span className="home-weapons-copy-line">
          Make them regret inviting you.
        </span>
      </p>
    </div>
  );
}
