// HOME-V3-P2-2431: "מזג אוויר" (mockup v3 `S.weather`): outside now, the next hours and the next days - GET /home/weather (the
// installation's first weather source, through the notice-board feed's own block). The strip's weather line opens it. Nothing scrolls.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { registerMoreTile } from './more-registry';
import { getWeather, type Weather } from './home-p2-api';
import { DAY_NAME, errText, has, warmFamily, weekdayIx, ymd } from './home-p2-ui';

const st: { w: Weather | null; at: number; loading: boolean; error: string } = { w: null, at: 0, loading: false, error: '' };
// the feed's condition names (services/notices/sources.CONDITIONS) -> the home icons
const ICON: Record<string, string> = { sun: 'sun', clear: 'sun', night: 'night', moon: 'night', cloud: 'cloud', partly: 'cloud', fog: 'cloud', rain: 'rain', storm: 'rain', snow: 'rain', wind: 'wind' };
const icon = (c: string) => ICON[c] ?? 'cloud';
const TEXT: Record<string, string> = { sun: 'בהיר', clear: 'בהיר', night: 'לילה בהיר', cloud: 'מעונן', partly: 'מעונן חלקית', fog: 'ערפל', rain: 'גשם', storm: 'סערה', snow: 'שלג', wind: 'רוח' };

function load(h: HomeHost, force = false) {
  if (st.loading || (!force && st.at && Date.now() - st.at < 10 * 60_000)) return;
  st.loading = true;
  void getWeather().then((r) => { st.w = r.weather; st.error = ''; st.at = Date.now(); })
    .catch((e) => { st.error = errText(e); })
    .finally(() => { st.loading = false; h.requestUpdate(); });
}

registerMoreTile({
  id: 'weather', order: 85, href: 'weather', label: 'מזג אוויר', icon: 'sun',
  visible: () => has('weather'),
  warm: (h) => load(h),
  line: (h) => { const t = st.w?.now.t ?? h.d.weather?.t; return { text: t != null ? html`<span class="num">${t}°</span> ${st.w?.now.text ?? h.d.weather?.text ?? ''}` : 'אין נתונים כרגע' }; },
});

registerScreen((h: HomeHost) => ({
  id: 'p2weather',
  names: ['weather'],
  enter: () => { warmFamily(h); load(h, true); },
  render() {
    const w = st.w;
    if (!w) return html`${h.head('מזג אוויר', '')}${st.loading && !st.at ? h.empty('sun', 'טוענים…', '') : h.empty('cloud', 'אין נתוני מזג אוויר', st.error || 'כשיחובר מקור מזג אוויר, התחזית תופיע כאן.')}`;
    const n = w.now;
    const today = ymd(h.now);
    const tom = ymd(new Date(h.now.getTime() + 86_400_000));
    const days = (w.days ?? []).filter((d) => d.date >= today).slice(0, h.phone ? 4 : 5);
    return html`${h.head('מזג אוויר', 'בחוץ, עכשיו ובימים הקרובים')}
      <div class="wx-body"><section class="tile pane wx-now" aria-label="עכשיו">${hi(icon(n.condition))}<b class="huge num">${n.t}°</b><div class="wx-t"><b class="mid clamp2">${n.text}</b>${n.feels != null ? html`<span class="muted">מרגיש כמו <span class="num">${n.feels}°</span></span>` : nothing}</div>
          <div class="wx-f">${n.wind != null ? html`<span>${hi('wind')}<b class="num">${n.wind}</b><span class="muted">${n.wind_unit === 'm/s' ? 'מ׳ לשנייה' : 'קמ״ש'}</span></span>` : nothing}${n.rain != null ? html`<span>${hi('drop')}<b class="num">${n.rain}%</b><span class="muted">סיכוי לגשם</span></span>` : nothing}</div></section>
        <section class="tile pane wx-h" aria-label="השעות הקרובות"><h2>השעות הקרובות</h2>${w.hours.length ? html`<div class="wx-row">${w.hours.slice(0, h.phone ? 4 : 6).map((x) => html`<span class="wxc"><span class="muted num">${x.at}</span>${hi(icon(x.condition))}<b class="num">${x.t}°</b></span>`)}</div>` : html`<p class="muted pb-none">אין תחזית לשעות הקרובות.</p>`}</section>
        <section class="tile pane wx-d" aria-label="הימים הקרובים"><h2>הימים הקרובים</h2>${days.length ? html`<div class="wx-days">${days.map((d) => html`<div class="wxd"><b class="clamp1">${d.date === today ? 'היום' : d.date === tom ? 'מחר' : DAY_NAME[weekdayIx(new Date(d.date + 'T12:00:00Z'))]}</b>${hi(icon(d.condition))}<span class="muted clamp1 wxtx">${TEXT[d.condition] ?? ''}</span><span class="hl2"><b class="num">${d.t}°</b>${d.lo != null ? html`<span class="muted num">${d.lo}°</span>` : nothing}</span></div>`)}</div>` : html`<p class="muted pb-none">אין תחזית לימים הקרובים.</p>`}</section></div>`;
  },
}));
