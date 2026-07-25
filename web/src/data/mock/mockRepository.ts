import { avatarFromSeed, type AvatarConfig } from '../../domain/avatar';
import { allowsSameGenderMatching } from '../../domain/countries';
import { avatarColors } from '../../theme/tokens';
import type { Repository } from '../repository';
import { storage } from '../storage';
import {
  DEFAULT_NAMES,
  type Gender,
  type Message,
  type OnboardingInput,
  type Pairing,
  type PairingWithPartner,
  type Profile,
  type ReportReason,
  type RevealState,
} from '../types';

const STORAGE_KEY = 'konji.mock.db.v1';
const ME = 'me';

type Report = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  pairingId?: string | null;
  reason: ReportReason;
  detail?: string;
  createdAt: string;
};

type Db = {
  profiles: Record<string, Profile>;
  pairings: Pairing[];
  messages: Message[];
  reveals: Record<string, RevealState>;
  blocks: { blockerId: string; blockedId: string }[];
  reports: Report[];
  passed: string[];
  readAt: Record<string, string>;
};

const id = () => Math.random().toString(36).slice(2, 11);
const now = () => new Date().toISOString();

const PALETTE = avatarColors.map((c) => c.hex);

const SEED_NAMES_F = ['Caroline', 'Caroline', 'Caroline', 'Ama', 'Caroline', 'Nana'];
const SEED_NAMES_M = ['Emmett', 'Emmett', 'Kwame', 'Emmett', 'Emmett', 'Kofi'];

/** Canned partner replies so the chat loop is demonstrable without a second device. */
const REPLIES = [
  "hey — wasn't expecting a draw this fast",
  'ok so what actually made you hit smash',
  "I'll be honest, this app is a weird idea. good weird",
  'what do you do when you are not on here',
  'ha. that is a better answer than most',
  "alright you have my attention",
];

function seedProfiles(): Record<string, Profile> {
  const out: Record<string, Profile> = {};
  for (let i = 0; i < 12; i++) {
    const gender: Gender = i % 2 === 0 ? 'female' : 'male';
    const pool = gender === 'female' ? SEED_NAMES_F : SEED_NAMES_M;
    const uid = `seed-${i}`;
    out[uid] = {
      id: uid,
      country: 'GH',
      gender,
      genderPreference: gender === 'female' ? 'male' : 'female',
      displayName: pool[i % pool.length],
      isCustomName: pool[i % pool.length] !== DEFAULT_NAMES[gender],
      avatar: avatarFromSeed(uid, PALETTE),
      gpsOptIn: i % 3 === 0,
      hasPhoto: true,
      photoUrl: null,
      isOnline: i % 4 !== 0,
      createdAt: now(),
    };
  }
  return out;
}

function emptyDb(): Db {
  return {
    profiles: seedProfiles(),
    pairings: [],
    messages: [],
    reveals: {},
    blocks: [],
    reports: [],
    passed: [],
    readAt: {},
  };
}

/**
 * In-memory backend with localStorage persistence. It implements the same rules
 * the Supabase migrations enforce — mutual consent before a chat exists, mutual
 * acceptance before a photo is returned — so behaviour does not change when the
 * real backend is switched on.
 */
export class MockRepository implements Repository {
  private db: Db = emptyDb();
  private loaded = false;
  private messageListeners = new Map<string, Set<(m: Message) => void>>();
  private pairingListeners = new Set<() => void>();
  private replyTimers = new Set<ReturnType<typeof setTimeout>>();

