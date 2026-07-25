import type { AvatarConfig } from '../domain/avatar';
import type {
  Message,
  OnboardingInput,
  Pairing,
  PairingWithPartner,
  Profile,
  ReportReason,
  RevealState,
} from './types';

/**
 * Everything the UI is allowed to know about storage. Two implementations exist:
 * an in-memory mock (src/data/mock) that lets the whole app run with no backend,
 * and a Supabase-backed one (src/data/supabase) for real users. Screens import
 * neither directly — they go through useRepository() in ./RepositoryProvider.
 */
export interface Repository {
  /** Anonymous sign-in. Konji has no email/password step; identity is the avatar. */
  getCurrentUserId(): Promise<string | null>;
  signIn(): Promise<string>;
  signOut(): Promise<void>;

  getProfile(userId: string): Promise<Profile | null>;
  completeOnboarding(input: OnboardingInput): Promise<Profile>;
  updateAvatar(avatar: AvatarConfig): Promise<Profile>;
  setGpsOptIn(optIn: boolean): Promise<Profile>;
  setDisplayName(name: string): Promise<Profile>;
  /** Stores a face photo privately. It is only ever served after a mutual reveal. */
  setPhoto(localUri: string): Promise<Profile>;

  /**
   * The lucky draw: one random candidate matching gender preference, excluding
   * self, blocked users in either direction, and anyone already paired.
   * Resolves to null when the pool is genuinely empty.
   */
  drawCandidate(): Promise<Profile | null>;
  /** "Smash" — creates a pending pairing the other side must accept. */
  sendPairingRequest(candidateId: string): Promise<Pairing>;
  /** "Pass" — recorded so the same candidate is not redrawn immediately. */
  passCandidate(candidateId: string): Promise<void>;

  listIncomingRequests(): Promise<PairingWithPartner[]>;
  listOutgoingRequests(): Promise<PairingWithPartner[]>;
  respondToRequest(pairingId: string, accept: boolean): Promise<Pairing>;

  listChats(): Promise<PairingWithPartner[]>;
  getPairing(pairingId: string): Promise<PairingWithPartner | null>;

  listMessages(pairingId: string): Promise<Message[]>;
  sendMessage(pairingId: string, body: string): Promise<Message>;
  markRead(pairingId: string): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribeToMessages(pairingId: string, onMessage: (m: Message) => void): () => void;
  /** Fires when pairings change (new request, accepted, declined). */
  subscribeToPairings(onChange: () => void): () => void;

  getRevealState(pairingId: string): Promise<RevealState>;
  requestReveal(pairingId: string): Promise<RevealState>;
  respondToReveal(pairingId: string, accept: boolean): Promise<RevealState>;

  blockUser(userId: string): Promise<void>;
  reportUser(input: {
    userId: string;
    pairingId?: string | null;
    reason: ReportReason;
    detail?: string;
  }): Promise<void>;
}
