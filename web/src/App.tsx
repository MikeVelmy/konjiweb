import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { TabBar } from './components/TabBar';
import { useSession } from './data/RepositoryProvider';
import { Chat } from './screens/Chat';
import { Chats } from './screens/Chats';
import { Draw } from './screens/Draw';
import { Me } from './screens/Me';
import { OnboardingAvatar } from './screens/OnboardingAvatar';
import { OnboardingIdentity } from './screens/OnboardingIdentity';
import { OnboardingWelcome } from './screens/OnboardingWelcome';
import { Report } from './screens/Report';
import { Requests } from './screens/Requests';
import { Reveal } from './screens/Reveal';

/** Routes that render without the tab bar — onboarding and full-screen flows. */
const CHROMELESS = ['/welcome', '/identity', '/avatar', '/chat/', '/reveal/', '/report/'];

export function App() {
  const { profile, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="shell">
        <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  // Anyone without a profile is pushed back into onboarding, whatever URL they
  // arrived on — deep links are shareable on the web in a way they are not in a
  // native build.
  const onboarded = Boolean(profile);
  const onOnboarding = ['/welcome', '/identity', '/avatar'].includes(location.pathname);

  if (!onboarded && !onOnboarding) return <Navigate to="/welcome" replace />;
  if (onboarded && onOnboarding) return <Navigate to="/" replace />;

  const showTabs =
    onboarded && !CHROMELESS.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <div className="shell">
      <Routes>
        <Route path="/welcome" element={<OnboardingWelcome />} />
        <Route path="/identity" element={<OnboardingIdentity />} />
        <Route path="/avatar" element={<OnboardingAvatar />} />

        <Route path="/" element={<Draw />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/me" element={<Me />} />

        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/reveal/:id" element={<Reveal />} />
        <Route path="/report/:userId" element={<Report />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabs && <TabBar />}
    </div>
  );
}
