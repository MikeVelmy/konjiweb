import type { SupabaseClient } from '@supabase/supabase-js';

import { defaultAvatar, type AvatarConfig } from '../../domain/avatar';
import type { Repository } from '../repository';
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
import { getSupabase } from './client';

const FACE_BUCKET = 'faces';

type ProfileRow = {
  id: string;
  country: string;
  gender: Gender;
  gender_preference: Gender;
  display_name: string;
  is_custom_name: boolean;
  avatar: AvatarConfig;
  gps_opt_in: boolean;
  has_photo: boolean;
  last_seen_at: string;
  created_at: string;
};

type PairingRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: Pairing['status'];
  created_at: string;
  responded_at: string | null;
};

type MessageRow = {
  id: string;
  pairing_id: string;
  sender_id: string;
  body: string;
  sent_at: string;
};

type RevealRow = {
  pairing_id: string;
  requested_by: string;
  user_a_accepted: boolean;
  user_b_accepted: boolean;
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    country: row.country,
    gender: row.gender,
    genderPreference: row.gender_preference,
    displayName: row.display_name,
    isCustomName: row.is_custom_name,
    avatar: { ...defaultAvatar, ...row.avatar },
    gpsOptIn: row.gps_opt_in,
    hasPhoto: row.has_photo,
    photoUrl: null,
    isOnline: Date.now() - new Date(row.last_seen_at).getTime() < ONLINE_WINDOW_MS,
    createdAt: row.created_at,
  };
}

function toPairing(row: PairingRow): Pairing {
  return {
    id: row.id,
    userAId: row.user_a,
    userBId: row.user_b,
    // user_a is always the initiator by schema convention.
    initiatedBy: row.user_a,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    pairingId: row.pairing_id,
    senderId: row.sender_id,
    body: row.body,
    sentAt: row.sent_at,
  };
}

/**
 * Narrows a Supabase response to its row, throwing on error. Returns `unknown`
 * because this client is not generated from the database schema — each caller
 * asserts the row type it expects, using the `*Row` types above.
 */
function unwrap(res: { data: unknown; error: { message: string } | null }): unknown {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null || res.data === undefined) throw new Error('No data returned');
  return res.data;
}

export class SupabaseRepository implements Repository {
  private client: SupabaseClient;
  private userId: string | null = null;

  constructor(client: SupabaseClient = getSupabase()) {
    this.client = client;
  }

  private async requireUserId(): Promise<string> {
    if (this.userId) return this.userId;
    const { data } = await this.client.auth.getSession();
    if (!data.session) throw new Error('Not signed in');
    this.userId = data.session.user.id;
    return this.userId;
  }

  async getCurrentUserId() {
    const { data } = await this.client.auth.getSession();
    this.userId = data.session?.user.id ?? null;
    if (!this.userId) return null;
    // A session alone is not an account here — onboarding must have completed.
    const { data: profile } = await this.client
      .from('profiles')
      .select('id')
      .eq('id', this.userId)
      .maybeSingle();
    return profile ? this.userId : null;
  }

  async signIn() {
    const { data } = await this.client.auth.getSession();
    if (data.session) {
      this.userId = data.session.user.id;
      return this.userId;
    }
    const res = await this.client.auth.signInAnonymously();
    if (res.error) throw new Error(res.error.message);
    this.userId = res.data.user!.id;
    return this.userId;
  }

  async signOut() {
    await this.client.auth.signOut();
    this.userId = null;
  }

  async getProfile(userId: string) {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const profile = toProfile(data as ProfileRow);
    profile.photoUrl = await this.signedPhotoUrl(userId);
    return profile;
  }

