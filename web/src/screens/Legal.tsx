import { useNavigate } from 'react-router-dom';

import { Screen } from '../components/ui';

/**
 * Terms and Privacy share a shell because they are the same shape of document.
 * The copy itself is still to come — until it lands these render the heading and
 * say so plainly, so the links on the splash go somewhere real rather than 404.
 */
export function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const navigate = useNavigate();
  const title = kind === 'terms' ? 'Terms' : 'Privacy Policy';

  return (
    <Screen>
      <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
        ‹
      </button>

      <h1 className="title" style={{ marginTop: 12 }}>
        {title}
      </h1>
      <p className="sub">
        {kind === 'terms'
          ? 'The rules for using Konji, and what we expect from you.'
          : 'What we collect, what we do with it, and what we never do with it.'}
      </p>

      <div className="panel" style={{ marginTop: 24 }}>
        <p className="muted" style={{ margin: 0 }}>
          This document is being written. It will appear here before Konji opens to the public.
        </p>
      </div>

      <div className="spacer" />
    </Screen>
  );
}
