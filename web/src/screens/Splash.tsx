import { Link, useNavigate } from 'react-router-dom';

import { KonjiMark } from '../components/KonjiMark';

/** The splash ground is fixed in both themes, the same reasoning the avatars
 *  use: a launch screen is a brand moment, not a themed surface. */
const GROUND = '#2a2724';

export function Splash() {
  const navigate = useNavigate();

  return (
    <div className="splash">
      <div className="splash__stage">
        <KonjiMark size={104} ground={GROUND} animate decorative />
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
