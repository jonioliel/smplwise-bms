/**
 * MAPPING-ASSIST-2330 slice 3 - "מתקדם": the ordered sentence rules behind the first question and the table (mockup v3 "מתקדם - הכללים,
 * במשפטים"). Each rule is a sentence - "השם מתחיל ב-…", "השם מסתיים ב-…", "השם מכיל…", "התווית היא…", "ביטוי רגולרי…" or "לפי טבלת
 * הסימונים" - with its building and a live counter; kinds mix freely; the order is the priority (drag the grip, or the arrow keys on it).
 * The first rule that matches with a building decides. A change that would have changed manual answers says how many (they stay).
 * Registers itself on <mapping-assistant>.
 */
import { html, nothing } from 'lit';
import { moveRule, ruleCounts, type Rule, type RuleKind } from '../api/mapping-engine';
import { MappingAssistant, POS_TEXT, RULE_LABEL } from './mapping-assistant';

export function renderRules(h: MappingAssistant) {
  const m = h.model();
  const st = h.st;
  const counts = ruleCounts(h.data.mapItems, st, h.refs);
  const rules = st.rules;
  const upd = (i: number, p: Partial<Rule>) => h.setState({ ...st, rules: rules.map((r, j) => (j === i ? { ...r, ...p } : r)) }, true);
  const move = (from: number, to: number) => h.setState({ ...st, rules: moveRule(rules, from, to) }, true);
  const toOpts = (r: Rule) => html`${r.kind === 'regex' ? html`<option value="" ?selected=${!r.to}>הקבוצה הראשונה, לפי הטבלה</option>` : r.to ? nothing : html`<option value="" selected>בחרו בניין</option>`}
    ${h.data.buildings.map((b) => html`<option value=${`b:${b.id}`} ?selected=${r.to?.t === 'b' && r.to.id === b.id}>${b.name}</option>`)}
    <option value="none" ?selected=${r.to?.t === 'none'}>לא משויך</option>`;
  const unresolved = m.sum.unassigned;
  return html`<div class="panel" style="flex:1 1 auto" data-ma-rules><h3><sw-icon name="filter" size=${16}></sw-icon>מתקדם · הכללים, במשפטים<span class="sp"></span><span class="ct">גרירה = מה נבדק קודם · אפשר לערבב סוגים</span></h3>
    <div class="scroll rules">
      ${rules.map((r, i) => html`<div class="sr ${r.on ? '' : 'off'} ${h.dragRule >= 0 && h.dragRule !== i ? 'dropzone' : ''}" data-ma-rule=${r.id} data-ma-rule-kind-now=${r.kind}
          @dragover=${(e: DragEvent) => { if (h.dragRule >= 0) e.preventDefault(); }} @drop=${(e: DragEvent) => { e.preventDefault(); if (h.dragRule >= 0) move(h.dragRule, i); h.dragRule = -1; }}>
        <button class="grip" draggable="true" data-ma-rule-grip aria-label=${`כלל ${i + 1}: גרירה או חיצים משנים את הסדר`} @dragstart=${(e: DragEvent) => { h.dragRule = i; e.dataTransfer?.setData('text/plain', r.id); }} @dragend=${() => (h.dragRule = -1)}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); move(i, i - 1); } if (e.key === 'ArrowDown' && i < rules.length - 1) { e.preventDefault(); move(i, i + 1); } }}><sw-icon name="grip" size=${16}></sw-icon></button>
        <span class="n">${i + 1}</span>
        <span class="sent">
          <select aria-label="סוג הכלל" data-ma-rule-kind @change=${(e: Event) => upd(i, { kind: (e.target as HTMLSelectElement).value as RuleKind })}>${(Object.keys(RULE_LABEL) as RuleKind[]).map((k) => html`<option value=${k} ?selected=${r.kind === k}>${RULE_LABEL[k]}</option>`)}</select>
          ${r.kind === 'table'
            ? html`<span class="k">${POS_TEXT[st.spec.position].title}, ${m.rows.length} סימונים</span>`
            : html`<input class="tx" data-ma-rule-value aria-label="הערך" maxlength="80" .value=${r.value} placeholder=${r.kind === 'regex' ? '^B(\\d)-' : 'למשל חניון'} @input=${(e: Event) => upd(i, { value: (e.target as HTMLInputElement).value })} />`}
        </span>
        ${r.kind === 'table' ? html`<span class="to k">← לפי הטבלה</span>` : html`<select class="to" aria-label="לאיזה בניין" data-ma-rule-to @change=${(e: Event) => upd(i, { to: h.parseTarget((e.target as HTMLSelectElement).value) })}>${toOpts(r)}</select>`}
        <span class="cnt" data-ma-rule-count>${counts[r.id]?.floors ?? 0} קומות, ${counts[r.id]?.areas ?? 0} אזורים</span>
        <span class="acts"><button class="ib" aria-label=${r.on ? 'השבת את הכלל' : 'הפעל את הכלל'} title=${r.on ? 'השבת' : 'הפעל'} aria-pressed=${String(r.on)} @click=${() => upd(i, { on: !r.on })}><sw-icon name=${r.on ? 'eye' : 'minus'} size=${16}></sw-icon></button>
          ${r.kind === 'table' && rules.filter((x) => x.kind === 'table').length === 1 ? nothing : html`<button class="ib" aria-label="מחק את הכלל" data-ma-rule-delete @click=${() => h.setState({ ...st, rules: rules.filter((_, j) => j !== i) }, true)}><sw-icon name="trash" size=${16}></sw-icon></button>`}</span>
      </div>`)}
      <div class="sr def"><span></span><span class="n">∅</span><span class="sent"><span class="k">כל שם אחר</span></span><span class="to k">← שאלה / לא משויך</span><span class="cnt">${unresolved.floors} קומות, ${unresolved.areas} אזורים</span><span></span></div>
      <div class="add"><sw-button size="sm" variant="ghost" icon="plus" data-ma-rule-add
        @click=${() => h.setState({ ...st, rules: [...rules, { id: `r${Date.now().toString(36)}${rules.length}`, kind: 'contains', value: '', to: null, on: true }] })}>הוסף כלל</sw-button>
        <span>מתחיל ב- / מסתיים ב- / מכיל / התווית היא / ביטוי רגולרי. הכלל הראשון שמתאים ויש לו בניין קובע.</span></div>
    </div></div>`;
}

MappingAssistant.rulesView = renderRules;
