/**
 * CR-008 P3: the page the service worker answers a navigation with when the network is gone and no copy of the app shell
 * is cached yet. Hebrew, right to left, no script (the remote channel's CSP forbids inline script) and nothing fetched:
 * everything it needs is inline. Imported only by sw.ts.
 *
 * KIOSK polish (2026-10-11): the page has no token sheet (it is served by the worker alone), so the classic values of
 * design/tokens.ts are written here by hand for BOTH schemes (`prefers-color-scheme`), the button is a 48 px target, the
 * type is the shell's body size and the card keeps clear of the notch and the home indicator in standalone mode.
 */
export const OFFLINE_HTML = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>SmplWise Arx · אין חיבור</title>
<style>
  :root { --bg: #f5f7fb; --surface: #ffffff; --line: #e7ebf2; --text: #22314c; --text-2: #5b6a85; --accent: #2767ed; --on-accent: #ffffff; --shadow: 0 6px 18px rgba(34, 49, 76, .06); }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1220; --surface: #151c2c; --line: #232e45; --text: #e6ebf5; --text-2: #a9b4ca; --accent: #3a6ce0; --shadow: 0 6px 18px rgba(0, 0, 0, .4); }
  }
  html, body { margin: 0; height: 100%; }
  body { display: flex; align-items: center; justify-content: center; background: var(--bg); color: var(--text);
    font: 15px/1.5 Heebo, system-ui, -apple-system, "Segoe UI", "Noto Sans Hebrew", Arial, sans-serif; box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    /* standalone: keep clear of the notch and the home indicator */
    padding: max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px)); }
  main { width: 100%; max-width: 420px; text-align: center; background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 32px 24px 28px;
    box-shadow: var(--shadow); box-sizing: border-box; }
  .mark { width: 64px; height: 64px; margin: 0 auto 16px; display: block; }
  h1 { font-size: 20px; line-height: 1.25; margin: 0 0 8px; }
  p { margin: 0 0 22px; color: var(--text-2); font-size: 15px; }
  a { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; min-width: 160px; box-sizing: border-box;
    background: var(--accent); color: var(--on-accent); text-decoration: none; border-radius: 999px; padding: 0 28px; font-weight: 600; font-size: 15px; }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
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
