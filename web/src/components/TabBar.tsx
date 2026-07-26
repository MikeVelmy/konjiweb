import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useRepository } from '../data/RepositoryProvider';

/** Tabs whose icon is a mask of an artwork file. */
const ART = ['chats', 'requests', 'me'] as const;

type Shape = 'draw' | (typeof ART)[number];

function isArt(shape: Shape): shape is (typeof ART)[number] {
  return (ART as readonly string[]).includes(shape);
}

/*
 * A die, for the lucky draw — the same five pips the old pixel grid spelled out,
 * now on a face. It stays drawn in code rather than becoming a fourth artwork
 * file: it is four shapes, it costs no request, and being a vector it holds its
 * edges at any density. The rounded square and the 2px stroke are set to match
 * the weight of the artwork glyphs beside it.
 */
function DrawIcon() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
      <rect
        x="3.4"
        y="3.4"
        width="17.2"
        height="17.2"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <g fill="currentColor">
        <circle cx="8.6" cy="8.6" r="1.8" />
        <circle cx="15.4" cy="8.6" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="8.6" cy="15.4" r="1.8" />
        <circle cx="15.4" cy="15.4" r="1.8" />
      </g>
    </svg>
  );
}

function TabIcon({ shape, badge }: { shape: Shape; badge?: number }) {
  const art = isArt(shape);

  return (
    <span
      className={art ? `tab-icon tab-icon--art tab-icon--${shape}` : 'tab-icon'}
      aria-hidden="true"
    >
      {art ? null : <DrawIcon />}
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
