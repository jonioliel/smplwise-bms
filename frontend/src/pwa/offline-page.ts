/**
 * CR-008 P3: the page the service worker answers a navigation with when the network is gone and no copy of the app shell
 * is cached yet. Hebrew, right to left, no script (the remote channel's CSP forbids inline script) and nothing fetched:
 * everything it needs is inline. Imported only by sw.ts.
 */
export const OFFLINE_HTML = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>SmplWise Arx · אין חיבור</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { display: flex; align-items: center; justify-content: center; background: #f5f7fb; color: #0f172a;
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Heebo, Arial, sans-serif; box-sizing: border-box;
    /* standalone: keep clear of the notch and the home indicator */
    padding: max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px)); }
  main { max-width: 420px; text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px 24px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, .06); }
  .mark { width: 64px; height: 64px; margin: 0 auto 16px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0 0 20px; color: #475569; font-size: 15px; }
  a { display: inline-block; background: #2f6bff; color: #fff; text-decoration: none; border-radius: 10px; padding: 10px 22px; font-weight: 600; }
</style>
</head>
<body>
<main>
  <svg class="mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#2f6bff"/><path d="M136 376V216a120 120 0 0 1 240 0v160h-72V232a48 48 0 0 0-96 0v144z" fill="#fff"/><rect x="104" y="392" width="304" height="32" rx="16" fill="#fff"/></svg>
  <h1>אין חיבור לשרת</h1>
  <p>Arx לא מצליח להגיע למערכת כרגע. בדקו את החיבור לאינטרנט (או לרשת הביתית) ונסו שוב. וידאו ונתונים חיים זמינים רק כשיש חיבור.</p>
  <a href="./">נסה שוב</a>
</main>
</body>
</html>`;
