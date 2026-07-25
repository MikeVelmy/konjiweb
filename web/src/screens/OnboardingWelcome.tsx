import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PixelAvatar } from '../components/PixelAvatar';
import { Button, Screen } from '../components/ui';
import { defaultAvatar } from '../domain/avatar';
import { countries, getCountry } from '../domain/countries';
import { useDraft } from './onboardingDraft';

export function OnboardingWelcome() {
  const navigate = useNavigate();
  const { draft, patch } = useDraft();
  const [open, setOpen] = useState(false);

  const country = getCountry(draft.country);
  const canContinue = draft.ageAttested && Boolean(country?.launched);

  return (
    <Screen>
      <div style={{ display: 'grid', placeItems: 'center', margin: '20px 0 24px' }}>
        {/* Avatar colours are hex on purpose — they are theme-independent, since
            an avatar must read as the same person in either theme. */}
        <PixelAvatar config={defaultAvatar} size={96} />
      </div>

      <h1 className="title">
        Same energy, <span style={{ color: 'var(--red)' }}>no face.</span>
      </h1>
      <p className="sub">
        No photos. You are an avatar and a name until you both decide otherwise. Two questions and
        you are in.
      </p>

      <div style={{ height: 28 }} />

      <p className="label" id="country-label">
        Where are you
      </p>
      <button
        type="button"
        className="choice"
        aria-expanded={open}
        aria-labelledby="country-label"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {country ? `${country.flag}  ${country.name}` : 'Choose a country'}
        </span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <ul className="country-list">
          {countries.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                disabled={!c.launched}
                onClick={() => {
                  // Changing country can invalidate a same-gender preference set
                  // earlier, so it is cleared rather than silently carried over.
                  patch({ country: c.code, genderPreference: null });
                  setOpen(false);
                }}
              >
                <span>
                  {c.flag}  {c.name}
                </span>
                {!c.launched && <span className="tag">SOON</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="muted" style={{ marginTop: 10 }}>
        Konji is live in Ghana first. Everywhere else is on the way.
      </p>

      <div style={{ height: 24 }} />

      {/* 18+ self-attestation, per the ToS decision in the spec. */}
      <button
        type="button"
        className="check"
        role="checkbox"
        aria-checked={draft.ageAttested}
        onClick={() => patch({ ageAttested: !draft.ageAttested })}
      >
        <span className="check__box" aria-hidden="true">
          {draft.ageAttested ? '✓' : ''}
        </span>
        <span>I am 18 or older, and I agree to the Terms and Privacy Policy.</span>
      </button>

      <div className="spacer" />

      <Button disabled={!canContinue} onClick={() => navigate('/identity')}>
        Continue
      </Button>
    </Screen>
  );
}
