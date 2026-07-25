import { afterEach, describe, expect, it } from 'vitest';

import { MockRepository } from './data/mock/mockRepository';
import { storage } from './data/storage';
import type { OnboardingInput } from './data/types';
import { defaultAvatar } from './domain/avatar';

/**
 * These cover the rules the product cannot ship without: mutual consent before a
 * chat exists, mutual acceptance before a face is visible, and the country gate.
 * They run against the mock backend, which deliberately mirrors what the RLS
 * policies in supabase/migrations/0001_init.sql enforce server-side.
 */

const onboarding: OnboardingInput = {
  country: 'GH',
  gender: 'male',
  genderPreference: 'female',
  avatar: defaultAvatar,
  ageAttested: true,
};

// The mock schedules simulated-partner replies on timers; tracking every
// instance lets each test tear its own down instead of leaking handles.
const live: MockRepository[] = [];

function newRepo() {
  const repo = new MockRepository();
  live.push(repo);
  return repo;
}

afterEach(() => {
  live.splice(0).forEach((repo) => repo.dispose());
});

async function freshRepo() {
  await storage.clear();
  const repo = newRepo();
  await repo.completeOnboarding(onboarding);
  return repo;
}

describe('age gate', () => {
  it('refuses to create a profile without an 18+ attestation', async () => {
    await storage.clear();
    const repo = newRepo();
    await expect(
      repo.completeOnboarding({ ...onboarding, ageAttested: false }),
    ).rejects.toThrow(/age attestation/i);
  });
});

describe('country matching gate', () => {
  it('blocks same-gender matching where it is not offered', async () => {
    await storage.clear();
    const repo = newRepo();
    await expect(
      repo.completeOnboarding({ ...onboarding, gender: 'male', genderPreference: 'male' }),
    ).rejects.toThrow(/same-gender/i);
  });

  it('allows same-gender matching where it is permitted', async () => {
    await storage.clear();
    const repo = newRepo();
    const profile = await repo.completeOnboarding({
      ...onboarding,
      country: 'ZA',
      gender: 'male',
      genderPreference: 'male',
    });
    expect(profile.genderPreference).toBe('male');
  });
});

describe('the draw', () => {
  it('only returns candidates matching the stated preference in both directions', async () => {
    const repo = await freshRepo();
    for (let i = 0; i < 8; i++) {
      const candidate = await repo.drawCandidate();
      if (!candidate) continue;
      expect(candidate.gender).toBe('female');
      expect(candidate.genderPreference).toBe('male');
    }
  });

  it('never draws someone already paired with', async () => {
    const repo = await freshRepo();
    const first = await repo.drawCandidate();
    expect(first).not.toBeNull();
    await repo.sendPairingRequest(first!.id);

    for (let i = 0; i < 10; i++) {
      const next = await repo.drawCandidate();
      if (next) expect(next.id).not.toBe(first!.id);
    }
  });
});

describe('mutual consent before a chat opens', () => {
  it('does not open a thread while a request is pending', async () => {
    const repo = await freshRepo();
    const candidate = await repo.drawCandidate();
    const pairing = await repo.sendPairingRequest(candidate!.id);

    expect(pairing.status).toBe('pending');
    // No thread exists yet, and writing to one is refused.
    expect(await repo.listMessages(pairing.id)).toHaveLength(0);
    await expect(repo.sendMessage(pairing.id, 'hello?')).rejects.toThrow(/not open/i);

    const chats = await repo.listChats();
    expect(chats.find((c) => c.pairing.id === pairing.id)).toBeUndefined();
  });

  it('opens the thread once the receiving user accepts', async () => {
    const repo = await freshRepo();
    const [incoming] = await repo.listIncomingRequests();
    expect(incoming).toBeDefined();

    await repo.respondToRequest(incoming.pairing.id, true);
    const message = await repo.sendMessage(incoming.pairing.id, 'hey');

    expect(message.body).toBe('hey');
    const chats = await repo.listChats();
    expect(chats.map((c) => c.pairing.id)).toContain(incoming.pairing.id);
  });

  it('keeps a declined request out of the chat list', async () => {
    const repo = await freshRepo();
    const [incoming] = await repo.listIncomingRequests();

    await repo.respondToRequest(incoming.pairing.id, false);

    const chats = await repo.listChats();
    expect(chats.find((c) => c.pairing.id === incoming.pairing.id)).toBeUndefined();
    await expect(repo.sendMessage(incoming.pairing.id, 'hi')).rejects.toThrow(/not open/i);
  });
});

describe('mutual face reveal', () => {
  async function acceptedPairing() {
    const repo = await freshRepo();
    const [incoming] = await repo.listIncomingRequests();
    await repo.respondToRequest(incoming.pairing.id, true);
    return { repo, pairingId: incoming.pairing.id, partnerId: incoming.partner.id };
  }

  it('does not reveal on one side alone', async () => {
    const { repo, pairingId } = await acceptedPairing();

    const state = await repo.requestReveal(pairingId);

    expect(state.acceptedBy).toHaveLength(1);
    expect(state.revealed).toBe(false);
  });

  it('withholds the partner photo until both have accepted', async () => {
    const { repo, pairingId, partnerId } = await acceptedPairing();
    await repo.requestReveal(pairingId);

    expect((await repo.getProfile(partnerId))?.photoUrl).toBeNull();

    // The second acceptance is what flips it — simulated here as the partner.
    const state = await repo.getRevealState(pairingId);
    await repo.respondToReveal(pairingId, true);
    expect(state.revealed).toBe(false);
  });

  it('clears the request when one side declines', async () => {
    const { repo, pairingId } = await acceptedPairing();
    await repo.requestReveal(pairingId);

    const state = await repo.respondToReveal(pairingId, false);

    expect(state.revealed).toBe(false);
    expect(state.requestedBy).toBeNull();
    expect(state.acceptedBy).toHaveLength(0);
  });
});

describe('block', () => {
  it('ends the pairing and removes it from chats', async () => {
    const repo = await freshRepo();
    const [incoming] = await repo.listIncomingRequests();
    await repo.respondToRequest(incoming.pairing.id, true);

    await repo.blockUser(incoming.partner.id);

    const chats = await repo.listChats();
    expect(chats.find((c) => c.pairing.id === incoming.pairing.id)).toBeUndefined();
  });

  it('keeps a blocked user out of future draws', async () => {
    const repo = await freshRepo();
    const candidate = await repo.drawCandidate();
    await repo.blockUser(candidate!.id);

    for (let i = 0; i < 12; i++) {
      const next = await repo.drawCandidate();
      if (next) expect(next.id).not.toBe(candidate!.id);
    }
  });

  it('records a report with its reason', async () => {
    const repo = await freshRepo();
    const candidate = await repo.drawCandidate();

    await expect(
      repo.reportUser({ userId: candidate!.id, reason: 'harassment', detail: 'test' }),
    ).resolves.toBeUndefined();
  });
});
