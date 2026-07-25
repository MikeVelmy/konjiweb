import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AvatarFrame } from '../components/PixelAvatar';
import { Screen, Toast, useToast } from '../components/ui';
import { useRepository, useSession } from '../data/RepositoryProvider';
import type { Message, PairingWithPartner } from '../data/types';

export function Chat() {
  const { id } = useParams<{ id: string }>();
  const repo = useRepository();
  const { profile } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const [row, setRow] = useState<PairingWithPartner | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [pairing, msgs] = await Promise.all([repo.getPairing(id), repo.listMessages(id)]);
    setRow(pairing);
    setMessages(msgs);
    setLoading(false);
    repo.markRead(id);
  }, [id, repo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const unsubMessages = repo.subscribeToMessages(id, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      repo.markRead(id);
    });
    // Reveal state changes ride the pairing channel, so the banner updates the
    // moment the other person accepts.
    const unsubPairings = repo.subscribeToPairings(() => {
      repo.getPairing(id).then(setRow);
    });
    return () => {
      unsubMessages();
      unsubPairings();
    };
  }, [id, repo]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !id) return;
    setDraft('');
    try {
      const message = await repo.sendMessage(id, body);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    } catch (err) {
      setDraft(body);
      toast.show(err instanceof Error ? err.message : 'Not sent.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <p className="muted" style={{ margin: 'auto' }}>
          Loading…
        </p>
      </Screen>
    );
  }

  if (!row) {
    return (
      <Screen>
        <div className="empty">
          <p className="row__title">This conversation is closed</p>
          <button type="button" className="link-btn" onClick={() => navigate('/chats')}>
            Back to chats
          </button>
        </div>
      </Screen>
    );
  }

  const me = profile?.id;
  const revealPending =
    !row.reveal.revealed && row.reveal.requestedBy !== null && me
      ? !row.reveal.acceptedBy.includes(me)
      : false;
  const waitingOnThem = !row.reveal.revealed && me ? row.reveal.acceptedBy.includes(me) : false;

  return (
    <Screen flush>
      <div className="chat">
        <header className="chat__header">
          <button
            type="button"
            className="icon-btn"
            aria-label="Back"
            onClick={() => navigate('/chats')}
          >
            ‹
          </button>

          <AvatarFrame config={row.partner.avatar} size={40} accent={row.reveal.revealed} />

          <div className="row__body">
            <div className="chat__name">{row.partner.displayName}</div>
            <div
              className={
                row.partner.isOnline ? 'chat__status chat__status--online' : 'chat__status'
              }
            >
              {row.partner.isOnline ? '● online' : 'offline'}
            </div>
          </div>

          <button
            type="button"
            className="pill-btn"
            onClick={() => navigate(`/reveal/${row.pairing.id}`)}
          >
            {row.reveal.revealed ? 'Revealed' : waitingOnThem ? 'Pending' : 'Reveal'}
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label="Block or report"
            onClick={() => navigate(`/report/${row.partner.id}?pairingId=${row.pairing.id}`)}
          >
            ⋮
          </button>
        </header>

        {revealPending && (
          <button
            type="button"
            className="panel panel--amber"
            style={{ margin: 12, textAlign: 'left', width: 'auto' }}
            onClick={() => navigate(`/reveal/${row.pairing.id}`)}
          >
            <p className="label" style={{ color: 'var(--amber)', margin: 0 }}>
              Reveal requested
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.9rem' }}>
              {row.partner.displayName} wants to swap faces. Nothing happens unless you agree too.
            </p>
          </button>
        )}

        <div className="chat__log" ref={logRef}>
          {messages.length === 0 && (
            <p className="muted" style={{ textAlign: 'center', marginTop: 32 }}>
              You matched. No faces, no pressure — just start.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.senderId === me ? 'bubble bubble--me' : 'bubble bubble--them'}>
              {m.body}
            </div>
          ))}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="visually-hidden" htmlFor="composer-input" style={{ display: 'none' }}>
            Message
          </label>
          <textarea
            id="composer-input"
            value={draft}
            rows={1}
            placeholder="Type a message…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends on a desktop keyboard; Shift+Enter makes a newline.
              // On touch keyboards Enter inserts a newline as usual.
              if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" disabled={!draft.trim()} aria-label="Send">
            ↑
          </button>
        </form>
      </div>

      <Toast message={toast.message} onDone={toast.clear} />
    </Screen>
  );
}
