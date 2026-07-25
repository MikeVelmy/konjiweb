import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PixelAvatar } from '../components/PixelAvatar';
import { Button, Screen, Toast, useToast } from '../components/ui';
import { useRepository, useSession } from '../data/RepositoryProvider';
import type { Profile } from '../data/types';
import { avatarFromSeed } from '../domain/avatar';
import { avatarColors } from '../theme/tokens';

type Phase = 'idle' | 'drawing' | 'landed' | 'sent' | 'empty';

const SPIN_MS = 1600;
const REEL_LENGTH = 8;

export function Draw() {
  const repo = useRepository();
  const { profile } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('idle');
  const [candidate, setCandidate] = useState<Profile | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decorative only — real candidates are never shown mid-spin, since flashing
  // other users past someone would leak the pool.
  const decoys = useMemo(
    () =>
      Array.from({ length: REEL_LENGTH }, (_, i) =>
        avatarFromSeed(
          `reel-${i}`,
          avatarColors.map((c) => c.hex),
        ),
      ),
    [],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const startDraw = useCallback(async () => {
    setPhase('drawing');
    setCandidate(null);

    // The draw resolves immediately; the spin is held for its full duration
    // anyway so the reveal feels like a draw rather than a database read.
    const [result] = await Promise.all([
      repo.drawCandidate().catch(() => null),
      new Promise((resolve) => {
        timer.current = setTimeout(resolve, SPIN_MS);
      }),
    ]);

    if (!result) {
      setPhase('empty');
      return;
    }
    setCandidate(result);
    setPhase('landed');
  }, [repo]);

  const smash = async () => {
    if (!candidate) return;
    try {
      await repo.sendPairingRequest(candidate.id);
      setPhase('sent');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not send.');
    }
  };

  const pass = async () => {
    if (!candidate) return;
    await repo.passCandidate(candidate.id);
    startDraw();
  };

  const stageLabel =
    phase === 'drawing'
      ? 'Drawing your pair'
      : phase === 'landed'
        ? 'Match locked'
        : phase === 'sent'
          ? 'Request sent'
          : 'Ready when you are';

  return (
    <Screen>
      <h1 className="title">Lucky draw</h1>
      <p className="sub">
        {phase === 'sent'
          ? 'Sent. They decide next.'
          : 'One person at a time. No browsing, no scrolling.'}
      </p>

      <div className="draw-stage">
        <p className="label" style={{ textAlign: 'center', margin: 0 }} aria-live="polite">
          {stageLabel}
        </p>

        <div className={phase === 'drawing' ? 'reel reel--spinning' : 'reel'}>
          <div className="reel__track">
            {[...decoys, ...decoys].map((config, i) => (
              <div className="reel__item" key={i}>
                <PixelAvatar config={config} size={38} />
              </div>
            ))}
          </div>
          <div className="reel__fade" />

          {(phase === 'landed' || phase === 'sent') && candidate && (
            <div className="match-card">
              <div className="avatar-frame" style={{ width: 52, height: 52 }}>
                <PixelAvatar config={candidate.avatar} size={36} />
              </div>
              <div>
                <div className="match-card__name">{candidate.displayName}</div>
                <div className="match-card__tag">
                  {candidate.isOnline ? 'ONLINE NOW' : 'MATCH LOCKED'}
                </div>
              </div>
            </div>
          )}

          {phase === 'empty' && (
            <div className="reel__empty">
              <p className="row__title">Nobody left to draw</p>
              <p className="muted" style={{ marginTop: 6 }}>
                You have seen everyone matching your preference for now. Passed people come back
                around in an hour.
              </p>
            </div>
          )}
        </div>

        {(phase === 'idle' || phase === 'empty') && (
          <Button onClick={startDraw}>{phase === 'empty' ? 'Try again' : 'Draw a pair'}</Button>
        )}

        {phase === 'drawing' && <Button disabled>Drawing…</Button>}

        {phase === 'sent' && (
          <>
            <div className="panel">
              <p className="muted" style={{ margin: 0 }}>
                {candidate?.displayName} has to accept before a chat opens. You will see it in
                Requests either way.
              </p>
            </div>
            <Button onClick={startDraw}>Draw another</Button>
          </>
        )}

        {phase === 'landed' && (
          <>
            <div className="btn-row">
              <Button variant="ghost" onClick={pass}>
                Pass
              </Button>
              <Button onClick={smash}>Smash</Button>
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => navigate(`/report/${candidate!.id}`)}
            >
              Block or report
            </button>
          </>
        )}
      </div>

      {profile && (
        <p className="muted" style={{ textAlign: 'center' }}>
          Drawing from {profile.genderPreference === 'male' ? 'men' : 'women'} in your country
        </p>
      )}

      <Toast message={toast.message} onDone={toast.clear} />
    </Screen>
  );
}
