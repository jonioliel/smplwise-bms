/**
 * MAPPING-ASSIST-2330 slice 2 - the assistant's exceptions step (mockup v3 step 2, answers 2A / 4A): only what the engine cannot decide, as
 * one plain question each with big buttons (the highlighted one = what the system would choose), the progress "נשארו N החלטות", "השאר את
 * כולם לא משויך לעכשיו", and the answered list with "שנה". A token question answers the table for every name with that mark (1A); any
 * other answer is a manual decision that beats every rule from then on. Registers itself on <mapping-assistant>.
 */
import { html, nothing } from 'lit';
import { answer, exceptionOrder, itemKey, leaveAllUnassigned, newBuildingName, targetKey, type Question, type Target } from '../api/mapping-engine';
import { MappingAssistant } from './mapping-assistant';
import { tr } from '../i18n/msg/media';

function questionText(h: MappingAssistant, q: Question): { name: string; where: string; ask: string } {
  const it = q.item;
  const c = q.conflict;
  const items = h.data.mapItems;
  const floor = it?.kind === 'area' && it.floorId ? items.find((x) => x.kind === 'floor' && x.id === it.floorId) : undefined;
  const where = it?.kind === 'floor' ? tr('קומה · {length} אזורים', { length: items.filter((x) => x.kind === 'area' && x.floorId === it.id).length }) : floor ? tr('בקומה "{name}"', { name: floor.name }) : tr('בלי קומה');
  switch (q.kind) {
    case 'unknown_token':
      return { name: `"${q.token}"`, where: q.count === 1 ? tr('{n} שם מתחיל בסימון הזה', { n: q.count }) : tr('{n} שמות מתחילים בסימון הזה', { n: q.count }), ask: tr('אין בניין "{token}". מה לעשות עם הסימון?', { token: String(q.token) }) };
    case 'floor':
      return { name: it!.name, where, ask: tr('השם אומר {byName}, אבל הקומה שלו בבניין {byFloor}. איפה הוא באמת?', { byName: h.bName(c.options[1]), byFloor: h.bName(c.options[0]) }) };
    case 'label':
      return { name: it!.name, where, ask: tr('השם אומר {byName}, התווית במערכת הבית אומרת {byLabel}. מי צודק?', { byName: h.bName(c.options[0]), byLabel: h.bName(c.options[1]) }) };
    case 'rules':
      return { name: it!.name, where, ask: tr('שני כללים לא מסכימים: {a} או {b}?', { a: h.bName(c.options[0]), b: h.bName(c.options[1]) }) };
    default:
      return { name: it!.name, where, ask: floor ? tr('בלי סימון בשם. לאיזה בניין?') : tr('בלי סימון בשם ובלי קומה. לאיזה בניין?') };
  }
}

function optionLabel(h: MappingAssistant, q: Question, t: Target, i: number): { t: string; s: string } {
  const why = q.kind === 'floor' ? (i === 0 ? tr('לפי הקומה') : tr('לפי השם')) : q.kind === 'label' ? (i === 0 ? tr('לפי השם') : tr('לפי התווית')) : q.kind === 'rules' ? tr('כלל {n}', { n: i + 1 }) : q.kind === 'no_mark' && t.t !== 'none' ? tr('לפי הקומה / התווית') : '';
  if (t.t === 'new') return { t: tr('כן, בניין חדש "{name}"', { name: t.name }), s: '' };
  if (t.t === 'none') return { t: tr('השאר לא משויך'), s: '' };
  return { t: h.bName(t), s: why };
}

