import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  Link2,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  ADMIN_OWNER_EMAIL,
  AdminAuthError,
  type AdminInviteItem,
  type AdminMemberItem,
  CLOUDFLARE_PAGES_URL,
  DEFAULT_HEADER_TITLE,
  PUBLIC_SHARED_APP_URL,
  adminAddSliderPhotos,
  adminDeleteApp,
  adminDeleteSliderPhoto,
  adminLoginWithGoogle,
  adminLogout,
  adminReorderSliderPhotos,
  adminReplaceSliderPhoto,
  adminSaveApp,
  adminSaveBranding,
  adminSaveSocialLinks,
  createAdminInvite,
  deleteAdminInvite,
  downloadCloudflarePagesZip,
  fetchAdminAccessData,
  fetchAdminDashboard,
  getInviteCodeFromUrl,
  isCurrentUserOwner,
  removeAdminMember,
  subscribeToAdminAuth,
  subscribeToBootstrap,
  toggleAdminInvite,
} from '../lib/api';
import { Link } from '../lib/router';
import type { AppCatalogItem, SliderPhoto, SocialLinks } from '../types';

interface AppFormState {
  name: string;
  logo_url: string;
  app_url: string;
  app_url_2: string;
  app_url_3: string;
  app_url_4: string;
  is_active: boolean;
  open_mode: 'auto' | 'frame' | 'direct';
}

const EMPTY_APP_FORM: AppFormState = {
  name: '',
  logo_url: '',
  app_url: '',
  app_url_2: '',
  app_url_3: '',
  app_url_4: '',
  is_active: true,
  open_mode: 'auto',
};

const SOCIAL_FIELDS: Array<{ key: keyof SocialLinks; label: string; placeholder: string }> = [
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/yourname' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourname' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/919999999999' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourname' },
];