  /**
   * Asks storage for a signed URL. This is the client-side half of the reveal
   * rule — it returns null whenever RLS says this user may not see that face,
   * which is exactly the pre-reveal case. The UI never decides this itself.
   */
  private async signedPhotoUrl(userId: string): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from(FACE_BUCKET)
      .createSignedUrl(`${userId}/face.jpg`, 60 * 10);
    if (error || !data) return null;
    return data.signedUrl;
  }

  async completeOnboarding(input: OnboardingInput) {
    if (!input.ageAttested) throw new Error('Age attestation is required');
    const userId = await this.signIn();
    const row = unwrap(
      await this.client
        .from('profiles')
        .insert({
          id: userId,
          country: input.country,
          gender: input.gender,
          gender_preference: input.genderPreference,
          display_name: DEFAULT_NAMES[input.gender],
          is_custom_name: false,
          avatar: input.avatar,
          age_attested_at: new Date().toISOString(),
        })
        .select()
        .single(),
    );
    return toProfile(row as ProfileRow);
  }

  private async patchProfile(patch: Record<string, unknown>) {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client.from('profiles').update(patch).eq('id', userId).select().single(),
    );
    return toProfile(row as ProfileRow);
  }

  updateAvatar(avatar: AvatarConfig) {
    return this.patchProfile({ avatar });
  }

  setGpsOptIn(optIn: boolean) {
    return this.patchProfile({ gps_opt_in: optIn });
  }

  setDisplayName(name: string) {
    return this.patchProfile({ display_name: name, is_custom_name: true });
  }

  /**
   * `localUri` is an object URL from a file input on web. Fetching it yields the
   * selected file's bytes, which is the same shape the native build uploads.
   */
  async setPhoto(localUri: string) {
    const userId = await this.requireUserId();
    const response = await fetch(localUri);
    const blob = await response.arrayBuffer();
    const path = `${userId}/face.jpg`;
    const { error } = await this.client.storage
      .from(FACE_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    await this.client
      .from('profile_photos')
      .upsert({ user_id: userId, storage_path: path, updated_at: new Date().toISOString() });
    return this.patchProfile({ has_photo: true });
  }

  async drawCandidate() {
    const { data, error } = await this.client.rpc('draw_candidate');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as {
      id: string;
      display_name: string;
      is_custom_name: boolean;
      avatar: AvatarConfig;
      gender: Gender;
      country: string;
      has_photo: boolean;
      is_online: boolean;
    }[];
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      country: row.country,
      gender: row.gender,
      // The draw does not disclose a candidate's own preference; it is already
      // accounted for server-side and is not the caller's business.
      genderPreference: row.gender === 'male' ? 'female' : 'male',
      displayName: row.display_name,
      isCustomName: row.is_custom_name,
      avatar: { ...defaultAvatar, ...row.avatar },
      gpsOptIn: false,
      hasPhoto: row.has_photo,
      photoUrl: null,
      isOnline: row.is_online,
      createdAt: new Date().toISOString(),
    } satisfies Profile;
  }

  async sendPairingRequest(candidateId: string) {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('pairings')
        .insert({ user_a: userId, user_b: candidateId, status: 'pending' })
        .select()
        .single(),
    );
    return toPairing(row as PairingRow);
  }

  async passCandidate(candidateId: string) {
    const userId = await this.requireUserId();
    await this.client
      .from('passes')
      .upsert(
        { user_id: userId, candidate_id: candidateId, created_at: new Date().toISOString() },
        { onConflict: 'user_id,candidate_id' },
      );
  }

  /** Joins pairings to their partner profile, last message, and reveal state. */
  private async decorate(rows: PairingRow[]): Promise<PairingWithPartner[]> {
    if (rows.length === 0) return [];
    const userId = await this.requireUserId();
    const partnerIds = rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a));
    const pairingIds = rows.map((r) => r.id);

    const [profilesRes, messagesRes, revealsRes, receiptsRes] = await Promise.all([
      this.client.from('profiles').select('*').in('id', partnerIds),
      this.client
        .from('messages')
        .select('*')
        .in('pairing_id', pairingIds)
        .order('sent_at', { ascending: true }),
      this.client.from('reveal_requests').select('*').in('pairing_id', pairingIds),
      this.client.from('read_receipts').select('*').eq('user_id', userId).in('pairing_id', pairingIds),
    ]);

    const profiles = new Map(
      ((profilesRes.data ?? []) as ProfileRow[]).map((p) => [p.id, toProfile(p)]),
    );
    const messages = (messagesRes.data ?? []) as MessageRow[];
    const reveals = new Map(
      ((revealsRes.data ?? []) as RevealRow[]).map((r) => [r.pairing_id, r]),
    );
    const receipts = new Map(
      ((receiptsRes.data ?? []) as { pairing_id: string; read_at: string }[]).map((r) => [
        r.pairing_id,
        r.read_at,
      ]),
    );

    return Promise.all(
      rows.map(async (row) => {
        const partnerId = row.user_a === userId ? row.user_b : row.user_a;
        const partner = profiles.get(partnerId);
        const threadMessages = messages.filter((m) => m.pairing_id === row.id);
        const revealRow = reveals.get(row.id) ?? null;
        const revealed = !!revealRow?.user_a_accepted && !!revealRow?.user_b_accepted;
        const readAt = receipts.get(row.id);

        const resolvedPartner: Profile = partner ?? {
          id: partnerId,
          country: '',
          gender: 'female',
          genderPreference: 'male',
          displayName: '…',
          isCustomName: false,
          avatar: defaultAvatar,
          gpsOptIn: false,
          hasPhoto: false,
          photoUrl: null,
          isOnline: false,
          createdAt: row.created_at,
        };

        if (revealed) {
          resolvedPartner.photoUrl = await this.signedPhotoUrl(partnerId);
        }

        const acceptedBy: string[] = [];
        if (revealRow?.user_a_accepted) acceptedBy.push(row.user_a);
        if (revealRow?.user_b_accepted) acceptedBy.push(row.user_b);

        return {
          pairing: toPairing(row),
          partner: resolvedPartner,
          lastMessage: threadMessages.length
            ? toMessage(threadMessages[threadMessages.length - 1])
            : null,
          unreadCount: threadMessages.filter(
            (m) => m.sender_id !== userId && (!readAt || m.sent_at > readAt),
          ).length,
          reveal: {
            pairingId: row.id,
            requestedBy: revealRow?.requested_by ?? null,
            acceptedBy,
            revealed,
          },
        } satisfies PairingWithPartner;
      }),
    );
  }

  async listIncomingRequests() {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('pairings')
      .select('*')
      .eq('user_b', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return this.decorate((data ?? []) as PairingRow[]);
  }

  async listOutgoingRequests() {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('pairings')
      .select('*')
      .eq('user_a', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return this.decorate((data ?? []) as PairingRow[]);
  }

  async respondToRequest(pairingId: string, accept: boolean) {
    const row = unwrap(
      await this.client
        .from('pairings')
        .update({
          status: accept ? 'accepted' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', pairingId)
        .select()
        .single(),
    );
    return toPairing(row as PairingRow);
  }

  async listChats() {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('pairings')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return this.decorate((data ?? []) as PairingRow[]);
  }

  async getPairing(pairingId: string) {
    const { data, error } = await this.client
      .from('pairings')
      .select('*')
      .eq('id', pairingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const [decorated] = await this.decorate([data as PairingRow]);
    return decorated ?? null;
  }

  async listMessages(pairingId: string) {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('pairing_id', pairingId)
      .order('sent_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as MessageRow[]).map(toMessage);
  }

  async sendMessage(pairingId: string, body: string) {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('messages')
        .insert({ pairing_id: pairingId, sender_id: userId, body })
        .select()
        .single(),
    );
    return toMessage(row as MessageRow);
  }

  async markRead(pairingId: string) {
    const userId = await this.requireUserId();
    await this.client
      .from('read_receipts')
      .upsert(
        { pairing_id: pairingId, user_id: userId, read_at: new Date().toISOString() },
        { onConflict: 'pairing_id,user_id' },
      );
  }

  subscribeToMessages(pairingId: string, onMessage: (m: Message) => void) {
    const channel = this.client
      .channel(`messages:${pairingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pairing_id=eq.${pairingId}`,
        },
        (payload) => onMessage(toMessage(payload.new as MessageRow)),
      )
      .subscribe();
    return () => {
      this.client.removeChannel(channel);
    };
  }

  subscribeToPairings(onChange: () => void) {
    const channel = this.client
      .channel('pairings:self')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairings' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reveal_requests' }, onChange)
      .subscribe();
    return () => {
      this.client.removeChannel(channel);
    };
  }

  async getRevealState(pairingId: string) {
    const { data: pairing } = await this.client
      .from('pairings')
      .select('user_a,user_b')
      .eq('id', pairingId)
      .maybeSingle();
    const { data } = await this.client
      .from('reveal_requests')
      .select('*')
      .eq('pairing_id', pairingId)
      .maybeSingle();
    const row = (data ?? null) as RevealRow | null;
    const acceptedBy: string[] = [];
    if (row && pairing) {
      if (row.user_a_accepted) acceptedBy.push((pairing as PairingRow).user_a);
      if (row.user_b_accepted) acceptedBy.push((pairing as PairingRow).user_b);
    }
    return {
      pairingId,
      requestedBy: row?.requested_by ?? null,
      acceptedBy,
      revealed: !!row?.user_a_accepted && !!row?.user_b_accepted,
    } satisfies RevealState;
  }

  /** Requesting is the same server call as accepting — it records your yes only. */
  requestReveal(pairingId: string) {
    return this.respondToReveal(pairingId, true);
  }

  async respondToReveal(pairingId: string, accept: boolean) {
    const { error } = await this.client.rpc('respond_to_reveal', {
      target_pairing: pairingId,
      accept,
    });
    if (error) throw new Error(error.message);
    return this.getRevealState(pairingId);
  }

  async blockUser(userId: string) {
    const { error } = await this.client.rpc('block_user', { target: userId });
    if (error) throw new Error(error.message);
  }

  async reportUser(input: {
    userId: string;
    pairingId?: string | null;
    reason: ReportReason;
    detail?: string;
  }) {
    const reporterId = await this.requireUserId();
    const { error } = await this.client.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: input.userId,
      pairing_id: input.pairingId ?? null,
      reason: input.reason,
      detail: input.detail ?? null,
    });
    if (error) throw new Error(error.message);
  }
}
