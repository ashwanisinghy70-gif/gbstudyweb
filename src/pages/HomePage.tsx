import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Crown } from 'lucide-react';
import {
  BRAND_ICON_URL,
  DEFAULT_HEADER_TITLE,
  fetchPublicBootstrap,
  getCachedBootstrap,
  subscribeToBootstrap,
} from '../lib/api';
import { Link } from '../lib/router';
import { useSecretAdminTap } from '../lib/useSecretAdminTap';
import { CommunityStrip } from '../components/CommunityStrip';
import { JoinPopup } from '../components/JoinPopup';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PhotoSlider } from '../components/PhotoSlider';
import type { PublicBootstrapData } from '../types';

export function HomePage() {
  const [data, setData] = useState<PublicBootstrapData | null>(() => getCachedBootstrap());
  const [loaded, setLoaded] = useState<boolean>(() => Boolean(getCachedBootstrap()));
  const [query, setQuery] = useState('');
  const handleBrandIconTap = useSecretAdminTap();

  useEffect(() => {
    document.title = 'GB STUDY — Study Apps & Learning Resources';
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBootstrap((snapshot) => {
      setData(snapshot);
      setLoaded(true);
    });
    void fetchPublicBootstrap()
      .then((snapshot) => {
        setData(snapshot);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
    return unsubscribe;
  }, []);

  const headerTitle = data?.branding.header_title?.trim() || DEFAULT_HEADER_TITLE;

  const filteredApps = useMemo(() => {
    const list = data?.apps ?? [];
    const q = query.trim().toLowerCase();
    return list.filter(
      (app) =>
        app.is_active &&
        `${app.name} ${app.description} ${app.label}`.toLowerCase().includes(q)
    );
  }, [data, query]);

  return (
    <div className="study-shell min-h-screen overflow-hidden page-bg-dark">
      <div className="mesh-lines" />
      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-header mobile-only-flex">
            <div className="mobile-header-top">
              <div className="mobile-brand mobile-brand-bat">
                <div
                  className="brand-symbol brand-symbol-bat select-none touch-manipulation"
                  onClick={handleBrandIconTap}
                >
                  <img
                    src={BRAND_ICON_URL}
                    alt="GB Study"
                    width={30}
                    height={30}
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h1 className="brand-name-bat">{headerTitle}</h1>
              </div>
              <div className="mobile-live">
                <span className="live-dot" />
                LIVE
              </div>
            </div>
            <div className="mobile-search-wrap">
              <div className="group relative w-full">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#635CFF]/20 via-[#3EB05A]/30 to-[#635CFF]/20 opacity-50 blur-lg transition duration-500 group-focus-within:opacity-100" />
                <div className="relative flex items-center overflow-hidden rounded-xl border border-[#373737] bg-[#171717] shadow-2xl transition-all duration-300 group-focus-within:border-[#3EB05A]/60">
                  <div className="flex flex-shrink-0 items-center justify-center pl-4 pr-2">
                    <svg
                      className="h-5 w-5 text-[#3EB05A] drop-shadow-[0_0_8px_rgba(62,176,90,0.6)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="search"
                    placeholder="SEARCH APP..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full border-none bg-transparent px-2 py-3.5 text-sm font-bold tracking-[0.15em] text-[#FFFFFF] outline-none placeholder:text-[#555555]"
                  />
                  <div className="flex flex-shrink-0 items-center space-x-1 pr-4 opacity-40">
                    <div className="h-3 w-1 rounded-full bg-[#3EB05A]" />
                    <div className="h-5 w-1 rounded-full bg-[#3EB05A]" />
                    <div className="h-3 w-1 rounded-full bg-[#3EB05A]" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#3EB05A] to-transparent opacity-50" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <PhotoSlider photos={data?.sliderPhotos ?? []} loaded={loaded} />

        <CommunityStrip telegramUrl={data?.socialLinks.telegram} />

        <div className="content-wrap apps-only tab-page-enter">
          <section className="apps-panel animate-fade-in">
            <div className="apps-grid">
              {filteredApps.map((app) => (
                <Link
                  key={app.id}
                  to={`/app/${encodeURIComponent(app.id)}`}
                  className={`app-card ${app.tone || 'app-card-amber'}`}
                >
                  <span className="vip-badge">
                    <Crown size={9} strokeWidth={2.4} aria-hidden="true" />
                    {app.vip_text || 'VIP'}
                  </span>
                  <div className="app-icon app-icon-logo">
                    {app.logo_url ? (
                      <img
                        src={app.logo_url}
                        alt={`${app.name} logo`}
                        loading="lazy"
                        decoding="async"
                        width={512}
                        height={512}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="app-card-copy">
                    <strong>{app.name}</strong>
                  </div>
                  <div className="app-open-btn">
                    <span>{app.open_text || 'OPEN THIS APP'}</span>
                    <ArrowRight size={12} className="app-open-arrow" aria-hidden="true" />
                  </div>
                </Link>
              ))}
              {loaded && filteredApps.length === 0 && (
                <div className="empty-search">
                  {query ? `No study apps match “${query}”.` : 'No apps yet.'}
                </div>
              )}
            </div>
          </section>
        </div>

        <JoinPopup socialLinks={data?.socialLinks ?? null} />
        <MobileBottomNav active="home" />
      </main>
    </div>
  );
}
