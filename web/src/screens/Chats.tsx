import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AvatarFrame } from '../components/PixelAvatar';
import { Empty, Screen } from '../components/ui';
import { useRepository } from '../data/RepositoryProvider';
import type { PairingWithPartner } from '../data/types';

export function Chats() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [chats, setChats] = useState<PairingWithPartner[]>([]);

  const load = useCallback(async () => {
    setChats(await repo.listChats());
  }, [repo]);

  useEffect(() => {
    load();
    return repo.subscribeToPairings(load);
  }, [repo, load]);

  return (
    <Screen>
      <h1 className="title">Chats</h1>
      <p className="sub">Both of you said yes to be here.</p>
      <div style={{ height: 20 }} />

      {chats.length === 0 ? (
        <Empty
          title="No open chats yet"
          body="When a pairing is accepted by both sides, the conversation lands here."
        />
      ) : (
        chats.map((row) => (
          <button
            key={row.pairing.id}
            type="button"
            className={row.unreadCount > 0 ? 'row row--unread' : 'row'}
            onClick={() => navigate(`/chat/${row.pairing.id}`)}
          >
            <AvatarFrame config={row.partner.avatar} size={50} accent={row.reveal.revealed} />
            <span className="row__body">
              <span className="row__title">
                {row.partner.displayName}
                {row.reveal.revealed && (
                  <span
                    style={{
                      color: 'var(--amber)',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      marginLeft: 8,
                    }}
                  >
                    REVEALED
                  </span>
                )}
              </span>
              <span className="row__meta">
                {row.lastMessage?.body ?? 'Say something first.'}
              </span>
            </span>
            {row.unreadCount > 0 && <span className="badge">{row.unreadCount}</span>}
          </button>
        ))
      )}
    </Screen>
  );
}
