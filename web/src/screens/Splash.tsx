import { Link, useNavigate } from 'react-router-dom';

export function Splash() {
  const navigate = useNavigate();

  return (
    <div className="splash">
      <div className="splash__stage">
        {/* Uppercased in CSS rather than in the markup, so the accessible name
            stays "Konji" instead of being spelled out as an initialism. */}
        <h1 className="splash__word">Konji</h1>
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
