import { useNavigate } from 'react-router-dom';

import { Button, Screen, Segmented } from '../components/ui';
import type { Gender } from '../data/types';
import { allowsSameGenderMatching, getCountry } from '../domain/countries';
import { useDraft } from './onboardingDraft';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export function OnboardingIdentity() {
  const navigate = useNavigate();
  const { draft, patch } = useDraft();

  const sameGenderAllowed = allowsSameGenderMatching(draft.country);
  const countryName = getCountry(draft.country)?.name ?? 'your country';

  // Where same-gender matching is not offered, the option is disabled rather
  // than hidden — the spec asks for this to be clearly communicated, not
  // silently missing.
  const preferenceOptions = GENDERS.map((g) => ({
    ...g,
    disabled: !sameGenderAllowed && draft.gender !== null && g.value === draft.gender,
  }));

  return (
    <Screen>
      <div style={{ height: 16 }} />
      <h1 className="title">Set yourself up</h1>
      <p className="sub">Two questions. That is it.</p>

      <div style={{ height: 30 }} />

      <p className="label">I am</p>
      <Segmented
        label="Your gender"
        options={GENDERS}
        value={draft.gender}
        onChange={(gender) => {
          const invalid = !sameGenderAllowed && draft.genderPreference === gender;
          patch({ gender, genderPreference: invalid ? null : draft.genderPreference });
        }}
      />

      <div style={{ height: 24 }} />

      <p className="label">Looking for</p>
      <Segmented
        label="Who you want to be paired with"
        options={preferenceOptions}
        value={draft.genderPreference}
        onChange={(genderPreference) => patch({ genderPreference })}
      />

      {!sameGenderAllowed && (
        <div className="panel" style={{ marginTop: 18 }}>
          <p className="label" style={{ color: 'var(--amber)', margin: 0 }}>
            Why is an option greyed out
          </p>
          <p className="muted" style={{ marginTop: 8 }}>
            Konji only offers same gender matching where it is legally permitted to. In{' '}
            {countryName} it is not, so pairing here is opposite gender only.
          </p>
        </div>
      )}

      <div className="spacer" />

      <Button
        disabled={!draft.gender || !draft.genderPreference}
        onClick={() => navigate('/avatar')}
      >
        Continue
      </Button>
    </Screen>
  );
}
