import { useNavigate } from 'react-router-dom';

import { Button, Screen } from '../components/ui';

/**
 * Placeholder. The repository has signOut but no signIn yet, so there is no
 * credential flow to render — this exists so the splash's second CTA lands
 * somewhere honest instead of a dead route.
 */
export function Login() {
  const navigate = useNavigate();

  return (
    <div className="login">
      <Screen>
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
          ‹
        </button>

        <h1 className="title" style={{ marginTop: 12 }}>
          Welcome back
        </h1>
        <p className="sub">
          Signing back in is not wired up yet. For now, set yourself up again and you are in.
        </p>

        <div className="spacer" />

        <Button onClick={() => navigate('/welcome')}>Set me up instead</Button>
      </Screen>
    </div>
  );
}
