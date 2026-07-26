import { Link, useNavigate } from 'react-router-dom';

/** Repeated twice in the marquee so the loop has no seam. */
const CREED = ['No photos', 'No names', 'One at a time', 'Ghana first'];

function Ticker() {
  return (
    <span className="splash__ticker" aria-hidden="true">
      {CREED.map((phrase) => (
        <span key={phrase} className="splash__tick">
          {phrase}
          <span className="splash__kiss">💋</span>
        </span>
      ))}
    </span>
  );
}

export function Splash() {
  const navigate = useNavigate();

  return (
    <div className="splash">
      <div className="splash__stage">
        <p className="splash__kicker">
          <span className="splash__dot" aria-hidden="true" />
          Live in Ghana
        </p>

        {/* Uppercased in CSS rather than in the markup, so the accessible name
            stays "Konji" instead of being spelled out as an initialism. */}
        <h1 className="splash__word">Konji</h1>

        <p className="splash__tagline">
          Same energy, <span className="splash__tagline-em">no face.</span>
        </p>
      </div>

      {/* The rules of the place, before anyone signs up for it. Two identical
          tracks scroll as one so the loop never shows a gap; the phrases are
          decorative here, and the same promises are made in words on the next
          screen, so the whole strip is hidden from assistive tech. */}
      <div className="splash__marquee">
        <div className="splash__track">
          <Ticker />
          <Ticker />
        </div>
      </div>

      <div className="splash__actions">
        <button
          type="button"
          className="btn splash__primary"
          onClick={() => navigate('/welcome')}
        >
          Set me Up😝
        </button>
        <button
          type="button"
          className="btn btn--ghost splash__secondary"
          onClick={() => navigate('/login')}
        >
          I'm not new to this🌚
        </button>

        <p className="splash__legal">
          By signing up, you agree to our <Link to="/terms">Terms</Link>. See how we use your data
          in our <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
