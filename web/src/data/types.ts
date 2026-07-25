import type { AvatarConfig } from '../domain/avatar';

export type Gender = 'male' | 'female';

/** Per-gender shared default name. Differentiation comes from the avatar, not the name. */
export const DEFAULT_NAMES: Record<Gender, string> = {
  male: 'Emmett',
  female: 'Caroline',
};

export type Profile = {
  id: string;
  country: string;
  gender: Gender;
  genderPreference: Gender;
  displayName: string;
  isCustomName: boolean;
  avatar: AvatarConfig;
  gpsOptIn: boolean;
  /** Present only once a reveal is mutually accepted; never sent to the client otherwise. */
  photoUrl?: string | null;
  /** Whether the user has uploaded a face photo at all — safe to expose pre-reveal. */
  hasPhoto: boolean;
  isOnline: boolean;
  createdAt: string;
};

export type PairingStatus = 'pending' | 'accepted' | 'declined' | 'ended';

export type Pairing = {
  id: string;
  userAId: string;
  userBId: string;
  initiatedBy: string;
  status: PairingStatus;
  createdAt: string;
  respondedAt?: string | null;
};

/** A pairing joined with the other participant, which is what every screen wants. */
export type PairingWithPartner = {
  pairing: Pairing;
  partner: Profile;
  lastMessage?: Message | null;
  unreadCount: number;
  reveal: RevealState;
};

export type Message = {
  id: string;
  pairingId: string;
  senderId: string;
  body: string;
  sentAt: string;
};

export type RevealState = {
  pairingId: string;
  requestedBy: string | null;
  /** Acceptance is tracked per participant so neither side can act for the other. */
  acceptedBy: string[];
  revealed: boolean;
};

export type ReportReason =
  | 'harassment'
  | 'sexual_content'
  | 'spam_or_scam'
  | 'underage'
  | 'impersonation'
  | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'sexual_content', label: 'Unwanted sexual content' },
  { value: 'spam_or_scam', label: 'Spam or a scam' },
  { value: 'underage', label: 'I think they are under 18' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'other', label: 'Something else' },
];

export type OnboardingInput = {
  country: string;
  gender: Gender;
  genderPreference: Gender;
  avatar: AvatarConfig;
  ageAttested: boolean;
};
