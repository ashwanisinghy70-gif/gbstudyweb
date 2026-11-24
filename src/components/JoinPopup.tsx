import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { SocialLinks } from '../types';
import { TelegramIcon, WhatsAppIcon, YouTubeIcon } from './SocialIcons';

export function JoinPopup({ socialLinks }: { socialLinks: SocialLinks | null }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 320);
  };

  useEffect(() => {
    if (!open || leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, leaving]);

  if (!open || !socialLinks) return null;

  const items = [
    { platform: 'telegram' as const, label: 'TELEGRAM', Icon: TelegramIcon },
    { platform: 'whatsapp' as const, label: 'WHATSAPP', Icon: WhatsAppIcon },
    { platform: 'youtube' as const, label: 'YOUTUBE', Icon: YouTubeIcon },
  ].filter(({ platform }) => Boolean(socialLinks[platform]?.trim()));

  if (items.length === 0) return null;

  return (
    <div
      className={`join-popup-overlay ${leaving ? 'join-popup-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Join our channels"
      onClick={close}
    >
      <div className="join-popup-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="join-popup-close" onClick={close} aria-label="Close">
          <X size={16} strokeWidth={2.5} />
        </button>
        <div className="join-popup-glow" aria-hidden="true" />
        <h2 className="join-popup-title">JOIN OUR COMMUNITY</h2>
        <p className="join-popup-sub">Updates aur naye apps sabse pehle paao</p>
        <div className="join-popup-buttons">
          {items.map(({ platform, label, Icon }) => (
            <a
              key={platform}
              href={socialLinks[platform]}
              target="_blank"
              rel="noopener noreferrer"
              className={`join-popup-btn join-popup-btn-${platform}`}
            >
              <span className="join-popup-btn-icon">
                <Icon className="join-popup-svg" />
              </span>
              <span className="join-popup-btn-label">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
