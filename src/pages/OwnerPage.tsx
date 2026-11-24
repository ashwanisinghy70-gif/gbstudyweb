import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Globe, Heart, Sparkles, Users, Zap } from 'lucide-react';
import {
  BRAND_ICON_URL,
  fetchPublicBootstrap,
  getCachedBootstrap,
  subscribeToBootstrap,
} from '../lib/api';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { useSecretAdminTap } from '../lib/useSecretAdminTap';
import {
  InstagramIcon,
  TelegramIcon,
  WhatsAppIcon,
  YouTubeIcon,
} from '../components/SocialIcons';
import type { SocialLinks } from '../types';

const SOCIAL_CONFIG = [
  {
    platform: 'telegram' as const,
    label: 'TELEGRAM',
    fallback: 'https://t.me/gbstudy',
    Icon: TelegramIcon,
  },
  {
    platform: 'youtube' as const,
    label: 'YOUTUBE',
    fallback: 'https://youtube.com/@gbstudy',
    Icon: YouTubeIcon,
  },
  {
    platform: 'whatsapp' as const,
    label: 'WHATSAPP',
    fallback: 'https://wa.me/919999999999',
    Icon: WhatsAppIcon,
  },
  {
    platform: 'instagram' as const,
    label: 'INSTAGRAM',
    fallback: 'https://instagram.com/gbstudy',
    Icon: InstagramIcon,
  },
];

const OWNER_STATS = [
  { value: '10+', label: 'APPS BUILT', highlight: false },
  { value: '50K+', label: 'TOTAL USERS', highlight: true },
  { value: '3 YRS', label: 'EXPERIENCE', highlight: false },
  { value: '100%', label: 'ALWAYS FREE', highlight: false },
];

const OWNER_VALUES = [
  {
    Icon: Sparkles,
    title: 'FREE FOREVER',
    text: 'Koi paywall nahi, koi subscription nahi. Premium apps sabke liye — yeh haq hai, privilege nahi.',
    tone: 'amber',
  },
  {
    Icon: Users,
    title: 'STUDENT-FIRST',
    text: 'Har design decision, har feature — student ke liye bana, investor ke liye nahi.',
    tone: 'blue',
  },
  {
    Icon: Zap,
    title: 'SPEED & ACCESS',
    text: 'Low-end devices aur slow connections ke liye optimised. 2G pe chale, tabhi ship hota hai.',
    tone: 'green',
  },
  {
    Icon: Globe,
    title: 'PAN-INDIA REACH',
    text: 'Metro se gaon tak — students aur success ke beech ka har barrier todna hai.',
    tone: 'purple',
  },
];

const OWNER_QUOTES = [
  {
    text: 'The best investment you can make is in yourself and the people around you.',
    author: 'Warren Buffett',
  },
  {
    text: 'Education is the most powerful weapon you can use to change the world.',
    author: 'Nelson Mandela',
  },
  {
    text: 'Knowledge should be free. Every student deserves a fair shot — regardless of their wallet.',
    author: 'Sarvottam Yadav',
  },
];

export function OwnerPage() {
  const [social, setSocial] = useState<SocialLinks>(
    () =>
      getCachedBootstrap()?.socialLinks ?? {
        telegram: 'https://t.me/gbstudy',
        youtube: 'https://youtube.com/@gbstudy',
        whatsapp: 'https://wa.me/919999999999',
        instagram: 'https://instagram.com/gbstudy',
      }
  );

  const handleBrandIconTap = useSecretAdminTap();

  useEffect(() => {
    document.title = 'Owner — GB STUDY';
    const unsubscribe = subscribeToBootstrap((snapshot) => {
      setSocial(snapshot.socialLinks);
    });
    void fetchPublicBootstrap()
      .then((snapshot) => setSocial(snapshot.socialLinks))
      .catch(() => undefined);
    return unsubscribe;
  }, []);

  return (
    <div className="study-shell min-h-screen overflow-hidden page-bg-dark">
      <main className="main-panel">
        <div className="content-wrap owner-wrap tab-page-enter">
          <section className="owner-profile">
            <div className="owner-social-circles">
              {SOCIAL_CONFIG.map(({ platform, fallback, Icon, label }) => (
                <a
                  key={platform}
                  href={social[platform] || fallback}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className={`owner-social-circle ${platform}`}
                >
                  <Icon className="owner-brand-logo" />
                </a>
              ))}
            </div>

            <div
              className="owner-avatar-ring select-none touch-manipulation"
              onClick={handleBrandIconTap}
            >
              <img
                src={BRAND_ICON_URL}
                alt="Sarvottam Yadav avatar"
                className="owner-avatar"
                draggable={false}
                referrerPolicy="no-referrer"
              />
              <span className="owner-verified">
                <BadgeCheck size={26} strokeWidth={2.4} />
              </span>
            </div>

            <h1 className="owner-name">
              𝐒𝐀𝐑𝐕𝐎𝐓𝐓𝐀𝐌 𝐘𝐀𝐃𝐀𝐕 ✦
              <span className="sr-only">
                {' '}
                — Founder of GB STUDY, free study apps for students
              </span>
            </h1>

            <p className="owner-bio">
              Founder of <strong>GB STUDY</strong> — students tak free, high-quality apps aur
              education pahunchana, poore India mein.
            </p>
          </section>

          <section className="owner-quote-card">
            <span className="owner-quote-mark">“</span>
            <p className="owner-quote-text">“{OWNER_QUOTES[0].text}”</p>
            <p className="owner-quote-author">— {OWNER_QUOTES[0].author}</p>
          </section>

          <section className="owner-stats" aria-label="Stats">
            {OWNER_STATS.map((stat) => (
              <div
                key={stat.label}
                className={`owner-stat${stat.highlight ? ' owner-stat-hot' : ''}`}
              >
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </section>

          <section className="owner-mission">
            <span className="owner-mission-icon">
              <Heart size={26} strokeWidth={2.2} />
            </span>
            <h2>“Sabko Free, High-Quality Apps.”</h2>
            <p>
              Koi bhi student paise ki wajah se peeche na rahe. Main aise free platforms banata
              hoon jo India ke har aspirant — sheher se gaon tak — ko wahi quality dete hain jo
              pehle hazaaron mein milti thi.
            </p>
          </section>

          <section className="owner-values" aria-label="Values">
            <h2 className="sr-only">Our values</h2>
            {OWNER_VALUES.map(({ Icon, title, text, tone }) => (
              <article key={title} className={`owner-value-card ${tone}`}>
                <Icon size={24} strokeWidth={2.2} className="owner-value-icon" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </section>

          {OWNER_QUOTES.slice(1).map((quote) => (
            <section key={quote.author} className="owner-quote-card">
              <span className="owner-quote-mark">“</span>
              <p className="owner-quote-text">“{quote.text}”</p>
              <p className="owner-quote-author">— {quote.author}</p>
            </section>
          ))}

          <section className="owner-links" aria-label="Social links">
            {SOCIAL_CONFIG.map(({ platform, label, fallback, Icon }) => (
              <a
                key={platform}
                href={social[platform] || fallback}
                target="_blank"
                rel="noreferrer"
                className={`owner-link-row ${platform}`}
              >
                <span className="owner-link-row-icon">
                  <Icon className="owner-brand-logo" />
                </span>
                <span className="owner-link-row-label">{label}</span>
                <ArrowRight size={17} className="owner-link-row-arrow" />
              </a>
            ))}
          </section>
        </div>

        <MobileBottomNav active="owner" />
      </main>
    </div>
  );
}
