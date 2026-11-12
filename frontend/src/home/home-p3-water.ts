// HOME-V3-P3-2432: "מים" - today against a usual day, the week in litres per day, and whether a leak is suspected (the water module's
// own leak detection: GET infra/water/events/summary `open_leaks`). View only: there is no main-valve control in the product, so none is
// drawn; acknowledging a water alert stays where it is today (the alerts and the full interface).
import { html, nothing } from 'lit';
import type { P3 } from './home-p3';
import { diffWords, ils, num1, vsUsual, weekBars } from './home-p3-logic';
import { gapTicketButton } from './home-gaps'; // HOME-V3-GAPS-2436

const usualLine = (w: { pct: string | null; words: string }) => (w.pct ? html`<span class="num">${w.pct}</span> ${w.words}` : w.words);

export function sWater(p: P3) {
  const h = p.h;
  const W = p.water;
  if (!p.has('water') || !W) return p.off('מים');
  const ic = p.icon;
  const back = html`<a class="hbtn" href=${h.href('energy')}>${ic('bolt')}<span class="bt">חשמל</span></a>`;
  const bars = weekBars(W.week);
  if (W.today == null && !bars.some((b) => b[1] != null)) return html`${h.head('מים', '', back)}${p.empty('drop', 'עוד אין נתוני מים', 'אחרי יום שימוש ראשון נראה כאן כמה מים הבית צורך.')}`;
  const today = W.today ?? bars[bars.length - 1][1] ?? 0;
  bars[bars.length - 1][1] = today;
  const d = vsUsual(bars);
  const mx = Math.max(...bars.map((b) => b[1] ?? 0), 1);
  return html`${h.head(html`היום: <span class="num">${ils(today)}</span> ליטר`, d == null || d === 0 ? 'כמו ביום רגיל' : usualLine(diffWords(d, 'מיום רגיל')), back)}
    <div class="en-body" data-p3-water>
      <section class="tile pane" aria-label="השבוע"><h2>השבוע, ליטר ליום</h2>
        <div class="wbars" dir="rtl">${bars.map(([l, v]) => html`<div class=${'wb' + (v == null ? ' future' : '')}><span class="wv num">${v == null ? '' : ils(v)}</span><i style=${`height:${v == null ? 0 : Math.max(3, (v / mx) * 100)}%`}></i><span class="wbl">${l}</span></div>`)}</div></section>
      <section class="tile pane leak" data-tone=${W.leaks ? 'warn' : 'ok'} aria-label="נזילות" data-p3-leak=${W.leaks ? 'yes' : 'no'}><span class="dlg-ic">${ic('drop')}</span><h2>${W.leaks ? 'חשד לנזילה' : 'לא זוהתה נזילה'}</h2>
        <p class="muted">${W.leaks ? 'המים זורמים ברצף כבר זמן רב, גם כשאף אחד לא משתמש. כדאי לבדוק ברזים ואסלות.' : 'אנחנו בודקים כל הזמן אם מים זורמים כשלא אמורים.'}</p>
        ${W.month != null ? html`<span class="muted">החודש: <span class="num">${num1(W.month / 1000)}</span> מ״ק</span>` : nothing}${W.leaks ? gapTicketButton(h, 'plumber') : nothing}</section>
    </div>`;
}