function StatusSwitch({
  checked,
  onCheckedChange,
  ariaLabel,
  className = '',
}: {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-state={checked ? 'checked' : 'unchecked'}
      onClick={() => onCheckedChange(!checked)}
      className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input ${className}`}
    >
      <span
        data-state={checked ? 'checked' : 'unchecked'}
        className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      />
    </button>
  );
}

function resizeImageToDataUrl(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function resizeImageToJpeg(file: File): Promise<string> {
  return resizeImageToDataUrl(file, 1000, 0.72);
}

function resizeLogoToDataUrl(file: File): Promise<string> {
  return resizeImageToDataUrl(file, 256, 0.85);
}

function SliderPhotosEditor({
  initialPhotos,
  onSync,
  onAuthError,
}: {
  initialPhotos: SliderPhoto[];
  onSync: (photos: SliderPhoto[]) => void;
  onAuthError: () => void;
}) {
  const [photos, setPhotos] = useState<SliderPhoto[]>(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const targetSlideIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const encoded = await Promise.all(files.map(resizeImageToJpeg));
      const res = await adminAddSliderPhotos(encoded);
      setPhotos(res.sliderPhotos);
      onSync(res.sliderPhotos);
      setOk('Photo upload ho gaya.');
    } catch (error) {
      if (error instanceof AdminAuthError) {
        onAuthError();
        return;
      }
      setErr(error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const slideId = targetSlideIdRef.current;
    if (!file || !slideId) return;
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const encoded = await resizeImageToJpeg(file);
      const res = await adminReplaceSliderPhoto(slideId, encoded);
      setPhotos(res.sliderPhotos);
      onSync(res.sliderPhotos);
      setOk('Photo badal diya.');
    } catch (error) {
      if (error instanceof AdminAuthError) {
        onAuthError();
        return;
      }
      setErr(error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ye photo delete karein?')) return;
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const res = await adminDeleteSliderPhoto(id);
      setPhotos(res.sliderPhotos);
      onSync(res.sliderPhotos);
      setOk('Photo delete ho gaya.');
    } catch (error) {
      if (error instanceof AdminAuthError) {
        onAuthError();
        return;
      }
      setErr(error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (idx: number, delta: -1 | 1) => {
    const target = photos[idx + delta];
    const current = photos[idx];
    if (!target || !current) return;
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const res = await adminReorderSliderPhotos(current.id, target.id);
      setPhotos(res.sliderPhotos);
      onSync(res.sliderPhotos);
      setOk('Order update ho gaya.');
    } catch (error) {
      if (error instanceof AdminAuthError) {
        onAuthError();
        return;
      }
      setErr(error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-editor">
      <div className="admin-section-heading">
        <div>
          <span className="section-kicker">HOME SLIDER</span>
          <h2>Slide photos</h2>
          <p className="admin-section-note">
            Home page ke slider me yahi photos dikhenge. Best size: 1200×600 (2:1).
          </p>
        </div>
      </div>

      <div className="admin-form admin-card-form">
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleUpload}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleReplace}
        />

        {photos.length === 0 && <p className="admin-section-note">Abhi koi photo nahi hai.</p>}

        <div className="slider-admin-grid">
          {photos.map((slide, idx) => (
            <div key={slide.id} className="slider-admin-item">
              <img src={slide.image_data} alt={`Slide ${idx + 1}`} />
              <div className="slider-admin-actions">
                <button
                  type="button"
                  disabled={busy || idx === 0}
                  onClick={() => void handleMove(idx, -1)}
                  aria-label="Upar"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/75 hover:bg-white/10 disabled:opacity-35"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  disabled={busy || idx === photos.length - 1}
                  onClick={() => void handleMove(idx, 1)}
                  aria-label="Neeche"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/75 hover:bg-white/10 disabled:opacity-35"
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    targetSlideIdRef.current = slide.id;
                    replaceInputRef.current?.click();
                  }}
                  aria-label="Edit"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/75 hover:bg-white/10 disabled:opacity-35"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDelete(slide.id)}
                  aria-label="Delete"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-red-400 disabled:opacity-35"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {err && <p className="form-error">{err}</p>}
        {ok && <p className="form-success">{ok}</p>}

        <div className="admin-form-actions admin-card-form-actions">
          <button
            type="button"
            className="app-open-btn"
            disabled={busy}
            onClick={() => uploadInputRef.current?.click()}
          >
            {busy ? (
              'Please wait...'
            ) : (
              <>
                <ImagePlus size={15} /> Upload photo
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

export function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Auth state
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const pendingInvite = getInviteCodeFromUrl();

  // Dashboard data
  const [apps, setApps] = useState<AppCatalogItem[]>([]);
  const [linkCounters, setLinkCounters] = useState<Record<string, [number, number, number, number]>>(
    {}
  );
  const [sliderPhotos, setSliderPhotos] = useState<SliderPhoto[]>([]);

  // Shareable Admin access state (owner only)
  const [invites, setInvites] = useState<AdminInviteItem[]>([]);
  const [members, setMembers] = useState<AdminMemberItem[]>([]);
  const [inviteLabel, setInviteLabel] = useState('Team Admin Link');
  const [shareBaseUrl, setShareBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.includes('ais-dev')) {
        return window.location.origin;
      }
    }
    return CLOUDFLARE_PAGES_URL;
  });
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // App editor form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [appForm, setAppForm] = useState<AppFormState>(EMPTY_APP_FORM);
  const [appSaving, setAppSaving] = useState(false);
  const [appSuccess, setAppSuccess] = useState('');
  const [appError, setAppError] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Header branding form
  const [headerTitle, setHeaderTitle] = useState('');
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState('');
  const [brandingError, setBrandingError] = useState('');

  // Social links form
  const [socialForm, setSocialForm] = useState<SocialLinks>({
    telegram: '',
    youtube: '',
    whatsapp: '',
    instagram: '',
  });
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialSuccess, setSocialSuccess] = useState('');
  const [socialError, setSocialError] = useState('');

  const loadDashboard = useCallback(async () => {
    const data = await fetchAdminDashboard();
    setApps(data.apps);
    setLinkCounters(data.linkCounters);
    setSliderPhotos(data.sliderPhotos);
    setHeaderTitle(data.branding.header_title || DEFAULT_HEADER_TITLE);
    setSocialForm(data.socialLinks);
    if (isCurrentUserOwner()) {
      const access = await fetchAdminAccessData().catch(() => ({ invites: [], members: [] }));
      setInvites(access.invites);
      setMembers(access.members);
    }
  }, []);

  useEffect(() => {
    document.title = 'Admin Panel — GB STUDY';
    let active = true;
    const unsubAuth = subscribeToAdminAuth(async (state) => {
      if (!active) return;
      if (!state.authenticated) {
        setAuthenticated(false);
        setIsOwner(false);
        if (state.error) setLoginError(state.error);
        setLoading(false);
        return;
      }
      try {
        setIsOwner(state.isOwner);
        await loadDashboard();
        if (active) setAuthenticated(true);
      } catch (err) {
        if (active) {
          setAuthenticated(false);
          setIsOwner(false);
          if (err instanceof AdminAuthError) setLoginError('');
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubAuth();
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!authenticated) return;
    return subscribeToBootstrap((snapshot) => {
      setApps(snapshot.apps);
      setSliderPhotos(snapshot.sliderPhotos);
    });
  }, [authenticated]);

  const handleGoogleLogin = async () => {
    setLoginBusy(true);
    setLoginError('');
    try {
      await adminLoginWithGoogle(pendingInvite);
      setIsOwner(isCurrentUserOwner());
      setAuthenticated(true);
      setLoading(true);
      await loadDashboard();
    } catch (err) {
      setAuthenticated(false);
      setLoginError(err instanceof Error ? err.message : 'Google sign-in fail ho gaya.');
    } finally {
      setLoginBusy(false);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setAuthenticated(false);
    setIsOwner(false);
    setApps([]);
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessBusy(true);
    setAccessError('');
    try {
      const created = await createAdminInvite(inviteLabel);
      setInvites((prev) =>
        prev.some((i) => i.code === created.code)
          ? prev.map((i) => (i.code === created.code ? created : i))
          : [created, ...prev]
      );
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Invite create fail ho gaya.');
    } finally {
      setAccessBusy(false);
    }
  };

  const handleToggleInvite = async (invite: AdminInviteItem) => {
    setAccessError('');
    try {
      await toggleAdminInvite(invite.code, !invite.is_active);
      setInvites((prev) =>
        prev.map((i) => (i.code === invite.code ? { ...i, is_active: !i.is_active } : i))
      );
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleDeleteInvite = async (code: string) => {
    setAccessError('');
    try {
      await deleteAdminInvite(code);
      setInvites((prev) => prev.filter((i) => i.code !== code));
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleRemoveMember = async (uid: string) => {
    setAccessError('');
    try {
      await removeAdminMember(uid);
      setMembers((prev) => prev.filter((m) => m.uid !== uid));
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Remove failed.');
    }
  };

  const normalizedShareBase = (shareBaseUrl.trim() || CLOUDFLARE_PAGES_URL).replace(/\/+$/, '');
  const buildShareUrl = (code: string) => `${normalizedShareBase}/admin?invite=${code}`;

  const copyShareUrl = async (code: string) => {
    const url = buildShareUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setAccessError('Copy nahi hua — neeche diya link manually copy karein.');
    }
  };

  const updateAppField = <K extends keyof AppFormState>(key: K, value: AppFormState[K]) => {
    setAppForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetAppForm = () => {
    setEditingId(null);
    setAppForm(EMPTY_APP_FORM);
    setAppError('');
    setAppSuccess('');
  };

  const handleSelectEditApp = (app: AppCatalogItem) => {
    setEditingId(app.id);
    setAppForm({
      name: app.name,
      logo_url: app.logo_url ?? '',
      app_url: app.app_url ?? '',
      app_url_2: app.app_url_2 ?? '',
      app_url_3: app.app_url_3 ?? '',
      app_url_4: app.app_url_4 ?? '',
      is_active: app.is_active,
      open_mode: app.open_mode ?? 'auto',
    });
    setAppError('');
    setAppSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAppError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAppError('Photo must be smaller than 5 MB.');
      return;
    }
    try {
      const compressed = await resizeLogoToDataUrl(file);
      updateAppField('logo_url', compressed);
      setAppError('');
    } catch (err) {
      setAppError(err instanceof Error ? err.message : 'Image load failed.');
    }
  };

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppSaving(true);
    setAppError('');
    setAppSuccess('');
    try {
      const payload = {
        name: appForm.name,
        logo_url: appForm.logo_url || null,
        app_url: appForm.app_url.trim() || null,
        app_url_2: appForm.app_url_2.trim() || null,
        app_url_3: appForm.app_url_3.trim() || null,
        app_url_4: appForm.app_url_4.trim() || null,
        is_active: appForm.is_active,
        open_mode: appForm.open_mode,
      };
      const { app } = await adminSaveApp(editingId, payload);
      setApps((prev) => {
        const next = prev.some((a) => a.id === app.id)
          ? prev.map((a) => (a.id === app.id ? app : a))
          : [...prev, app];
        return next.sort((a, b) => a.sort_order - b.sort_order);
      });
      setAppSuccess(editingId ? 'App updated successfully.' : 'New app added successfully.');
      setEditingId(null);
      setAppForm(EMPTY_APP_FORM);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setAuthenticated(false);
        setLoginError('Session expire ho gaya. Dobara login karein.');
        return;
      }
      setAppError(err instanceof Error ? err.message : 'App could not be saved.');
    } finally {
      setAppSaving(false);
    }
  };

  const handleDeleteApp = async (app: AppCatalogItem) => {
    if (!window.confirm(`Delete ${app.name} from the catalog?`)) return;
    setAppError('');
    try {
      await adminDeleteApp(app.id);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      if (editingId === app.id) resetAppForm();
      setAppSuccess(`${app.name} deleted.`);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setAuthenticated(false);
        setLoginError('Session expire ho gaya. Dobara login karein.');
        return;
      }
      setAppError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingBusy(true);
    setBrandingError('');
    setBrandingSuccess('');
    try {
      await adminSaveBranding(headerTitle);
      setBrandingSuccess('Header text saved.');
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setAuthenticated(false);
        setLoginError('Session expire ho gaya. Dobara login karein.');
        return;
      }
      setBrandingError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBrandingBusy(false);
    }
  };

  const handleSaveSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSocialBusy(true);
    setSocialError('');
    setSocialSuccess('');
    try {
      await adminSaveSocialLinks(socialForm);
      setSocialSuccess('Social links saved.');
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setAuthenticated(false);
        setLoginError('Session expire ho gaya. Dobara login karein.');
        return;
      }
      setSocialError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSocialBusy(false);
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading admin panel...</div>;
  }

  if (!authenticated) {
    return (
      <main className="auth-page">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
        <div className="auth-card">
          <Link to="/" className="auth-back">
            <ArrowLeft size={15} /> Back to workspace
          </Link>
          <div className="auth-form">
            <h1 className="text-lg font-bold tracking-tight text-white">GB STUDY Admin</h1>
            <p className="text-xs text-white/70 leading-relaxed">
              {pendingInvite
                ? 'Admin Share Link active hai — apni verified Google ID se Sign-In karke Admin Panel kholein.'
                : `Owner (${ADMIN_OWNER_EMAIL}) ya Shareable Admin Link wale users apni Google ID se Sign-In kar sakte hain.`}
            </p>

            {loginError && <p className="form-error">{loginError}</p>}

            <button
              type="button"
              disabled={loginBusy}
              onClick={() => void handleGoogleLogin()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 auth-submit"
            >
              <LogIn size={16} />
              {loginBusy ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <Link to="/" className="admin-back">
            <ArrowLeft size={15} /> Workspace
          </Link>
          <p className="eyebrow">
            <span className="eyebrow-dot" /> Catalog control
          </p>
          <h1>
            Manage study apps<span>.</span>
          </h1>
          <p className="admin-subtitle">Add, edit, or remove the tools shown in your workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void downloadCloudflarePagesZip()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Download size={15} /> Pages ZIP
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <div className="admin-layout">
        {/* 1. ADD / EDIT APP */}
        <section className="admin-editor">
          <div className="admin-section-heading">
            <div>
              <span className="section-kicker">{editingId ? 'EDIT APP' : 'NEW APP'}</span>
              <h2>{editingId ? 'Update app details' : 'Add a new app'}</h2>
            </div>
            {editingId && (
              <button
                type="button"
                aria-label="Cancel editing"
                onClick={resetAppForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <form
            onSubmit={handleSaveApp}
            className="admin-form app-card app-card-amber admin-card-form"
          >
            <span className="vip-badge">{editingId ? 'EDIT' : 'NEW'}</span>

            <div className="admin-card-upload">
              <button
                type="button"
                className="app-icon app-icon-logo admin-logo-button"
                aria-label="Choose app logo"
                onClick={() => logoInputRef.current?.click()}
              >
                {appForm.logo_url ? (
                  <img src={appForm.logo_url} alt="Selected app logo" />
                ) : (
                  <ImagePlus size={22} />
                )}
              </button>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium hover:bg-white/10"
              >
                <Upload size={14} /> Choose logo
              </button>
              <input
                ref={logoInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
              />
            </div>

            <label className="admin-card-field">
              App name
              <input
                value={appForm.name}
                onChange={(e) => updateAppField('name', e.target.value)}
                placeholder="e.g. Physics Wallah"
                required
                className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>

            <label className="admin-card-field">
              App URL link 1
              <input
                type="url"
                value={appForm.app_url}
                onChange={(e) => updateAppField('app_url', e.target.value)}
                placeholder="https://example.com"
                required
                className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>

            <label className="admin-card-field">
              App URL link 2
              <input
                type="url"
                value={appForm.app_url_2}
                onChange={(e) => updateAppField('app_url_2', e.target.value)}
                placeholder="https://example.com/page-2"
                className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>

            <label className="admin-card-field">
              App URL link 3
              <input
                type="url"
                value={appForm.app_url_3}
                onChange={(e) => updateAppField('app_url_3', e.target.value)}
                placeholder="https://example.com/page-3"
                className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>

            <label className="admin-card-field">
              App URL link 4
              <input
                type="url"
                value={appForm.app_url_4}
                onChange={(e) => updateAppField('app_url_4', e.target.value)}
                placeholder="https://example.com/page-4"
                className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>

            <div className="admin-status-field">
              <div>
                <strong>App status</strong>
                <span>{appForm.is_active ? 'ON · Home page' : 'OFF · Soon page'}</span>
              </div>
              <StatusSwitch
                checked={appForm.is_active}
                onCheckedChange={(v) => updateAppField('is_active', v)}
                ariaLabel="App status"
                className="admin-status-switch"
              />
            </div>

            <label className="admin-card-field">
              Open mode
              <select
                value={appForm.open_mode}
                onChange={(e) =>
                  updateAppField('open_mode', e.target.value as 'auto' | 'frame' | 'direct')
                }
                className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="auto">Auto (Smart — Disha / Target Board direct khole)</option>
                <option value="frame">In-App Frame (Screen ke andar khole)</option>
                <option value="direct">Direct Browser (New Tab — jab frame block kare)</option>
              </select>
            </label>

            {appError && <p className="form-error">{appError}</p>}
            {appSuccess && <p className="form-success">{appSuccess}</p>}

            <div className="admin-form-actions admin-card-form-actions">
              <button type="submit" className="app-open-btn" disabled={appSaving}>
                {appSaving ? (
                  'Saving...'
                ) : editingId ? (
                  <>
                    <Save size={15} /> Save changes
                  </>
                ) : (
                  <>
                    <Plus size={15} /> Add app
                  </>
                )}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetAppForm}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* 2. HOME HEADER TEXT */}
        <section className="admin-editor">
          <div className="admin-section-heading">
            <div>
              <span className="section-kicker">HOME HEADER</span>
              <h2>Header text</h2>
              <p className="admin-section-note">
                Home page ke upar jo naam dikhta hai, yahan se badlo.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveBranding} className="admin-form admin-card-form">
            <label className="admin-card-field">
              Header text
              <input
                value={headerTitle}
                onChange={(e) => setHeaderTitle(e.target.value)}
                placeholder={DEFAULT_HEADER_TITLE}
                className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            {brandingError && <p className="form-error">{brandingError}</p>}
            {brandingSuccess && <p className="form-success">{brandingSuccess}</p>}
            <div className="admin-form-actions admin-card-form-actions">
              <button type="submit" className="app-open-btn" disabled={brandingBusy}>
                {brandingBusy ? (
                  'Saving...'
                ) : (
                  <>
                    <Save size={15} /> Save header text
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* 3. HOME SLIDER PHOTOS */}
        <SliderPhotosEditor
          initialPhotos={sliderPhotos}
          onSync={setSliderPhotos}
          onAuthError={() => {
            setAuthenticated(false);
            setLoginError('Session expire ho gaya. Dobara login karein.');
          }}
        />

        {/* 4. SOCIAL LINKS */}
        <section className="admin-editor">
          <div className="admin-section-heading">
            <div>
              <span className="section-kicker">OWNER PAGE &amp; HOME POP-UP</span>
              <h2>Social links</h2>
              <p className="admin-section-note">
                Yahi links home page ke join pop-up me dikhte hain.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSocial} className="admin-form admin-card-form">
            {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
              <label key={key} className="admin-card-field">
                {label} link
                <input
                  type="url"
                  value={socialForm[key]}
                  onChange={(e) =>
                    setSocialForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
            ))}
            {socialError && <p className="form-error">{socialError}</p>}
            {socialSuccess && <p className="form-success">{socialSuccess}</p>}
            <div className="admin-form-actions admin-card-form-actions">
              <button type="submit" className="app-open-btn" disabled={socialBusy}>
                {socialBusy ? (
                  'Saving...'
                ) : (
                  <>
                    <Save size={15} /> Save social links
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* 4B. SHAREABLE ADMIN ACCESS (OWNER ONLY) */}
        {isOwner && (
          <section className="admin-editor">
            <div className="admin-section-heading">
              <div>
                <span className="section-kicker">MULTI-DEVICE ADMIN SHARE</span>
                <h2>Share Admin Link</h2>
                <p className="admin-section-note">
                  Yahan se jo link banakar aap kisi bhi user ko bhejenge, woh apne device me apni
                  Google ID se Admin Panel khol sakta hai.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateInvite} className="admin-form admin-card-form">
              <label className="admin-card-field">
                Website URL (jahan aapki site live hai)
                <input
                  type="url"
                  value={shareBaseUrl}
                  onChange={(e) => setShareBaseUrl(e.target.value)}
                  placeholder={CLOUDFLARE_PAGES_URL}
                  className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShareBaseUrl(CLOUDFLARE_PAGES_URL)}
                  className="inline-flex h-7 items-center rounded border border-white/15 bg-white/5 px-2.5 text-[11px] text-white/85 hover:bg-white/10"
                >
                  Use gbstudyweb.pages.dev
                </button>
                <button
                  type="button"
                  onClick={() => setShareBaseUrl(PUBLIC_SHARED_APP_URL)}
                  className="inline-flex h-7 items-center rounded border border-white/15 bg-white/5 px-2.5 text-[11px] text-white/85 hover:bg-white/10"
                >
                  Use AI Studio Published URL
                </button>
              </div>

              <label className="admin-card-field">
                Link naam / label
                <input
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value)}
                  placeholder="Team Admin Link"
                  className="flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>

              {accessError && <p className="form-error">{accessError}</p>}

              <div className="admin-form-actions admin-card-form-actions">
                <button type="submit" className="app-open-btn" disabled={accessBusy}>
                  <Link2 size={15} />
                  {accessBusy ? 'Creating...' : 'Create Shareable Admin Link'}
                </button>
              </div>

              {invites.length > 0 && (
                <div className="mt-4 space-y-2">
                  {invites.map((inv) => {
                    const shareUrl = buildShareUrl(inv.code);
                    return (
                      <div
                        key={inv.code}
                        className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-white">
                            {inv.label || 'Shared Link'} ({inv.is_active ? 'ON' : 'OFF'})
                          </strong>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void copyShareUrl(inv.code)}
                              className="inline-flex h-7 items-center gap-1 rounded border border-white/15 bg-white/5 px-2.5 text-white hover:bg-white/10"
                            >
                              {copiedCode === inv.code ? <Check size={13} /> : <Copy size={13} />}
                              {copiedCode === inv.code ? 'Copied' : 'Copy Link'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleInvite(inv)}
                              className="inline-flex h-7 items-center rounded border border-white/15 bg-white/5 px-2 text-white/80 hover:bg-white/10"
                            >
                              {inv.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteInvite(inv.code)}
                              aria-label="Delete link"
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/15 bg-white/5 text-red-400 hover:bg-red-500/20"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1.5 break-all font-mono text-[11px] text-cyan-300">
                          {shareUrl}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {members.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                    <Users size={14} /> Approved Admin Users ({members.length})
                  </div>
                  {members.map((m) => (
                    <div
                      key={m.uid}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
                    >
                      <span className="truncate text-white/90">{m.email}</span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(m.uid)}
                        className="inline-flex h-7 items-center gap-1 rounded border border-red-400/30 px-2 text-[11px] text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </section>
        )}

        {/* 5. LIVE CATALOG + LINK USERS CHART */}
        <section className="admin-list-section token-admin-section">
          <div className="admin-section-heading">
            <div>
              <span className="section-kicker">LIVE CATALOG</span>
              <h2>{apps.length} apps in workspace</h2>
            </div>
            <span className="admin-live">
              <i /> Synced
            </span>
          </div>

          <div className="admin-list">
            {apps.length === 0 && (
              <div className="admin-empty">
                <Plus size={22} />
                <p>No apps yet. Add your first study tool.</p>
              </div>
            )}

            {apps.map((app) => {
              const counts = linkCounters[app.id] ?? [0, 0, 0, 0];
              const maxVal = Math.max(...counts, 1);
              const total = counts.reduce((acc, c) => acc + c, 0);

              return (
                <article key={app.id} className="admin-app-row admin-app-row-chart">
                  <div className="admin-app-top">
                    {app.logo_url ? <img src={app.logo_url} alt={`${app.name} logo`} /> : null}
                    <div className="admin-app-copy">
                      <strong>{app.name}</strong>
                      <span>{app.label || 'No label'}</span>
                      <small>
                        {app.is_active
                          ? `ON · ${app.vip_text || 'VIP'} · ${app.open_text || 'OPEN THIS APP'}`
                          : 'OFF · COMING SOON'}
                      </small>
                    </div>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        aria-label={`Edit ${app.name}`}
                        onClick={() => handleSelectEditApp(app)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${app.name}`}
                        onClick={() => void handleDeleteApp(app)}
                        className="delete-button inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10"
                      >
                        <Trash2 size={15} />
                      </button>
                      {app.app_url && (
                        <a
                          href={app.app_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${app.name}`}
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="link-chart" aria-label={`${app.name} link users chart`}>
                    <div className="link-chart-head">
                      <span>Link users</span>
                      <strong>{total} total</strong>
                    </div>
                    {counts.map((count, idx) => (
                      <div key={idx} className="link-chart-row">
                        <span className="link-chart-label">Link {idx + 1}</span>
                        <div className="link-chart-track">
                          <div
                            className={`link-chart-bar link-chart-bar-${idx + 1}`}
                            style={{
                              width: `${Math.max((count / maxVal) * 100, count > 0 ? 8 : 0)}%`,
                            }}
                          />
                        </div>
                        <span className="link-chart-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
