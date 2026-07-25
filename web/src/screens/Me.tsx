import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { AvatarBuilder } from '../components/AvatarBuilder';
import { PixelAvatar } from '../components/PixelAvatar';
import { Button, Screen, Toast, useToast } from '../components/ui';
import { useRepository, useSession } from '../data/RepositoryProvider';
import { getCountry } from '../domain/countries';
import { useTheme } from '../theme/ThemeProvider';

function Row({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="row">
      <div className="row__body">
        <div className="row__title" style={{ fontSize: '0.95rem' }}>
          {title}
        </div>
        {subtitle && (
          <div className="muted" style={{ marginTop: 3, whiteSpace: 'normal' }}>
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

export function Me() {
  const { profile, updateAvatar, refreshProfile, signOut, backend } = useSession();
  const { resolved, setPreference } = useTheme();
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(profile?.avatar ?? null);

  if (!profile) return null;
  const country = getCountry(profile.country);

  return (
    <Screen>
      <h1 className="title">You</h1>
      <p className="sub">This is everything anyone can see before a reveal.</p>
      <div style={{ height: 20 }} />

      {editing && avatarDraft ? (
        <>
          <AvatarBuilder value={avatarDraft} onChange={setAvatarDraft} />
          <div className="btn-row" style={{ marginTop: 20 }}>
            <Button
              variant="ghost"
              onClick={() => {
                setAvatarDraft(profile.avatar);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await updateAvatar(avatarDraft);
                setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="panel"
            style={{ width: '100%', display: 'grid', justifyItems: 'center', marginBottom: 22 }}
            onClick={() => {
              setAvatarDraft(profile.avatar);
              setEditing(true);
            }}
          >
            <span className="avatar-frame" style={{ width: 130, height: 130, borderWidth: 2.5 }}>
              <PixelAvatar config={profile.avatar} size={94} />
            </span>
            <span className="title" style={{ fontSize: '1.25rem', marginTop: 14 }}>
              {profile.displayName}
            </span>
            <span className="muted" style={{ marginTop: 4 }}>
              Tap to edit your avatar
            </span>
          </button>

          <p className="label">Matching</p>
          <Row
            title="Country"
            subtitle={
              country?.sameGenderMatching
                ? 'Same-gender matching is available here.'
                : `Konji offers opposite-gender pairing only in ${country?.name ?? 'your country'}.`
            }
            right={<span style={{ fontSize: '1.4rem' }}>{country?.flag}</span>}
          />
          <Row
            title="Looking for"
            subtitle="Set during onboarding. Matching stays broad on purpose — no age or distance filters yet."
            right={
              <span style={{ color: 'var(--red)', fontWeight: 800, fontSize: '0.9rem' }}>
                {profile.genderPreference === 'male' ? 'Men' : 'Women'}
              </span>
            }
          />
          <Row
            title="Match nearby"
            subtitle="On, and the draw prefers people close to you. Off, and it searches the whole country."
            right={
              <label style={{ display: 'grid', placeItems: 'center', minWidth: 44, minHeight: 44 }}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
                  Match nearby
                </span>
                <input
                  type="checkbox"
                  checked={profile.gpsOptIn}
                  style={{ width: 22, height: 22, accentColor: 'var(--red)' }}
                  onChange={async (e) => {
                    await repo.setGpsOptIn(e.target.checked);
                    await refreshProfile();
                  }}
                />
              </label>
            }
          />

          <div style={{ height: 16 }} />
          <p className="label">Your name</p>
          <Row
            title={profile.displayName}
            subtitle={
              profile.isCustomName
                ? 'You are using a custom username.'
                : 'Everyone shares this default name. A custom one is coming as a paid upgrade.'
            }
            right={
              !profile.isCustomName ? (
                <button
                  type="button"
                  className="pill-btn"
                  onClick={() =>
                    toast.show('Custom usernames are a paid upgrade planned for the next release.')
                  }
                >
                  Upgrade
                </button>
              ) : null
            }
          />

          <div style={{ height: 16 }} />
          <p className="label">Your face</p>
          <Row
            title={profile.hasPhoto ? 'Photo saved, locked' : 'No photo yet'}
            subtitle={
              profile.hasPhoto
                ? 'Only unlocks for a match after you have both agreed to a reveal.'
                : 'You will be asked for one the first time you request a reveal.'
            }
          />

          <div style={{ height: 16 }} />
          <p className="label">App</p>
          <Row
            title="Theme"
            subtitle="Follows your system unless you pick one here."
            right={
              <button
                type="button"
                className="pill-btn"
                style={{ borderColor: 'var(--line)', color: 'var(--paper)' }}
                onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
              >
                {resolved === 'dark' ? 'Dark' : 'Light'}
              </button>
            }
          />
          <Row
            title="Backend"
            subtitle={
              backend === 'mock'
                ? 'Running on the in-memory mock. Set the Supabase environment variables to go live.'
                : 'Connected to Supabase.'
            }
            right={
              <span
                style={{
                  color: backend === 'mock' ? 'var(--amber)' : 'var(--online)',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                }}
              >
                {backend.toUpperCase()}
              </span>
            }
          />

          <div style={{ height: 20 }} />
          <Button
            variant="ghost"
            onClick={async () => {
              if (!window.confirm('This clears your profile and every pairing in this browser.')) {
                return;
              }
              await signOut();
              navigate('/welcome', { replace: true });
            }}
          >
            Reset this account
          </Button>
        </>
      )}

      <Toast message={toast.message} onDone={toast.clear} />
    </Screen>
  );
}