function renderQuestion(h: MappingAssistant, q: Question) {
  const tx = questionText(h, q);
  const s = h.data.settings;
  let opts: Target[] = [...q.conflict.options];
  if (q.kind === 'unknown_token') {
    // 4A: the setting orders new / existing / unassigned; "existing" is the picker
    opts = exceptionOrder(s)
      .filter((o) => o !== 'existing')
      .map((o) => (o === 'new' ? ({ t: 'new', name: newBuildingName(q.token!) } as Target) : ({ t: 'none' } as Target)));
  }
  if (!opts.some((o) => o.t === 'none') && q.kind === 'no_mark') opts.push({ t: 'none' });
  const existingFirst = q.kind === 'unknown_token' && s.new_token === 'existing_first';
  const decide = (t: Target) => h.setState(answer(h.st, q, t));
  const picker = html`<select data-ma-pick aria-label=${tr('בניין קיים')} @change=${(e: Event) => { const t = h.parseTarget((e.target as HTMLSelectElement).value); if (t) decide(t); }}>
    <option value="" selected>${q.kind === 'unknown_token' ? tr('שייך לבניין קיים…') : tr('בניין אחר…')}</option>
    ${h.data.buildings.map((b) => html`<option value=${`b:${b.id}`}>${b.name}</option>`)}</select>`;
  const btns = opts.map((o, i) => {
    const l = optionLabel(h, q, o, i);
    return html`<button type="button" class="press ${i === 0 && !existingFirst ? 'rec' : ''}" data-ma-answer=${targetKey(o)} @click=${() => decide(o)}>${l.t}${l.s ? html`<small>${l.s}</small>` : nothing}</button>`;
  });
  return html`<div class="dec" data-ma-question=${q.key} data-ma-kind=${q.kind}>
    <div class="nm2"><sw-icon name=${q.item?.kind === 'floor' || q.kind === 'unknown_token' ? 'floor' : 'warning'} size=${16}></sw-icon><bdi>${tx.name}</bdi><small>${tx.where}</small></div>
    <div class="ask">${tx.ask}</div>
    <div class="big">${existingFirst ? html`${picker}${btns}` : html`${btns}${picker}`}</div>
  </div>`;
}

export function renderDecide(h: MappingAssistant) {
  const m = h.model();
  const st = h.st;
  const decided = Object.entries(st.decisions);
  const tokenAnswers = Object.entries(st.tokens).filter(([t]) => m.rows.find((r) => r.token === t)?.own);
  const done = decided.length + tokenAnswers.length;
  const total = m.qs.length + done;
  const pct = total ? Math.round((100 * done) / total) : 100;
  const nameOf = (k: string) => h.data.mapItems.find((x) => itemKey(x) === k)?.name ?? k;
  return html`<div class="prog" data-ma-progress><b data-ma-left>${m.qs.length ? (m.qs.length === 1 ? tr('נשארו {n} החלטה', { n: m.qs.length }) : tr('נשארו {n} החלטות', { n: m.qs.length })) : tr('אין החלטות פתוחות')}</b>
      <span class="bar" role="progressbar" aria-label=${tr('ההחלטות')} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}><i style=${`inline-size:${pct}%`}></i></span>
      <span class="ct">${tr('{done} הוחלטו · {total} בסך הכל', { done, total })}</span>
      ${m.qs.length ? html`<sw-button size="sm" variant="ghost" data-ma-all-none @click=${() => h.setState(leaveAllUnassigned(st, m.qs))}>${tr('השאר את כולם "לא משויך" לעכשיו')}</sw-button>` : nothing}</div>
    <div class="two">
      <div class="panel"><div class="scroll">${m.qs.length
        ? html`<div class="decs" data-ma-questions>${m.qs.map((q) => renderQuestion(h, q))}</div>`
        : html`<div class="empty" data-ma-no-questions><sw-icon name="check" size=${28}></sw-icon><b>${tr('כל הפריטים במקום')}</b><span>${tr('אפשר להמשיך לסיכום.')}</span></div>`}</div></div>
      <div class="panel side"><h3><sw-icon name="check" size=${16}></sw-icon>${tr('הוחלט')}</h3><div class="scroll dones" data-ma-dones>
        ${decided.map(([k, t]) => html`<div class="done"><sw-icon name="check" size=${14}></sw-icon><b><bdi>${nameOf(k)}</bdi></b><span>← ${h.bName(t)}</span><span class="sp"></span>
          <button type="button" class="link" data-ma-undo=${k} @click=${() => { const d = { ...st.decisions }; delete d[k]; h.setState({ ...st, decisions: d }); }}>${tr('שנה')}</button></div>`)}
        ${tokenAnswers.map(([t, to]) => html`<div class="done"><sw-icon name="check" size=${14}></sw-icon><b>"${t}"</b><span>← ${h.bName(to)}</span><span class="sp"></span>
          <button type="button" class="link" data-ma-undo-token=${t} @click=${() => { const k = { ...st.tokens }; delete k[t]; h.setState({ ...st, tokens: k }, true); }}>${tr('שנה')}</button></div>`)}
        ${!done ? html`<div class="hint">${tr('התשובות שלכם יופיעו כאן. החלטה ידנית גוברת על כל כלל, גם בעתיד.')}</div>` : nothing}
      </div></div>
    </div>`;
}

MappingAssistant.decideView = renderDecide;