  private async load() {
    if (this.loaded) return;
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.db = { ...emptyDb(), ...(JSON.parse(raw) as Db) };
      } catch {
        this.db = emptyDb();
      }
    }
    this.loaded = true;
  }

  private async persist() {
    await storage.setItem(STORAGE_KEY, JSON.stringify(this.db));
  }

  private me(): Profile | null {
    return this.db.profiles[ME] ?? null;
  }

  private requireMe(): Profile {
    const me = this.me();
    if (!me) throw new Error('Not onboarded');
    return me;
  }

  async getCurrentUserId() {
    await this.load();
    return this.db.profiles[ME] ? ME : null;
  }

  async signIn() {
    await this.load();
    return ME;
  }

  async signOut() {
    await this.load();
    this.db = emptyDb();
    await this.persist();
  }

  async getProfile(userId: string) {
    await this.load();
    const p = this.db.profiles[userId];
    if (!p) return null;
    if (userId === ME) return p;
    // Mirrors the server rule: a partner's photo is withheld unless revealed.
    return { ...p, photoUrl: this.isRevealedWith(userId) ? this.mockPhoto(userId) : null };
  }

  private mockPhoto(userId: string) {
    // The mock has no real uploads; a stable placeholder stands in for the file
    // so the reveal screen has something concrete to show.
    return `mock://photo/${userId}`;
  }

  private isRevealedWith(userId: string) {
    const pairing = this.db.pairings.find(
      (p) =>
        p.status === 'accepted' &&
        (p.userAId === userId || p.userBId === userId) &&
        (p.userAId === ME || p.userBId === ME),
    );
    if (!pairing) return false;
    return this.db.reveals[pairing.id]?.revealed ?? false;
  }

  async completeOnboarding(input: OnboardingInput) {
    await this.load();
    if (!input.ageAttested) throw new Error('Age attestation is required');
    if (
      input.gender === input.genderPreference &&
      !allowsSameGenderMatching(input.country)
    ) {
      throw new Error('Same gender matching is not available in this country');
    }
    const profile: Profile = {
      id: ME,
      country: input.country,
      gender: input.gender,
      genderPreference: input.genderPreference,
      displayName: DEFAULT_NAMES[input.gender],
      isCustomName: false,
      avatar: input.avatar,
      gpsOptIn: false,
      hasPhoto: false,
      photoUrl: null,
      isOnline: true,
      createdAt: now(),
    };
    this.db.profiles[ME] = profile;
    this.seedIncomingRequests();
    await this.persist();
    return profile;
  }

  /** Gives a brand new user something waiting in Requests, so the screen has a story. */
  private seedIncomingRequests() {
    const me = this.requireMe();
    const candidates = Object.values(this.db.profiles).filter(
      (p) => p.id !== ME && p.gender === me.genderPreference,
    );
    candidates.slice(0, 2).forEach((c) => {
      this.db.pairings.push({
        id: id(),
        userAId: c.id,
        userBId: ME,
        initiatedBy: c.id,
        status: 'pending',
        createdAt: now(),
      });
    });
  }

  private async patchMe(patch: Partial<Profile>) {
    await this.load();
    const me = this.requireMe();
    const next = { ...me, ...patch };
    this.db.profiles[ME] = next;
    await this.persist();
    return next;
  }

  updateAvatar(avatar: AvatarConfig) {
    return this.patchMe({ avatar });
  }

  setGpsOptIn(gpsOptIn: boolean) {
    return this.patchMe({ gpsOptIn });
  }

  setDisplayName(name: string) {
    return this.patchMe({ displayName: name, isCustomName: true });
  }

  setPhoto(localUri: string) {
    return this.patchMe({ hasPhoto: true, photoUrl: localUri });
  }

  private isBlocked(otherId: string) {
    return this.db.blocks.some(
      (b) =>
        (b.blockerId === ME && b.blockedId === otherId) ||
        (b.blockerId === otherId && b.blockedId === ME),
    );
  }

  private hasPairingWith(otherId: string) {
    return this.db.pairings.some(
      (p) =>
        p.status !== 'declined' &&
        ((p.userAId === ME && p.userBId === otherId) ||
          (p.userBId === ME && p.userAId === otherId)),
    );
  }

  async drawCandidate() {
    await this.load();
    const me = this.requireMe();
    const pool = Object.values(this.db.profiles).filter(
      (p) =>
        p.id !== ME &&
        p.gender === me.genderPreference &&
        p.genderPreference === me.gender &&
        !this.isBlocked(p.id) &&
        !this.hasPairingWith(p.id) &&
        !this.db.passed.includes(p.id),
    );
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async sendPairingRequest(candidateId: string) {
    await this.load();
    this.requireMe();
    if (this.isBlocked(candidateId)) throw new Error('Unavailable');
    const pairing: Pairing = {
      id: id(),
      userAId: ME,
      userBId: candidateId,
      initiatedBy: ME,
      status: 'pending',
      createdAt: now(),
    };
    this.db.pairings.push(pairing);
    await this.persist();
    this.pairingListeners.forEach((fn) => fn());
    // Seeded users answer on their own so the consent loop can be walked solo.
    this.schedule(() => this.autoRespond(pairing.id), 4000 + Math.random() * 4000);
    return pairing;
  }

  private schedule(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      this.replyTimers.delete(t);
      fn();
    }, ms);
    this.replyTimers.add(t);
  }

  /**
   * Cancels the simulated-partner timers. Only tests need this — in the app the
   * repository lives as long as the process does.
   */
  dispose() {
    this.replyTimers.forEach(clearTimeout);
    this.replyTimers.clear();
    this.messageListeners.clear();
    this.pairingListeners.clear();
  }

  private async autoRespond(pairingId: string) {
    const pairing = this.db.pairings.find((p) => p.id === pairingId);
    if (!pairing || pairing.status !== 'pending') return;
    pairing.status = Math.random() < 0.75 ? 'accepted' : 'declined';
    pairing.respondedAt = now();
    if (pairing.status === 'accepted') {
      this.pushPartnerMessage(pairing, REPLIES[0]);
    }
    await this.persist();
    this.pairingListeners.forEach((fn) => fn());
  }

  async passCandidate(candidateId: string) {
    await this.load();
    this.db.passed.push(candidateId);
    // The pass list is a short memory, not a permanent ban — otherwise a small
    // user base drains to an empty pool within a session.
    if (this.db.passed.length > 6) this.db.passed.shift();
    await this.persist();
  }

  private partnerOf(pairing: Pairing) {
    const otherId = pairing.userAId === ME ? pairing.userBId : pairing.userAId;
    return this.db.profiles[otherId];
  }

  private async decorate(pairing: Pairing): Promise<PairingWithPartner> {
    const partner = this.partnerOf(pairing);
    const msgs = this.db.messages.filter((m) => m.pairingId === pairing.id);
    const readAt = this.db.readAt[pairing.id];
    return {
      pairing,
      partner: {
        ...partner,
        photoUrl: this.db.reveals[pairing.id]?.revealed ? this.mockPhoto(partner.id) : null,
      },
      lastMessage: msgs.length ? msgs[msgs.length - 1] : null,
      unreadCount: msgs.filter(
        (m) => m.senderId !== ME && (!readAt || m.sentAt > readAt),
      ).length,
      reveal: this.reveal(pairing.id),
    };
  }

  private reveal(pairingId: string): RevealState {
    return (
      this.db.reveals[pairingId] ?? {
        pairingId,
        requestedBy: null,
        acceptedBy: [],
        revealed: false,
      }
    );
  }

  async listIncomingRequests() {
    await this.load();
    const rows = this.db.pairings.filter(
      (p) => p.status === 'pending' && p.userBId === ME && !this.isBlocked(p.userAId),
    );
    return Promise.all(rows.map((p) => this.decorate(p)));
  }

  async listOutgoingRequests() {
    await this.load();
    const rows = this.db.pairings.filter(
      (p) => p.status === 'pending' && p.initiatedBy === ME,
    );
    return Promise.all(rows.map((p) => this.decorate(p)));
  }

  async respondToRequest(pairingId: string, accept: boolean) {
    await this.load();
    const pairing = this.db.pairings.find((p) => p.id === pairingId);
    if (!pairing) throw new Error('Pairing not found');
    if (pairing.userBId !== ME && pairing.initiatedBy === ME) {
      throw new Error('Only the receiving user can respond');
    }
    pairing.status = accept ? 'accepted' : 'declined';
    pairing.respondedAt = now();
    await this.persist();
    this.pairingListeners.forEach((fn) => fn());
    if (accept) this.schedule(() => this.pushPartnerMessage(pairing, REPLIES[0]), 1500);
    return pairing;
  }

  async listChats() {
    await this.load();
    const rows = this.db.pairings.filter(
      (p) =>
        p.status === 'accepted' &&
        (p.userAId === ME || p.userBId === ME) &&
        !this.isBlocked(p.userAId === ME ? p.userBId : p.userAId),
    );
    const decorated = await Promise.all(rows.map((p) => this.decorate(p)));
    return decorated.sort((a, b) =>
      (b.lastMessage?.sentAt ?? b.pairing.createdAt).localeCompare(
        a.lastMessage?.sentAt ?? a.pairing.createdAt,
      ),
    );
  }

  async getPairing(pairingId: string) {
    await this.load();
    const pairing = this.db.pairings.find((p) => p.id === pairingId);
    if (!pairing) return null;
    return this.decorate(pairing);
  }

  async listMessages(pairingId: string) {
    await this.load();
    const pairing = this.db.pairings.find((p) => p.id === pairingId);
    // Enforces the same rule as the server: no thread exists before acceptance.
    if (!pairing || pairing.status !== 'accepted') return [];
    return this.db.messages.filter((m) => m.pairingId === pairingId);
  }

  async sendMessage(pairingId: string, body: string) {
    await this.load();
    const pairing = this.db.pairings.find((p) => p.id === pairingId);
    if (!pairing || pairing.status !== 'accepted') {
      throw new Error('This chat is not open');
    }
    const message: Message = {
      id: id(),
      pairingId,
      senderId: ME,
      body,
      sentAt: now(),
    };
    this.db.messages.push(message);
    await this.persist();
    this.emit(pairingId, message);
    const count = this.db.messages.filter(
      (m) => m.pairingId === pairingId && m.senderId !== ME,
    ).length;
    this.schedule(
      () => this.pushPartnerMessage(pairing, REPLIES[count % REPLIES.length]),
      1200 + Math.random() * 1800,
    );
    return message;
  }

  private async pushPartnerMessage(pairing: Pairing, body: string) {
    const message: Message = {
      id: id(),
      pairingId: pairing.id,
      senderId: this.partnerOf(pairing).id,
      body,
      sentAt: now(),
    };
    this.db.messages.push(message);
    await this.persist();
    this.emit(pairing.id, message);
    this.pairingListeners.forEach((fn) => fn());
  }

  private emit(pairingId: string, message: Message) {
    this.messageListeners.get(pairingId)?.forEach((fn) => fn(message));
  }

  async markRead(pairingId: string) {
    await this.load();
    this.db.readAt[pairingId] = now();
    await this.persist();
  }

  subscribeToMessages(pairingId: string, onMessage: (m: Message) => void) {
    const set = this.messageListeners.get(pairingId) ?? new Set();
    set.add(onMessage);
    this.messageListeners.set(pairingId, set);
    return () => set.delete(onMessage);
  }

  subscribeToPairings(onChange: () => void) {
    this.pairingListeners.add(onChange);
    return () => this.pairingListeners.delete(onChange);
  }

  async getRevealState(pairingId: string) {
    await this.load();
    return this.reveal(pairingId);
  }

  async requestReveal(pairingId: string) {
    await this.load();
    const state = this.reveal(pairingId);
    // Requesting counts as your own yes; it never speaks for the other side.
    const next: RevealState = {
      ...state,
      requestedBy: state.requestedBy ?? ME,
      acceptedBy: state.acceptedBy.includes(ME) ? state.acceptedBy : [...state.acceptedBy, ME],
    };
    next.revealed = next.acceptedBy.length >= 2;
    this.db.reveals[pairingId] = next;
    await this.persist();

    const pairing = this.db.pairings.find((p) => p.id === pairingId);
    if (pairing && !next.revealed) {
      // Seeded partners answer a reveal request on a delay, and not always yes.
      this.schedule(() => this.autoRespondReveal(pairingId), 5000 + Math.random() * 4000);
    }
    return next;
  }

  private async autoRespondReveal(pairingId: string) {
    const pairing = this.db.pairings.find((p) => p.id === pairingId);
    if (!pairing) return;
    const partnerId = this.partnerOf(pairing).id;
    const state = this.reveal(pairingId);
    if (state.revealed || state.acceptedBy.includes(partnerId)) return;
    if (Math.random() < 0.7) {
      const next: RevealState = {
        ...state,
        acceptedBy: [...state.acceptedBy, partnerId],
      };
      next.revealed = next.acceptedBy.length >= 2;
      this.db.reveals[pairingId] = next;
      await this.persist();
      this.pushPartnerMessage(pairing, next.revealed ? 'ok. deep breath 😅' : 'thinking about it');
    } else {
      this.pushPartnerMessage(pairing, 'not yet — let me warm up to it first');
    }
  }

  async respondToReveal(pairingId: string, accept: boolean) {
    await this.load();
    const state = this.reveal(pairingId);
    if (!accept) {
      // Declining clears the request entirely rather than leaving it hanging,
      // so neither person is nagged by a pending prompt they already answered.
      const cleared: RevealState = {
        pairingId,
        requestedBy: null,
        acceptedBy: [],
        revealed: false,
      };
      this.db.reveals[pairingId] = cleared;
      await this.persist();
      return cleared;
    }
    const next: RevealState = {
      ...state,
      acceptedBy: state.acceptedBy.includes(ME) ? state.acceptedBy : [...state.acceptedBy, ME],
    };
    next.revealed = next.acceptedBy.length >= 2;
    this.db.reveals[pairingId] = next;
    await this.persist();
    return next;
  }

  async blockUser(userId: string) {
    await this.load();
    this.db.blocks.push({ blockerId: ME, blockedId: userId });
    this.db.pairings.forEach((p) => {
      if (p.userAId === userId || p.userBId === userId) p.status = 'ended';
    });
    await this.persist();
    this.pairingListeners.forEach((fn) => fn());
  }

  async reportUser(input: {
    userId: string;
    pairingId?: string | null;
    reason: ReportReason;
    detail?: string;
  }) {
    await this.load();
    this.db.reports.push({
      id: id(),
      reporterId: ME,
      reportedUserId: input.userId,
      pairingId: input.pairingId ?? null,
      reason: input.reason,
      detail: input.detail,
      createdAt: now(),
    });
    await this.persist();
  }
}
