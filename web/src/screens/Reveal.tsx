import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PixelAvatar } from '../components/PixelAvatar';
import { Button, Screen, Toast, useToast } from '../components/ui';
import { useRepository, useSession } from '../data/RepositoryProvider';
import type { PairingWithPartner } from '../data/types';

type Stage = 'loading' | 'needs_photo' | 'idle' | 'waiting' | 'asked' | 'revealed';

export function Reveal() {
  const { id } = useParams<{ id: string }>();
  const repo = useRepository();
  const { profile, refreshProfile } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const [row, setRow] = useState<PairingWithPartner | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  const resolveStage = useCallback(
    (current: PairingWithPartner | null): Stage => {
      if (!current || !profile) return 'loading';
      if (current.reveal.revealed) return 'revealed';
      // A reveal you cannot honour is not a reveal — you need a photo before
      // you are allowed to ask for someone else's.
      if (!profile.hasPhoto) return 'needs_photo';
      if (current.reveal.acceptedBy.includes(profile.id)) return 'waiting';
      if (current.reveal.requestedBy) return 'asked';
      return 'idle';
    },
    [profile],
  );

  const load = useCallback(async () => {
    if (!id) return;
    const next = await repo.getPairing(id);
    setRow(next);
    setStage(resolveStage(next));
  }, [id, repo, resolveStage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    return repo.subscribeToPairings(load);
  }, [id, repo, load]);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      await repo.setPhoto(objectUrl.current);
      await refreshProfile();
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (accept: boolean) => {
    if (!id) return;
    setBusy(true);
    try {
      if (accept) await repo.requestReveal(id);
      else await repo.respondToReveal(id, false);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not do that.');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'loading' || !row) {
    return (
      <Screen>
        <p className="muted" style={{ margin: 'auto' }}>
          Loading…
        </p>
      </Screen>
    );
  }

  const partner = row.partner;
  const showRealPhoto =
    stage === 'revealed' && partner.photoUrl && !partner.photoUrl.startsWith('mock://');

  return (
    <Screen>
      <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
        ‹
      </button>

      <div className="reveal">
        <div className={stage === 'revealed' ? 'reveal__ring reveal__ring--done' : 'reveal__ring'}>
          {showRealPhoto ? (
            <img src={partner.photoUrl!} alt={`${partner.displayName}'s face`} />
          ) : (
            <PixelAvatar config={partner.avatar} size={104} />
          )}
        </div>

        {stage === 'revealed' && (
          <>
            <h1 className="title">You both said yes</h1>
            <p className="sub">
              {partner.photoUrl?.startsWith('mock://')
                ? `${partner.displayName} has no photo on the mock backend, so their avatar stands in. On a real project their face loads here.`
                : 'Faces are visible now. Everything before this stays exactly how it was.'}
            </p>
            <Button onClick={() => navigate(-1)}>Back to chat</Button>
          </>
        )}

        {stage === 'needs_photo' && (
          <>
            <h1 className="title">Add your photo first</h1>
            <p className="sub">
              Nobody can see it. It stays locked until you and {partner.displayName} have both said
              yes — and it unlocks for nobody else, ever.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
            />
            <Button disabled={busy} onClick={() => fileInput.current?.click()}>
              {busy ? 'Saving…' : 'Choose a photo'}
            </Button>
          </>
        )}

        {stage === 'idle' && (
          <>
            <h1 className="title">Ready to show your face?</h1>
            <p className="sub">
              Asking counts as your yes. {partner.displayName} still has to say yes on their side
              before either face appears.
            </p>
            <Button variant="amber" disabled={busy} onClick={() => act(true)}>
              {busy ? 'Sending…' : 'Request reveal'}
            </Button>
          </>
        )}

        {stage === 'waiting' && (
          <>
            <h1 className="title">Waiting on {partner.displayName}</h1>
            <p className="sub">
              Your yes is recorded. Nothing is visible to them until they say yes too.
            </p>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Back to chat
            </Button>
          </>
        )}

        {stage === 'asked' && (
          <>
            <h1 className="title">{partner.displayName} asked to reveal</h1>
            <p className="sub">
              Say yes and you both appear at the same moment. Say no and nothing changes — they are
              not told why.
            </p>
            <div className="btn-row">
              <Button variant="ghost" disabled={busy} onClick={() => act(false)}>
                Not yet
              </Button>
              <Button variant="amber" disabled={busy} onClick={() => act(true)}>
                Show faces
              </Button>
            </div>
          </>
        )}
      </div>

      <Toast message={toast.message} onDone={toast.clear} />
    </Screen>
  );
}
