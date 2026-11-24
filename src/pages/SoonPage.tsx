import { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import {
  BRAND_ICON_URL,
  DEFAULT_HEADER_TITLE,
  fetchPublicBootstrap,
  getCachedBootstrap,
  subscribeToBootstrap,
} from '../lib/api';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { useSecretAdminTap } from '../lib/useSecretAdminTap';
import type { PublicBootstrapData } from '../types';

export function SoonPage() {
  const [data, setData] = useState<PublicBootstrapData | null>(() => getCachedBootstrap());
  const handleBrandIconTap = useSecretAdminTap();

  useEffect(() => {
    document.title = 'Coming Soon Apps — GB STUDY';
    const unsubscribe = subscribeToBootstrap((snapshot) => {
      setData(snapshot);
    });
    void fetchPublicBootstrap()
      .then((snapshot) => setData(snapshot))
      .catch(() => undefined);
    return unsubscribe;
  }, []);

  const headerTitle = data?.branding.header_title?.trim() || DEFAULT_HEADER_TITLE;

  const soonApps = useMemo(() => (data?.apps ?? []).filter((app) => !app.is_active), [data]);

  return (
    <div className="study-shell min-h-screen overflow-hidden page-bg-dark">
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
                <strong className="brand-name-bat">{headerTitle}</strong>
              </div>
              <div className="mobile-live">
                <span className="live-dot" />
                LIVE
              </div>
            </div>
          </div>
        </header>

        <div className="content-wrap apps-only tab-page-enter soon-page-wrap">
          <section className="soon-heading soon-heading-center">
            <h1>UPCOMING RELEASES</h1>
            <div className="soon-heading-tag">
              <Clock3 size={13} strokeWidth={2.4} />
              <span>COMING SOON</span>
            </div>
          </section>

          <section className="apps-panel animate-fade-in">
            <div className="apps-grid">
              {soonApps.map((app) => (
                <article
                  key={app.id}
                  className={`app-card ${app.tone || 'app-card-amber'} soon-app-card`}
                >
                  <span className="vip-badge">
                    <Clock3 size={9} strokeWidth={2.4} />
                    COMING SOON
                  </span>
                  <div className="app-icon app-icon-logo">
                    {app.logo_url ? (
                      <img
                        src={app.logo_url}
                        alt={`${app.name} logo`}
                        loading="lazy"
                        width={512}
                        height={512}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="app-card-copy">
                    <strong>{app.name}</strong>
                  </div>
                  <div className="app-open-btn soon-card-status">NOT AVAILABLE YET</div>
                </article>
              ))}
              {soonApps.length === 0 && (
                <div className="empty-search">Abhi koi upcoming app nahi hai.</div>
              )}
            </div>
          </section>
        </div>

        <MobileBottomNav active="soon" />
      </main>
    </div>
  );
}
