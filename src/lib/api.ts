import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type {
  AdminDashboardData,
  AppCatalogItem,
  PublicBootstrapData,
  SliderPhoto,
  SocialLinks,
} from '../types';
import { OperationType, auth, db, googleProvider, handleFirestoreError } from './firebase';

export const BRAND_ICON_URL = '/assets/gb-study-icon.png';
export const DEFAULT_HEADER_TITLE = '𝐆𝐁 𝐒𝐓𝐔𝐃𝐘';
export const COMMUNITY_TICKER_TEXT =
  'GB STUDY • NEW APPS AUR LATEST UPDATES KE LIYE TELEGRAM JOIN KARO';
export const ADMIN_OWNER_EMAIL = 'sarvottamyadav777@gmail.com';
export const CLOUDFLARE_ZIP_PATH = '/api/download/cloudflare-pages.zip';

const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  telegram: 'https://t.me/gbstudy',
  youtube: 'https://youtube.com/@gbstudy',
  whatsapp: 'https://wa.me/919999999999',
  instagram: 'https://instagram.com/gbstudy',
};

function makeDefaultBootstrap(): PublicBootstrapData {
  return {
    branding: {
      header_title: DEFAULT_HEADER_TITLE,
      updated_at: new Date().toISOString(),
    },
    apps: [],
    sliderPhotos: [],
    socialLinks: { ...DEFAULT_SOCIAL_LINKS },
  };
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

function clampString(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function clampNullableString(val: unknown, maxLen: number): string | null {
  const s = String(val ?? '').trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function parseOpenMode(val: unknown): 'auto' | 'frame' | 'direct' {
  return val === 'frame' || val === 'direct' ? val : 'auto';
}

let cachedBootstrap: PublicBootstrapData = makeDefaultBootstrap();
let hasLoadedOnce = false;
const liveListeners = new Set<(data: PublicBootstrapData) => void>();
let firestoreUnsubscribers: Array<() => void> = [];

function dedupeById<T extends { id: string; sort_order: number }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    seen.set(item.id, item);
  }
  return Array.from(seen.values()).sort((a, b) => a.sort_order - b.sort_order);
}

function emitSnapshotUpdate(): void {
  hasLoadedOnce = true;
  const snapshot: PublicBootstrapData = {
    branding: { ...cachedBootstrap.branding },
    apps: dedupeById(cachedBootstrap.apps),
    sliderPhotos: dedupeById(cachedBootstrap.sliderPhotos),
    socialLinks: { ...cachedBootstrap.socialLinks },
  };
  cachedBootstrap = snapshot;
  for (const cb of liveListeners) {
    cb(snapshot);
  }
}

function ensureRealtimeListeners(): void {
  if (firestoreUnsubscribers.length > 0) return;

  const appsQuery = query(collection(db, 'apps'), orderBy('sort_order', 'asc'));
  const unsubApps = onSnapshot(
    appsQuery,
    (snap) => {
      cachedBootstrap.apps = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          name: String(raw.name || ''),
          label: String(raw.label || ''),
          description: String(raw.description || ''),
          logo_url: raw.logo_url ? String(raw.logo_url) : null,
          app_url: raw.app_url ? String(raw.app_url) : null,
          app_url_2: raw.app_url_2 ? String(raw.app_url_2) : null,
          app_url_3: raw.app_url_3 ? String(raw.app_url_3) : null,
          app_url_4: raw.app_url_4 ? String(raw.app_url_4) : null,
          tone: String(raw.tone || 'app-card-amber'),
          sort_order: Number(raw.sort_order ?? 0),
          vip_text: String(raw.vip_text || 'VIP'),
          open_text: String(raw.open_text || 'OPEN THIS APP'),
          is_active: Boolean(raw.is_active),
          open_mode: parseOpenMode(raw.open_mode),
          created_at: toIsoString(raw.created_at),
        };
      });
      emitSnapshotUpdate();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'apps');
    }
  );

  const sliderQuery = query(collection(db, 'slider_photos'), orderBy('sort_order', 'asc'));
  const unsubSlider = onSnapshot(
    sliderQuery,
    (snap) => {
      cachedBootstrap.sliderPhotos = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          image_data: String(raw.image_data || ''),
          sort_order: Number(raw.sort_order ?? 0),
          created_at: toIsoString(raw.created_at),
        };
      });
      emitSnapshotUpdate();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'slider_photos');
    }
  );

  const unsubBranding = onSnapshot(
    doc(db, 'site_config', 'branding'),
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        cachedBootstrap.branding = {
          header_title: String(raw.header_title || DEFAULT_HEADER_TITLE),
          updated_at: toIsoString(raw.updated_at),
        };
      } else {
        cachedBootstrap.branding = {
          header_title: DEFAULT_HEADER_TITLE,
          updated_at: new Date().toISOString(),
        };
      }
      emitSnapshotUpdate();
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'site_config/branding');
    }
  );

  const unsubSocial = onSnapshot(
    doc(db, 'site_config', 'social_links'),
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        cachedBootstrap.socialLinks = {
          telegram: String(raw.telegram ?? ''),
          youtube: String(raw.youtube ?? ''),
          whatsapp: String(raw.whatsapp ?? ''),
          instagram: String(raw.instagram ?? ''),
        };
      } else {
        cachedBootstrap.socialLinks = { ...DEFAULT_SOCIAL_LINKS };
      }
      emitSnapshotUpdate();
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'site_config/social_links');
    }
  );

  firestoreUnsubscribers = [unsubApps, unsubSlider, unsubBranding, unsubSocial];
}

