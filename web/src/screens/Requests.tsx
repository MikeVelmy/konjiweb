import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AvatarFrame } from '../components/PixelAvatar';
import { Button, Empty, Screen, Toast, timeAgo, useToast } from '../components/ui';
import { useRepository } from '../data/RepositoryProvider';
import type { PairingWithPartner } from '../data/types';

export function Requests() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();

  const [incoming, setIncoming] = useState<PairingWithPartner[]>([]);
  const [outgoing, setOutgoing] = useState<PairingWithPartner[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [inc, out] = await Promise.all([
      repo.listIncomingRequests(),
      repo.listOutgoingRequests(),
    ]);
    setIncoming(inc);
    setOutgoing(out);
  }, [repo]);

  useEffect(() => {
    load();
    return repo.subscribeToPairings(load);
  }, [repo, load]);

  const respond = async (row: PairingWithPartner, accept: boolean) => {
    setBusy(row.pairing.id);
    try {
      await repo.respondToRequest(row.pairing.id, accept);
      await load();
      if (accept) navigate(`/chat/${row.pairing.id}`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not respond.');
    } finally {
      setBusy(null);
    }
  };

  const isEmpty = incoming.length === 0 && outgoing.length === 0;

  return (
    <Screen>
      <h1 className="title">Requests</h1>
      <p className="sub">Nothing opens until you say yes.</p>
      <div style={{ height: 20 }} />

      {isEmpty ? (
        <Empty
          title="Nothing waiting"
          body="Draw a pair and your requests — the ones you send and the ones you get — show up here."
        />
      ) : (
        <>
          {incoming.length > 0 && (
            <>
              <p className="label">Waiting on you</p>
              {/* The nudge from the spec's P1 list, placed where the delay happens. */}
              <p style={{ color: 'var(--amber)', fontSize: '0.85rem', margin: '0 0 14px' }}>
                Do not keep your pair waiting — a quick no is kinder than silence.
              </p>

              {incoming.map((row) => (
                <div className="panel panel--accent" key={row.pairing.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AvatarFrame config={row.partner.avatar} size={54} />
                    <div className="row__body">
                      <div className="row__title">{row.partner.displayName}</div>
                      <div className="row__meta">drew you {timeAgo(row.pairing.createdAt)}</div>
                    </div>
                  </div>
                  <div className="btn-row" style={{ marginTop: 16 }}>
                    <Button
                      variant="ghost"
                      disabled={busy === row.pairing.id}
                      onClick={() => respond(row, false)}
                    >
                      Decline
                    </Button>
                    <Button disabled={busy === row.pairing.id} onClick={() => respond(row, true)}>
                      Accept
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => navigate(`/report/${row.partner.id}`)}
                  >
                    Block or report
                  </button>
                </div>
              ))}
              <div style={{ height: 16 }} />
            </>
          )}

          {outgoing.length > 0 && (
            <>
              <p className="label">Waiting on them</p>
              {outgoing.map((row) => (
                <div className="row" key={row.pairing.id}>
                  <AvatarFrame config={row.partner.avatar} size={46} />
                  <div className="row__body">
                    <div className="row__title">{row.partner.displayName}</div>
                    <div className="row__meta">
                      sent {timeAgo(row.pairing.createdAt)} · pending
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      <Toast message={toast.message} onDone={toast.clear} />
    </Screen>
  );
}
