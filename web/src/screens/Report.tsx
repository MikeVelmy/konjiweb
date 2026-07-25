import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Button, Screen, Toast, useToast } from '../components/ui';
import { useRepository } from '../data/RepositoryProvider';
import { REPORT_REASONS, type ReportReason } from '../data/types';

/**
 * Reachable from the draw, the requests list, and any chat. The spec treats
 * block and report as a pre-launch requirement, so it is available before a
 * conversation has even opened — not only from inside one.
 */
export function Report() {
  const { userId } = useParams<{ userId: string }>();
  const [params] = useSearchParams();
  const pairingId = params.get('pairingId');
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const done = (message: string) => {
    toast.show(message);
    setTimeout(() => navigate('/', { replace: true }), 1200);
  };

  const submitReport = async () => {
    if (!reason || !userId) return;
    setBusy(true);
    try {
      await repo.reportUser({
        userId,
        pairingId,
        reason,
        detail: detail.trim() || undefined,
      });
      if (alsoBlock) await repo.blockUser(userId);
      done(
        alsoBlock
          ? 'Report sent. They can no longer reach you.'
          : 'Report sent. Our team will review it.',
      );
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not send.');
      setBusy(false);
    }
  };

  const blockOnly = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await repo.blockUser(userId);
      done('Blocked. They can no longer reach you or be drawn by you.');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not block.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="title">Report</h1>
        <button type="button" className="link-btn" onClick={() => navigate(-1)}>
          Close
        </button>
      </div>
      <p className="sub">Tell us what happened. Reports are reviewed by a person.</p>

      <div style={{ height: 24 }} />

      <p className="label">What is going on</p>
      <div role="radiogroup" aria-label="Reason for the report">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            className="choice"
            role="radio"
            aria-checked={reason === r.value}
            onClick={() => setReason(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ height: 18 }} />

      <label className="field">
        <span className="label">Anything else (optional)</span>
        <textarea
          value={detail}
          placeholder="What happened, in your own words"
          onChange={(e) => setDetail(e.target.value)}
        />
      </label>

      <button
        type="button"
        className="check"
        role="checkbox"
        aria-checked={alsoBlock}
        onClick={() => setAlsoBlock((v) => !v)}
      >
        <span className="check__box" aria-hidden="true">
          {alsoBlock ? '✓' : ''}
        </span>
        <span>Block them too, so they cannot reach me again</span>
      </button>

      <div style={{ height: 24 }} />

      <Button disabled={!reason || busy} onClick={submitReport}>
        {busy ? 'Sending…' : 'Send report'}
      </Button>
      <div style={{ height: 12 }} />
      <Button variant="ghost" disabled={busy} onClick={blockOnly}>
        Just block, no report
      </Button>

      <Toast message={toast.message} onDone={toast.clear} />
    </Screen>
  );
}
