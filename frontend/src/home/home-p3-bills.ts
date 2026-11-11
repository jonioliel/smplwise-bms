// HOME-V3-P3-2432: "חשבון חשמל" - the bill in family words: this period so far, the estimate at its end, the previous bills.
// Only for a person who already holds energy.bills (the money permission of the billing module; no new permission); the amounts are
// the billing module's own (GET energy/accounts/{id}/status `amount_so_far`, GET .../periods with each period's bill). The estimate is a
// straight line from the days so far, said as "בערך". No charges, customers or tariffs here: those stay in the full interface.
import { html, nothing } from 'lit';
import type { P3 } from './home-p3';
import { BILL_STATE, billForecast, ils, money, periodName, vsLast } from './home-p3-logic';

const shekels = (n: number) => html`<span class="num">${ils(n)}</span><span class="cur"> ₪</span>`;

export function sBills(p: P3) {
  const h = p.h;
  const B = p.bill;
  if (!p.has('bills') || !B) return p.off('חשבון חשמל');
  const ic = p.icon;
  const back = html`<a class="hbtn" href=${h.href('energy')}>${ic('bolt')}<span class="bt">צריכה</span></a>`;
  const pick = B.accounts.length > 1 && B.accounts.length <= 3
    ? p.seg(B.accounts.map((a) => [a.id, a.name] as [string, string]), B.acc ?? '', 'חשבון', (v) => void p.loadBill(v)) : nothing;
  if (B.loading && !B.status) return html`${h.head('חשבון חשמל', '', html`${pick}${back}`)}<div class="empty loading" aria-busy="true">${ic('bill')}<h2>טוענים את החשבון…</h2></div>`;
  const soFar = money(B.status?.amount_so_far);
  const per = B.status?.period ?? null;
  const prev = B.periods.filter((x) => x.bill && x.bill.state !== 'void' && x.bill.state !== 'draft' && money(x.bill.total) != null);
  if (B.error || (soFar == null && !prev.length)) return html`${h.head('חשבון חשמל', '', html`${pick}${back}`)}${p.empty('bill', 'עוד אין חשבון', 'אחרי החודש הראשון נראה כאן כמה שילמתם וכמה צפוי.')}`;
  const fc = billForecast(soFar, per?.from, per?.to);
  const last = prev.length ? money(prev[0].bill?.total) : null;
  const pg = p.paged('p3bill', prev, h.phone ? 2 : 4);
  return html`${h.head('חשבון חשמל', per ? periodName(per.from, per.to) : '', html`${pick}${back}`)}
    <div class="en-body" data-p3-bills>
      <section class="tile pane bill-now" aria-label="החודש הזה"><h2>עד עכשיו בתקופה הזו</h2><b class="huge fit" data-p3-sofar>${soFar != null ? shekels(soFar) : '—'}</b>
        ${fc ? html`<div class="mprog" aria-hidden="true"><i style=${`transform:scaleX(${fc.day / fc.of})`}></i></div><span class="muted">יום <span class="num">${fc.day}</span> מתוך <span class="num">${fc.of}</span></span>` : nothing}
        ${fc?.forecast != null ? html`<div class="bill-fc"><span class="muted">צפי לסוף התקופה</span><b class="mid" data-p3-forecast>בערך ${shekels(fc.forecast)}</b><span class="muted">${vsLast(fc.forecast, last)}</span></div>` : nothing}</section>
      <section class="tile pane" aria-label="חשבונות קודמים"><div class="bar"><h2>חשבונות קודמים</h2>${h.pager('p3bill', pg.pages)}</div>
        ${pg.items.map((x) => {
          const st = BILL_STATE[x.bill?.state ?? ''] ?? ['', 'neutral'];
          const due = x.bill?.due_date && st[1] === 'warn' ? ` עד ${x.bill.due_date.slice(8, 10)}.${+x.bill.due_date.slice(5, 7)}` : '';
          return html`<div class="vrow blr"><span class="at"><b class="clamp1">${periodName(x.from, x.to)}</b>${st[0] ? p.pill(st[1], st[0] + due) : nothing}</span><b class="mid">${shekels(money(x.bill?.total) ?? 0)}</b></div>`;
        })}${prev.length ? nothing : html`<p class="muted">עוד אין חשבונות קודמים.</p>`}</section>
    </div>`;
}
