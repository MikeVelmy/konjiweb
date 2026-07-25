import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { RepositoryProvider } from './data/RepositoryProvider';
import { storage } from './data/storage';
import { OnboardingDraftProvider } from './screens/onboardingDraft';
import { ThemeProvider } from './theme/ThemeProvider';

/**
 * Typechecking proves the screens compile; this proves they actually mount and
 * render. Every screen here reaches real repository calls, so a broken provider
 * wiring or a bad hook order shows up as a failure rather than a blank page in
 * production.
 */

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <RepositoryProvider>
        <OnboardingDraftProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </OnboardingDraftProvider>
      </RepositoryProvider>
    </ThemeProvider>,
  );
}

afterEach(async () => {
  cleanup();
  await storage.clear();
  window.sessionStorage.clear();
});

describe('app shell', () => {
  it('lands a brand new visitor on onboarding', async () => {
    renderAt('/');
    expect(await screen.findByText(/no face/i)).toBeTruthy();
    expect(screen.getByText(/18 or older/i)).toBeTruthy();
  });

  it('redirects a deep link to onboarding when there is no profile', async () => {
    // Web routes are shareable in a way native screens are not, so an
    // un-onboarded visitor hitting /chats must not land on a broken screen.
    renderAt('/chats');
    expect(await screen.findByText(/no face/i)).toBeTruthy();
  });

  it('shows the country gate explanation for Ghana', async () => {
    renderAt('/identity');
    expect(await screen.findByText(/set yourself up/i)).toBeTruthy();
    expect(screen.getByText(/only offers same-gender matching/i)).toBeTruthy();
  });
});

describe('onboarded screens', () => {
  async function onboard() {
    const { MockRepository } = await import('./data/mock/mockRepository');
    const repo = new MockRepository();
    const { defaultAvatar } = await import('./domain/avatar');
    await repo.completeOnboarding({
      country: 'GH',
      gender: 'male',
      genderPreference: 'female',
      avatar: defaultAvatar,
      ageAttested: true,
    });
    repo.dispose();
  }

  it('renders the draw screen with the tab bar', async () => {
    await onboard();
    await act(async () => {
      renderAt('/');
    });
    await waitFor(() => expect(screen.getByText(/lucky draw/i)).toBeTruthy());
    expect(screen.getByRole('navigation', { name: /main/i })).toBeTruthy();
    expect(screen.getByText(/draw a pair/i)).toBeTruthy();
  });

  it('renders seeded incoming requests with the nudge copy', async () => {
    await onboard();
    await act(async () => {
      renderAt('/requests');
    });
    await waitFor(() => expect(screen.getByText(/waiting on you/i)).toBeTruthy());
    expect(screen.getByText(/quick no is kinder than silence/i)).toBeTruthy();
  });

  it('renders the profile screen and reports the live backend', async () => {
    await onboard();
    await act(async () => {
      renderAt('/me');
    });
    // The default name shows twice by design: once under the avatar, once in
    // the "Your name" row that offers the paid custom-username upgrade.
    await waitFor(() => expect(screen.getAllByText(/Emmett/).length).toBe(2));
    expect(screen.getByText('MOCK')).toBeTruthy();
  });

  it('renders the report screen reachable from anywhere', async () => {
    await onboard();
    await act(async () => {
      renderAt('/report/seed-0');
    });
    await waitFor(() => expect(screen.getByText(/what is going on/i)).toBeTruthy());
    expect(screen.getByText(/harassment or abuse/i)).toBeTruthy();
  });
});