export function getCachedBootstrap(): PublicBootstrapData | null {
  return hasLoadedOnce ? cachedBootstrap : null;
}

export function invalidateBootstrapCache(): void {
  // Real-time onSnapshot keeps cache synchronized automatically
}

export function subscribeToBootstrap(onData: (data: PublicBootstrapData) => void): () => void {
  ensureRealtimeListeners();
  liveListeners.add(onData);
  if (hasLoadedOnce) {
    onData(cachedBootstrap);
  }
  return () => {
    liveListeners.delete(onData);
  };
}

export function subscribeToLiveUpdates(onUpdate: () => void): () => void {
  return subscribeToBootstrap(() => {
    onUpdate();
  });
}

export async function fetchPublicBootstrap(_force = false): Promise<PublicBootstrapData> {
  ensureRealtimeListeners();
  try {
    const [appsSnap, sliderSnap, brandingSnap, socialSnap] = await Promise.all([
      getDocs(query(collection(db, 'apps'), orderBy('sort_order', 'asc'))),
      getDocs(query(collection(db, 'slider_photos'), orderBy('sort_order', 'asc'))),
      getDoc(doc(db, 'site_config', 'branding')),
      getDoc(doc(db, 'site_config', 'social_links')),
    ]);

    const apps: AppCatalogItem[] = dedupeById(
      appsSnap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          name: String(raw.name || ''),
          label: String(raw.label || ''),
          description: String(raw.description || ''),
          logo_url: raw.logo_url ? String(raw.logo_url) : null,
          app_url: raw.app_url ? String(raw.app_url) : null,
          app_url_2: raw.app_url_2 ? String(raw.app_url_2) : null,
          app_url_3: raw.app_url_3 ? String(raw.app_url_3) : null,
          app_url_4: raw.app_url_4 ? String(raw.app_url_4) : null,
          tone: String(raw.tone || 'app-card-amber'),
          sort_order: Number(raw.sort_order ?? 0),
          vip_text: String(raw.vip_text || 'VIP'),
          open_text: String(raw.open_text || 'OPEN THIS APP'),
          is_active: Boolean(raw.is_active),
          open_mode: parseOpenMode(raw.open_mode),
          created_at: toIsoString(raw.created_at),
        };
      })
    );

    const sliderPhotos: SliderPhoto[] = dedupeById(
      sliderSnap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          image_data: String(raw.image_data || ''),
          sort_order: Number(raw.sort_order ?? 0),
          created_at: toIsoString(raw.created_at),
        };
      })
    );

    const branding = brandingSnap.exists()
      ? {
          header_title: String(brandingSnap.data().header_title || DEFAULT_HEADER_TITLE),
          updated_at: toIsoString(brandingSnap.data().updated_at),
        }
      : {
          header_title: DEFAULT_HEADER_TITLE,
          updated_at: new Date().toISOString(),
        };

    const socialLinks: SocialLinks = socialSnap.exists()
      ? {
          telegram: String(socialSnap.data().telegram ?? ''),
          youtube: String(socialSnap.data().youtube ?? ''),
          whatsapp: String(socialSnap.data().whatsapp ?? ''),
          instagram: String(socialSnap.data().instagram ?? ''),
        }
      : { ...DEFAULT_SOCIAL_LINKS };

    cachedBootstrap = { branding, apps, sliderPhotos, socialLinks };
    hasLoadedOnce = true;
    return cachedBootstrap;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'bootstrap');
  }
}

