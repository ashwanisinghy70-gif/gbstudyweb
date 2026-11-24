import { COMMUNITY_TICKER_TEXT } from '../lib/api';

function safeHttpUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function CommunityStrip({ telegramUrl }: { telegramUrl?: string }) {
  const validUrl = safeHttpUrl(telegramUrl);

  const buttonContent = (
    <>
      <svg className="community-telegram-icon" viewBox="0 0 32 32" role="img" aria-label="Telegram">
        <circle cx="16" cy="16" r="16" fill="currentColor" />
        <path
          className="community-telegram-plane"
          d="m7.5 15.4 16-6.2c.8-.3 1.4.2 1.1 1.3l-2.7 12.8c-.2.9-.7 1.1-1.4.7l-4.2-3.1-2 1.9c-.2.2-.4.4-.8.4l.3-4.3 7.8-7c.3-.3-.1-.4-.5-.2l-9.6 6-4.1-1.3c-.9-.3-.9-.7.1-1z"
        />
      </svg>
      <span className="community-join-copy">
        <span>TELEGRAM</span>
        <strong>JOIN NOW</strong>
      </span>
    </>
  );

  return (
    <section className="community-strip" aria-label="GB STUDY community updates">
      <div className="community-ticker">
        <p className="sr-only">{COMMUNITY_TICKER_TEXT}</p>
        <div className="community-ticker-track" aria-hidden="true">
          <span className="community-ticker-message">
            <span className="community-update-dot" />
            {COMMUNITY_TICKER_TEXT}
            <span className="community-ticker-star">✦</span>
          </span>
        </div>
      </div>
      {validUrl ? (
        <a
          href={validUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Join GB STUDY on Telegram"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 community-join"
        >
          {buttonContent}
        </a>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Telegram link unavailable"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed h-9 px-4 py-2 community-join"
        >
          {buttonContent}
        </button>
      )}
    </section>
  );
}
