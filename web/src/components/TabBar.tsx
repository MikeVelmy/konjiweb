import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useRepository } from '../data/RepositoryProvider';

const SHAPES = {
  draw: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  requests: [1, 1, 1, 0, 1, 0, 0, 1, 0],
  chats: [1, 1, 1, 1, 1, 1, 1, 0, 0],
  me: [0, 1, 0, 1, 1, 1, 1, 1, 1],
} as const;

function TabIcon({ shape, badge }: { shape: keyof typeof SHAPES; badge?: number }) {
  return (
    <span className="tab-icon" aria-hidden="true">
      {SHAPES[shape].map((on, i) => (
        <i key={i} data-off={on ? '0' : '1'} />
      ))}
      {badge ? (
        <span className={shape === 'chats' ? 'badge badge--amber' : 'badge'}>
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </span>
  );
}

export function TabBar() {
  const repo = useRepository();
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [incoming, chats] = await Promise.all([
        repo.listIncomingRequests(),
        repo.listChats(),
      ]);
      setPending(incoming.length);
      setUnread(chats.filter((c) => c.unreadCount > 0).length);
    } catch {
      // A badge count is not worth surfacing an error over.
    }
  }, [repo]);

  useEffect(() => {
    refresh();
    return repo.subscribeToPairings(refresh);
  }, [repo, refresh]);

  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/" end>
        <TabIcon shape="draw" />
        Draw
      </NavLink>
      <NavLink to="/requests">
        <TabIcon shape="requests" badge={pending} />
        Requests
      </NavLink>
      <NavLink to="/chats">
        <TabIcon shape="chats" badge={unread} />
        Chats
      </NavLink>
      <NavLink to="/me">
        <TabIcon shape="me" />
        Me
      </NavLink>
    </nav>
  );
}