export async function fetchAppById(id: string): Promise<{ app: AppCatalogItem } | null> {
  try {
    const snap = await getDoc(doc(db, 'apps', id));
    if (!snap.exists()) return null;
    const raw = snap.data();
    return {
      app: {
        id: String(raw.id || snap.id),
        name: String(raw.name || ''),
        label: String(raw.label || ''),
        description: String(raw.description || ''),
        logo_url: raw.logo_url ? String(raw.logo_url) : null,
        app_url: raw.app_url ? String(raw.app_url) : null,
        app_url_2: raw.app_url_2 ? String(raw.app_url_2) : null,
        app_url_3: raw.app_url_3 ? String(raw.app_url_3) : null,
        app_url_4: raw.app_url_4 ? String(raw.app_url_4) : null,
        tone: String(raw.tone || 'app-card-amber'),
        sort_order: Number(raw.sort_order ?? 0),
        vip_text: String(raw.vip_text || 'VIP'),
        open_text: String(raw.open_text || 'OPEN THIS APP'),
        is_active: Boolean(raw.is_active),
        open_mode: parseOpenMode(raw.open_mode),
        created_at: toIsoString(raw.created_at),
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `apps/${id}`);
  }
}

export async function assignAppLinkSlot(appId: string): Promise<number> {
  const existing = cachedBootstrap.apps.find((a) => a.id === appId) ?? (await fetchAppById(appId))?.app;
  if (!existing) return 1;
  const slots: number[] = [];
  if (existing.app_url?.trim()) slots.push(1);
  if (existing.app_url_2?.trim()) slots.push(2);
  if (existing.app_url_3?.trim()) slots.push(3);
  if (existing.app_url_4?.trim()) slots.push(4);
  if (slots.length <= 1) return slots[0] ?? 1;
  return slots[Math.floor(Math.random() * slots.length)];
}

// ---------------- ADMIN AUTH & SHAREABLE ACCESS ----------------

export const CLOUDFLARE_PAGES_URL = 'https://gbstudyweb.pages.dev';
export const PUBLIC_SHARED_APP_URL =
  'https://ais-pre-yw2jgxarl3veptp3sdiyst-975930382400.asia-southeast1.run.app';

export interface AdminInviteItem {
  code: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminMemberItem {
  uid: string;
  email: string;
  invite_code: string;
  granted_at: string;
}

export class AdminAuthError extends Error {
  constructor(message = 'Admin authentication required.') {
    super(message);
    this.name = 'AdminAuthError';
  }
}

let verifiedAdminMember = false;

export function isCurrentUserOwner(): boolean {
  const u = auth.currentUser;
  return Boolean(
    u && u.email?.toLowerCase() === ADMIN_OWNER_EMAIL.toLowerCase() && u.emailVerified === true
  );
}

function isVerifiedAdminUser(): boolean {
  const u = auth.currentUser;
  if (!u || !u.emailVerified) return false;
  if (isCurrentUserOwner()) return true;
  return verifiedAdminMember;
}

async function checkOrRedeemAdminMembership(
  uid: string,
  email: string,
  inviteCode?: string | null
): Promise<boolean> {
  const memberRef = doc(db, 'admins', uid);
  const existing = await getDoc(memberRef).catch(() => null);
  if (existing && existing.exists()) {
    return true;
  }
  const cleanInvite = (inviteCode || '').trim();
  if (!cleanInvite || !/^[a-zA-Z0-9_\-]{8,128}$/.test(cleanInvite)) {
    return false;
  }
  try {
    await setDoc(memberRef, {
      uid,
      email,
      invite_code: cleanInvite,
      granted_at: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

export function getInviteCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const fromQuery = new URLSearchParams(window.location.search).get('invite')?.trim();
  if (fromQuery) {
    try {
      window.sessionStorage.setItem('gb_pending_invite', fromQuery);
    } catch {
      // ignore
    }
    return fromQuery;
  }
  try {
    return window.sessionStorage.getItem('gb_pending_invite');
  } catch {
    return null;
  }
}

function clearPendingInvite(): void {
  try {
    window.sessionStorage.removeItem('gb_pending_invite');
  } catch {
    // ignore
  }
}

export function subscribeToAdminAuth(
  callback: (state: {
    ready: boolean;
    authenticated: boolean;
    isOwner: boolean;
    email?: string;
    error?: string;
  }) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      verifiedAdminMember = false;
      callback({ ready: true, authenticated: false, isOwner: false });
      return;
    }
    if (!user.email || !user.emailVerified) {
      verifiedAdminMember = false;
      await signOut(auth).catch(() => undefined);
      callback({
        ready: true,
        authenticated: false,
        isOwner: false,
        error: 'Verified Google account zaroori hai.',
      });
      return;
    }
    if (user.email.toLowerCase() === ADMIN_OWNER_EMAIL.toLowerCase()) {
      verifiedAdminMember = true;
      callback({ ready: true, authenticated: true, isOwner: true, email: user.email });
      return;
    }
    const inviteCode = getInviteCodeFromUrl();
    const ok = await checkOrRedeemAdminMembership(user.uid, user.email, inviteCode);
    if (ok) {
      verifiedAdminMember = true;
      clearPendingInvite();
      callback({ ready: true, authenticated: true, isOwner: false, email: user.email });
      return;
    }
    verifiedAdminMember = false;
    await signOut(auth).catch(() => undefined);
    callback({
      ready: true,
      authenticated: false,
      isOwner: false,
      error:
        'Aapke paas valid Admin Invite Link nahi hai. Owner se naya shareable Admin Link maangein.',
    });
  });
}

export async function checkAdminSession(): Promise<{ authenticated: boolean; email?: string }> {
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u || !u.email || !u.emailVerified) return { authenticated: false };
  if (isCurrentUserOwner()) return { authenticated: true, email: u.email };
  const ok = await checkOrRedeemAdminMembership(u.uid, u.email, getInviteCodeFromUrl());
  verifiedAdminMember = ok;
  return ok ? { authenticated: true, email: u.email } : { authenticated: false };
}

export async function adminLoginWithGoogle(inviteCode?: string | null): Promise<void> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (!user.email || !user.emailVerified) {
      await signOut(auth).catch(() => undefined);
      throw new AdminAuthError('Verified Google account zaroori hai.');
    }
    if (user.email.toLowerCase() === ADMIN_OWNER_EMAIL.toLowerCase()) {
      verifiedAdminMember = true;
      return;
    }
    const code = inviteCode || getInviteCodeFromUrl();
    const ok = await checkOrRedeemAdminMembership(user.uid, user.email, code);
    if (!ok) {
      verifiedAdminMember = false;
      await signOut(auth).catch(() => undefined);
      throw new AdminAuthError(
        code
          ? 'Ye Admin Share Link invalid ya band kar diya gaya hai.'
          : 'Admin kholne ke liye Owner ke Shareable Admin Link (?invite=...) ka use karein.'
      );
    }
    verifiedAdminMember = true;
    clearPendingInvite();
  } catch (err) {
    if (err instanceof AdminAuthError) throw err;
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in popup band ho gaya. Dobara try karein.');
    }
    if (code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      throw new Error(
        `Domain "${currentHost}" Firebase Authorized Domains me add nahi hai. Firebase Console -> Authentication -> Settings -> Authorized domains me "${currentHost}" add karein.`
      );
    }
    throw new Error(err instanceof Error ? err.message : 'Google login fail ho gaya.');
  }
}

