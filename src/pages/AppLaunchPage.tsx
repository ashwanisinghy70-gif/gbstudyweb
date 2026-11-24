import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Layers, LoaderCircle, RefreshCw } from 'lucide-react';
import { assignAppLinkSlot, fetchAppById } from '../lib/api';
import { Link } from '../lib/router';
import type { AppCatalogItem } from '../types';

const LINK_SLOT_PREFIX = 'gbstudy-link-slot-';

const FRAME_BLOCKED_HOSTS = [
  'dishaonlineclasses',
  'targetboard',
  'classplusapp',
  'teachx',
  'appx',
  'graphy',
  'adda247',
  'testbook',
  'utkarsh',
  'rojgarwithankit',
];

function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isDirectRecommended(app: AppCatalogItem, url: string): boolean {
  const mode = app.open_mode ?? 'auto';
  if (mode === 'direct') return true;
  if (mode === 'frame') return false;

  const lowerName = app.name.toLowerCase();
  if (
    lowerName.includes('disha') ||
    lowerName.includes('target board') ||
    lowerName.includes('targetboard')
  ) {
    return true;
  }

  const lowerUrl = url.toLowerCase();
  return FRAME_BLOCKED_HOSTS.some((host) => lowerUrl.includes(host));
}

function EmbeddedAppFrame({ app }: { app: AppCatalogItem | null }) {
  const [slot, setSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewOverride, setViewOverride] = useState<'frame' | 'direct' | null>(null);

  useEffect(() => {
    let active = true;
    setViewOverride(null);
    if (!app) {
      setLoading(false);
      return;
    }

    const storageKey = `${LINK_SLOT_PREFIX}${app.id}`;
    const stored = Number(window.localStorage.getItem(storageKey));
    if (Number.isInteger(stored) && stored >= 1 && stored <= 4) {
      setSlot(stored);
      setLoading(false);
      return;
    }

    assignAppLinkSlot(app.id)
      .then((assigned) => {
        if (!active) return;
        window.localStorage.setItem(storageKey, String(assigned));
        setSlot(assigned);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSlot(1);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [app]);

  const urls = useMemo(() => {
    if (!app) return [];
    return [app.app_url, app.app_url_2, app.app_url_3, app.app_url_4]
      .map((u) => normalizeExternalUrl(u))
      .filter((u): u is string => Boolean(u));
  }, [app]);

  const activeIdx = useMemo(() => {
    if (!urls.length) return 0;
    return slot ? Math.min(Math.max(slot - 1, 0), urls.length - 1) : 0;
  }, [urls, slot]);

  const chosenUrl = urls[activeIdx] ?? null;

  useEffect(() => {
    if (app) {
      document.title = `${app.name} — GB STUDY`;
    }
  }, [app]);

  const handleSelectServer = (nextIndex: number) => {
    const nextSlot = nextIndex + 1;
    setSlot(nextSlot);
    if (app) {
      try {
        window.localStorage.setItem(`${LINK_SLOT_PREFIX}${app.id}`, String(nextSlot));
      } catch {
        // ignore storage restrictions
      }
    }
  };

  if (loading) {
    return (
      <main className="embed-page">
        <h1 className="sr-only">Opening study app — GB STUDY</h1>
        <div className="embed-loading">
          <LoaderCircle className="animate-spin" size={26} />
          <p>𝘼𝙋𝙋 𝙇𝙊𝘼𝘿𝙄𝙉𝙂...</p>
        </div>
      </main>
    );
  }

  if (!app || !chosenUrl) {
    return (
      <main className="embed-page">
        <h1 className="sr-only">{app ? `${app.name} — link unavailable` : 'App not found'}</h1>
        <div className="embed-loading">
          <p>{app ? 'Is app ke liye koi link set nahi hai.' : 'App nahi mila.'}</p>
          <Link to="/" className="embed-back">
            <ArrowLeft size={15} /> Back to workspace
          </Link>
        </div>
      </main>
    );
  }

  const useDirectScreen = viewOverride ? viewOverride === 'direct' : isDirectRecommended(app, chosenUrl);

  return (
    <main className="embed-page">
      <h1 className="sr-only">{app.name} on GB STUDY</h1>

      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#2f9bff]/35 bg-[#081527] px-3 py-2 text-white">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          {app.logo_url && (
            <img
              src={app.logo_url}
              alt=""
              className="h-6 w-6 shrink-0 rounded-md border border-white/20 object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="truncate text-xs font-bold uppercase tracking-wide text-white">
            {app.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {urls.length > 1 && (
            <button
              type="button"
              onClick={() => handleSelectServer((activeIdx + 1) % urls.length)}
              title="Switch Server Link"
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/10"
            >
              <RefreshCw size={12} />
              <span>S{activeIdx + 1}</span>
            </button>
          )}
          <a
            href={chosenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[#2f9bff] px-2.5 py-1.5 text-[11px] font-bold text-[#04101f] shadow hover:bg-[#53aeff]"
          >
            <span>Open</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {useDirectScreen ? (
        <section className="flex flex-1 flex-col items-center justify-center bg-[#070b14] px-5 py-8 text-center text-white">
          <div className="w-full max-w-md rounded-2xl border border-[#2f9bff]/40 bg-[#0d1629] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {app.logo_url && (
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#6762da] bg-[#211f4e] p-1.5 shadow-lg">
                <img
                  src={app.logo_url}
                  alt={app.name}
                  className="h-full w-full rounded-xl object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <h2 className="text-lg font-extrabold uppercase tracking-wide text-white">
              {app.name}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Ye platform browser security rules (X-Frame) ki wajah se frame ke andar block hota
              hai. Neeche button dabakar direct chalayein:
            </p>

            <a
              href={chosenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9bff] to-[#635cff] px-5 py-3.5 text-sm font-extrabold uppercase tracking-wider text-white shadow-[0_10px_28px_rgba(47,155,255,0.35)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <span>OPEN {app.name}</span>
              <ExternalLink size={16} />
            </a>

            {urls.length > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {urls.map((u, idx) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleSelectServer(idx)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      idx === activeIdx
                        ? 'border-[#2f9bff] bg-[#2f9bff]/20 text-white'
                        : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Server {idx + 1}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setViewOverride('frame')}
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
            >
              <Layers size={12} />
              <span>Inside frame me try karein</span>
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0c1322] px-3 py-1.5 text-[11px] text-slate-300">
            <span className="truncate">
              Agar screen blank ya sad icon dikhe to direct browser me kholein:
            </span>
            <a
              href={chosenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-bold text-[#4eb1ff] hover:underline"
            >
              Open Direct ↗
            </a>
          </div>
          <iframe
            key={chosenUrl}
            src={chosenUrl}
            title={app.name}
            className="embed-frame"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </>
      )}
    </main>
  );
}

export function AppLaunchPage({ appId }: { appId: string }) {
  const [app, setApp] = useState<AppCatalogItem | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setApp(undefined);
    fetchAppById(appId)
      .then((res) => {
        if (!active) return;
        setApp(res?.app ?? null);
      })
      .catch(() => {
        if (active) setApp(null);
      });
    return () => {
      active = false;
    };
  }, [appId]);

  if (app === undefined) {
    return (
      <main className="embed-page">
        <h1 className="sr-only">Opening study app — GB STUDY</h1>
        <div className="embed-loading">
          <LoaderCircle className="animate-spin" size={26} />
          <p>𝘼𝙋𝙋 𝙇𝙊𝘼𝘿𝙄𝙉𝙂...</p>
        </div>
      </main>
    );
  }

  return <EmbeddedAppFrame app={app} />;
}