export async function adminLogout(): Promise<void> {
  verifiedAdminMember = false;
  await signOut(auth);
}

function assertAdmin(): void {
  if (!isVerifiedAdminUser()) {
    throw new AdminAuthError('Admin login zaroori hai.');
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

export async function fetchAdminAccessData(): Promise<{
  invites: AdminInviteItem[];
  members: AdminMemberItem[];
}> {
  if (!isCurrentUserOwner()) {
    return { invites: [], members: [] };
  }
  try {
    const [invSnap, memSnap] = await Promise.all([
      getDocs(query(collection(db, 'admin_invites'), orderBy('created_at', 'desc'))),
      getDocs(query(collection(db, 'admins'), orderBy('granted_at', 'desc'))),
    ]);
    return {
      invites: invSnap.docs.map((d) => ({
        code: String(d.data().code || d.id),
        label: String(d.data().label || ''),
        is_active: Boolean(d.data().is_active),
        created_at: toIsoString(d.data().created_at),
      })),
      members: memSnap.docs.map((d) => ({
        uid: String(d.data().uid || d.id),
        email: String(d.data().email || ''),
        invite_code: String(d.data().invite_code || ''),
        granted_at: toIsoString(d.data().granted_at),
      })),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin_invites');
  }
}

export async function createAdminInvite(label = 'Shared Admin Link'): Promise<AdminInviteItem> {
  if (!isCurrentUserOwner()) {
    throw new AdminAuthError('Sirf Owner hi naya Admin Invite Link bana sakta hai.');
  }
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const cleanLabel = clampString(label || 'Shared Admin Link', 80);
  try {
    await setDoc(doc(db, 'admin_invites', code), {
      code,
      label: cleanLabel,
      is_active: true,
      created_at: serverTimestamp(),
    });
    return {
      code,
      label: cleanLabel,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admin_invites/${code}`);
  }
}

export async function toggleAdminInvite(code: string, isActive: boolean): Promise<void> {
  if (!isCurrentUserOwner()) throw new AdminAuthError('Owner permission required.');
  try {
    await updateDoc(doc(db, 'admin_invites', code), { is_active: isActive });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `admin_invites/${code}`);
  }
}

export async function deleteAdminInvite(code: string): Promise<void> {
  if (!isCurrentUserOwner()) throw new AdminAuthError('Owner permission required.');
  try {
    await deleteDoc(doc(db, 'admin_invites', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admin_invites/${code}`);
  }
}

export async function removeAdminMember(uid: string): Promise<void> {
  if (!isCurrentUserOwner()) throw new AdminAuthError('Owner permission required.');
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
  }
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  assertAdmin();
  const data = await fetchPublicBootstrap(true);
  return {
    apps: data.apps,
    linkCounters: {},
    branding: data.branding,
    sliderPhotos: data.sliderPhotos,
    socialLinks: data.socialLinks,
  };
}

export async function adminSaveApp(
  id: string | null,
  payload: Partial<AppCatalogItem>
): Promise<{ app: AppCatalogItem }> {
  assertAdmin();
  const name = clampString(payload.name, 120);
  if (!name) {
    throw new Error('App name is required.');
  }

  const label = clampString(payload.label, 80);
  const description = clampString(payload.description, 500);
  const logoUrl = clampNullableString(payload.logo_url, 300000);
  const appUrl = clampNullableString(payload.app_url, 1000);
  const appUrl2 = clampNullableString(payload.app_url_2, 1000);
  const appUrl3 = clampNullableString(payload.app_url_3, 1000);
  const appUrl4 = clampNullableString(payload.app_url_4, 1000);
  const isActive = Boolean(payload.is_active);
  const openMode = parseOpenMode(payload.open_mode);

  if (id) {
    const path = `apps/${id}`;
    try {
      await updateDoc(doc(db, 'apps', id), {
        name,
        label,
        description,
        logo_url: logoUrl,
        app_url: appUrl,
        app_url_2: appUrl2,
        app_url_3: appUrl3,
        app_url_4: appUrl4,
        is_active: isActive,
        open_mode: openMode,
      });
      const updated = (await fetchAppById(id))?.app ?? {
        id,
        name,
        label,
        description,
        logo_url: logoUrl,
        app_url: appUrl,
        app_url_2: appUrl2,
        app_url_3: appUrl3,
        app_url_4: appUrl4,
        tone: 'app-card-amber',
        sort_order: 1,
        vip_text: 'VIP',
        open_text: 'OPEN THIS APP',
        is_active: isActive,
        open_mode: openMode,
        created_at: new Date().toISOString(),
      };
      return { app: updated };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  const newId = generateId();
  const maxSort = cachedBootstrap.apps.reduce((acc, item) => Math.max(acc, item.sort_order), 0);
  const sortOrder = maxSort + 1;
  const path = `apps/${newId}`;
  try {
    await setDoc(doc(db, 'apps', newId), {
      id: newId,
      name,
      label,
      description,
      logo_url: logoUrl,
      app_url: appUrl,
      app_url_2: appUrl2,
      app_url_3: appUrl3,
      app_url_4: appUrl4,
      tone: 'app-card-amber',
      sort_order: sortOrder,
      vip_text: 'VIP',
      open_text: 'OPEN THIS APP',
      is_active: isActive,
      open_mode: openMode,
      created_at: serverTimestamp(),
    });
    const created: AppCatalogItem = {
      id: newId,
      name,
      label,
      description,
      logo_url: logoUrl,
      app_url: appUrl,
      app_url_2: appUrl2,
      app_url_3: appUrl3,
      app_url_4: appUrl4,
      tone: 'app-card-amber',
      sort_order: sortOrder,
      vip_text: 'VIP',
      open_text: 'OPEN THIS APP',
      is_active: isActive,
      open_mode: openMode,
      created_at: new Date().toISOString(),
    };
    return { app: created };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminDeleteApp(id: string): Promise<void> {
  assertAdmin();
  const path = `apps/${id}`;
  try {
    await deleteDoc(doc(db, 'apps', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function adminSaveBranding(headerTitle: string): Promise<void> {
  assertAdmin();
  const clean = clampString(headerTitle, 120) || DEFAULT_HEADER_TITLE;
  const path = 'site_config/branding';
  try {
    await setDoc(doc(db, 'site_config', 'branding'), {
      header_title: clean,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminAddSliderPhotos(images: string[]): Promise<{ sliderPhotos: SliderPhoto[] }> {
  assertAdmin();
  const valid = images.map((img) => clampString(img, 700000)).filter(Boolean);
  if (!valid.length) {
    return { sliderPhotos: cachedBootstrap.sliderPhotos };
  }
  let maxOrder = cachedBootstrap.sliderPhotos.reduce((acc, s) => Math.max(acc, s.sort_order), 0);
  try {
    const batch = writeBatch(db);
    for (const img of valid) {
      maxOrder += 1;
      const slideId = generateId();
      batch.set(doc(db, 'slider_photos', slideId), {
        id: slideId,
        image_data: img,
        sort_order: maxOrder,
        created_at: serverTimestamp(),
      });
    }
    await batch.commit();
    const updated = await fetchPublicBootstrap(true);
    return { sliderPhotos: updated.sliderPhotos };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'slider_photos');
  }
}

export async function adminReplaceSliderPhoto(
  id: string,
  imageData: string
): Promise<{ sliderPhotos: SliderPhoto[] }> {
  assertAdmin();
  const clean = clampString(imageData, 700000);
  if (!clean) throw new Error('Invalid image.');
  const path = `slider_photos/${id}`;
  try {
    await updateDoc(doc(db, 'slider_photos', id), {
      image_data: clean,
    });
    const updated = await fetchPublicBootstrap(true);
    return { sliderPhotos: updated.sliderPhotos };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminReorderSliderPhotos(
  idA: string,
  idB: string
): Promise<{ sliderPhotos: SliderPhoto[] }> {
  assertAdmin();
  const slideA = cachedBootstrap.sliderPhotos.find((s) => s.id === idA);
  const slideB = cachedBootstrap.sliderPhotos.find((s) => s.id === idB);
  if (!slideA || !slideB) {
    return { sliderPhotos: cachedBootstrap.sliderPhotos };
  }
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'slider_photos', slideA.id), { sort_order: slideB.sort_order });
    batch.update(doc(db, 'slider_photos', slideB.id), { sort_order: slideA.sort_order });
    await batch.commit();
    const updated = await fetchPublicBootstrap(true);
    return { sliderPhotos: updated.sliderPhotos };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'slider_photos');
  }
}

export async function adminDeleteSliderPhoto(id: string): Promise<{ sliderPhotos: SliderPhoto[] }> {
  assertAdmin();
  const path = `slider_photos/${id}`;
  try {
    await deleteDoc(doc(db, 'slider_photos', id));
    const updated = await fetchPublicBootstrap(true);
    return { sliderPhotos: updated.sliderPhotos };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function adminSaveSocialLinks(links: SocialLinks): Promise<void> {
  assertAdmin();
  const path = 'site_config/social_links';
  try {
    await setDoc(doc(db, 'site_config', 'social_links'), {
      telegram: clampString(links.telegram, 500),
      youtube: clampString(links.youtube, 500),
      whatsapp: clampString(links.whatsapp, 500),
      instagram: clampString(links.instagram, 500),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function downloadCloudflarePagesZip(): Promise<void> {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const url =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.run.app')
      ? CLOUDFLARE_ZIP_PATH
      : `https://ais-dev-yw2jgxarl3veptp3sdiyst-975930382400.asia-southeast1.run.app${CLOUDFLARE_ZIP_PATH}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('ZIP download failed. Live Dev URL se download karein.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = 'gb-study-cloudflare-pages.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}
