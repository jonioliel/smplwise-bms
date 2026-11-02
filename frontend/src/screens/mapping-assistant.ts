import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import { describeError } from '../api/client';
import {
  buildPlan, detect, exceptionOrder, levelQuestions, manualImpact, mergeTokens, newBuildingName, POSITIONS, questions,
  resolve, SEP_CHIPS, suggestSpec, summarize, tableRows, TABLE_RULE, tokenize,
  type BuildingRef, type Detection, type LevelAnswer, type LevelQuestion, type MappingState, type MarkSpec, type Position, type Question, type Res,
  type RuleKind, type Summary, type TableRow, type Target, type TokenKind,
} from '../api/mapping-engine';
import { applyMapping, saveState, setMultiBuilding, type MappingData } from '../api/mapping';

/**
 * MAPPING-ASSIST-2330 `<mapping-assistant>` - the approved round-10 mockup v3: one question first ("איך הבניין מסומן בשמות שלכם?"), the
 * table "סימון ← בניין", only the exceptions as plain questions, the summary with "החל" (a version, audited, reversible, no write to the home
 * system), and "מתקדם" - the ordered sentence rules behind it. Everything on screen is computed live by api/mapping-engine.ts from the real
 * names. Full-screen sheet: the lists scroll inside their own panels, the page itself never scrolls (owner rule 24.10).
 * Fires `close` and `applied` ({ version, multi }).
 */
type Step = 'mark' | 'table' | 'decide' | 'levels' | 'summary' | 'done';
const STEPS: { id: Exclude<Step, 'done'>; label: string }[] = [
  { id: 'mark', label: 'צורת הסימון' },
  { id: 'table', label: 'סימון ← בניין' },
  { id: 'decide', label: 'החלטות' },
  // MAPPING-IMPROVE-2351: only when a floor has no level anywhere (none in the home system, none in its name)
  { id: 'levels', label: 'קומות ללא מפלס' },
  { id: 'summary', label: 'סיכום' },
];
/** The level picker's range (an answer outside it is still listed). */
const LEVEL_PICK = Array.from({ length: 66 }, (_x, i) => i - 5);

export const POS_TEXT: Record<Position | 'advanced', { title: string; ex: TemplateResult[] }> = {
  start: { title: 'בתחילת השם', ex: [html`<b>א</b> · לובי`, html`<b>1</b> · לובי`, html`<b>B2</b>-לובי`] },
  end: { title: 'בסוף השם', ex: [html`לובי · <b>א</b>`, html`חדר מכונות - <b>2</b>`] },
  label: { title: 'בתווית', ex: [html`לובי <i>תווית</i> <b>בניין א</b>`, html`חניון <i>תווית</i> <b>משותף</b>`] },
  word: { title: 'מילה בתוך השם', ex: [html`לובי בניין <b>צפון</b>`, html`מחסן מגדל <b>2</b>`] },
  advanced: { title: 'שילוב / מתקדם', ex: [html`התחלה לרוב השמות`, html`תווית לחניון`] },
};
const SEP_LABEL: Record<string, string> = { '·': '" · "', '-': '"-"', ':': '":"', ' ': 'רווח' };
const KIND_LABEL: Record<TokenKind, string> = { letter: 'אות', number: 'מספר', word: 'מילה', any: 'כל דבר עד המפריד' };
export const RULE_LABEL: Record<RuleKind, string> = { table: 'לפי טבלת הסימונים', starts: 'השם מתחיל ב-', ends: 'השם מסתיים ב-', contains: 'השם מכיל', label: 'התווית היא', regex: 'ביטוי רגולרי' };

@customElement('mapping-assistant')
export class MappingAssistant extends LitElement {
  @property({ attribute: false }) data!: MappingData;
  /** Where to open (the settings page's "מתקדם" opens on the first question with the rules shown). */
  @property() start: Step = 'mark';
  @property({ type: Boolean }) advancedOpen = false;
  /** Slice 2 (screens/mapping-decide.ts) and slice 3 (screens/mapping-rules.ts) register their views here; absent = the step / option is not offered. */
  static decideView: ((h: MappingAssistant) => unknown) | null = null;
  static rulesView: ((h: MappingAssistant) => unknown) | null = null;
  static get hasDecisions(): boolean {
    return !!MappingAssistant.decideView;
  }
  get withDecisions(): boolean {
    return !!MappingAssistant.decideView;
  }
  @state() private step: Step = 'mark';
  @state() st!: MappingState;
  @state() private busy = false;
  @state() private error = '';
  @state() private notice = '';
  @state() private applied: { version: number; created: number } | null = null;
  @state() private multiOn = false;
  @state() private customSep = '';
  @state() private addTok = '';
  @state() dragTok = '';
  @state() dragRule = -1;
  @state() pickFor = '';
  private revision = 0;
  private seeded = false;
  private sugg: ReturnType<typeof suggestSpec> | null = null;
  private memo: { st: MappingState; det: Detection; rows: TableRow[]; res: Map<string, Res>; qs: Question[]; sum: Summary; lq: LevelQuestion[] } | null = null;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--sw-z-modal, 1000);
      display: grid;
      place-items: center;
      background: var(--sw-overlay);
      padding: max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px));
      color: var(--sw-text);
      font-family: var(--sw-font);
    }
    .sheet {
      inline-size: min(1360px, 100%);
      block-size: min(860px, 100%);
      background: var(--sw-bg, var(--sw-surface));
      border-radius: var(--sw-r-xl);
      box-shadow: var(--sw-shadow-3);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      overflow: hidden;
    }
    @starting-style {
      .sheet {
        opacity: 0;
        transform: scale(0.98) translateY(8px);
      }
    }
    .sheet {
      transition: opacity 220ms var(--sw-ease-out, ease-out), transform 220ms var(--sw-ease-out, ease-out);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 18px 22px 12px;
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .num {
      flex: none;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
    }
    .ttl {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      line-height: 1.25;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      text-wrap: balance;
    }
    .q {
      margin-block-start: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      max-inline-size: 90ch;
    }
    .dots {
      display: flex;
      gap: 6px;
      align-items: center;
      flex: none;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dots i {
      inline-size: 22px;
      block-size: 4px;
      border-radius: 2px;
      background: var(--sw-border);
    }
    .dots i.on {
      background: var(--sw-accent);
    }
    .dots i.past {
      background: color-mix(in srgb, var(--sw-accent) 45%, transparent);
    }
    .x {
      flex: none;
    }
    main {
      min-block-size: 0;
      padding: 14px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }
    footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 22px;
      border-block-start: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    footer .ln {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-inline-size: 0;
    }
    .sp {
      flex: 1 1 auto;
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
    }
    .notice {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    button {
      font: inherit;
      color: inherit;
    }
    .press {
      transition: transform 140ms var(--sw-ease-out, ease-out), background-color 140ms ease;
    }
    .press:active {
      transform: scale(0.98);
    }
    :focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: var(--sw-focus-offset, 2px);
    }

    /* ---------- step: the mark ---------- */
    .opts {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      flex: none;
    }
    .opt {
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 8px;
      text-align: start;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
      min-inline-size: 0;
    }
    .opt[aria-checked='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 1px var(--sw-accent), var(--sw-shadow-1);
    }
    .opt h2 {
      margin: 0;
      font-size: var(--sw-fs-md);
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--sw-heading);
    }
    .rd {
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong, var(--sw-border));
      flex: none;
    }
    .opt[aria-checked='true'] .rd {
      border-color: var(--sw-accent);
      background: radial-gradient(circle, var(--sw-accent) 0 4px, transparent 5px);
    }
    .ex {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      align-content: flex-start;
    }
    .ex span {
      padding: 2px 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      white-space: nowrap;
    }
    .ex b {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .ex i {
      font-style: normal;
      color: var(--sw-text-3);
    }
    .fit {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .fit b {
      color: var(--sw-heading);
    }
    .detected {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-accent-soft);
      font-size: var(--sw-fs-sm);
      flex: none;
    }
    .detected sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .detected span {
      flex: 1 1 320px;
      min-inline-size: 0;
    }
    .ctrls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      align-items: center;
      flex: none;
    }
    .grp {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-sm);
    }
    .grp > b {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .ch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 34px;
      padding: 0 12px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .ch[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: transparent;
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-semibold);
    }
    .ch small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    input.tx,
    select {
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      min-block-size: 34px;
      padding: 0 10px;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    input.tx.short {
      inline-size: 6em;
    }
    .lv {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 280px) auto;
      gap: 12px;
      align-items: center;
      padding: 10px 14px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
    }
    .lv .t {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .lv .t small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .lv .tag.wn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .lv .tag.ok {
      background: var(--sw-success-soft, var(--sw-surface-2));
      color: var(--sw-success-text, var(--sw-text-2));
    }
    @media (max-width: 760px) {
      .lv {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .lv select {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    }
    .live {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 12px;
      min-block-size: 0;
      flex: 1 1 auto;
    }
    .panel {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .panel > h3 {
      margin: 0;
      padding: 10px 14px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      border-block-end: 1px solid var(--sw-border);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .panel > h3 .sp + * {
      font-weight: var(--sw-fw-regular);
    }
    .scroll {
      overflow: auto;
      overscroll-behavior: contain;
      min-block-size: 0;
      flex: 1 1 auto;
      scrollbar-width: thin;
    }
    .nm {
      display: flex;
      gap: 8px;
      align-items: baseline;
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      min-inline-size: 0;
    }
    .nm .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nm mark {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-bold);
      border-radius: var(--sw-r-2xs);
      padding: 0 4px;
    }
    .nm.no mark {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .nm small {
      flex: none;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 8px;
      padding: 10px;
      align-content: start;
    }
    .tokc {
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: 8px 10px;
      display: grid;
      gap: 6px;
      min-inline-size: 0;
    }
    .tokc .th {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .g {
      flex: none;
      min-inline-size: 30px;
      block-size: 30px;
      padding: 0 6px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      max-inline-size: 9em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .g.sh {
      background: var(--sw-shared-soft);
      color: var(--sw-shared-text);
      box-shadow: none;
    }
    .g.un {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      box-shadow: none;
    }
    .ct {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .arr {
      margin-inline-start: auto;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-inline-size: 0;
    }
    .samp {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    .samp span {
      padding: 1px 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      max-inline-size: 16em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ---------- step: the table ---------- */
    .two {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 12px;
      min-block-size: 0;
      flex: 1 1 auto;
    }
    .tk {
      display: grid;
      grid-template-columns: 24px minmax(90px, 0.6fr) minmax(170px, 1fr) minmax(110px, 0.6fr) minmax(0, 1.6fr);
      gap: 10px;
      align-items: center;
      padding: 8px 14px 8px 10px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .tk.hdr {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding-block: 6px;
      position: sticky;
      inset-block-start: 0;
      background: var(--sw-surface);
      z-index: 1;
    }
    .tk.dropzone {
      background: var(--sw-accent-soft);
    }
    .tk .tok {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      min-inline-size: 0;
    }
    .tk .tok small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tk .c b {
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
    }
    .tk .c small {
      display: block;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      white-space: nowrap;
      inline-size: fit-content;
    }
    .tag.m {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .tag.new {
      background: var(--sw-product-success-soft, var(--sw-accent-soft));
      color: var(--sw-heading);
    }
    .grip {
      cursor: grab;
      color: var(--sw-text-3);
      display: grid;
      place-items: center;
      background: none;
      border: 0;
      padding: 0;
      inline-size: 24px;
      block-size: 30px;
    }
    .add {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      padding: 10px 14px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .bl {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 9px 14px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .bl .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
    }
    .bl .t b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sw-heading);
    }
    .bl .t span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .bl .toks {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
      max-inline-size: 40%;
    }
    .hint {
      padding: 10px 14px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      line-height: 1.5;
    }

    /* ---------- step: decisions ---------- */
    .prog {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      flex: none;
      font-size: var(--sw-fs-sm);
    }
    .prog b {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      flex: 1 1 160px;
      block-size: 8px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-2);
      overflow: hidden;
      max-inline-size: 420px;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      border-radius: inherit;
      transition: inline-size 240ms var(--sw-ease-out, ease-out);
    }
    .decs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 10px;
      padding: 10px;
      align-content: start;
    }
    .dec {
      display: grid;
      gap: 8px;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      min-inline-size: 0;
    }
    .dec .nm2 {
      display: flex;
      gap: 8px;
      align-items: baseline;
      flex-wrap: wrap;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .dec .nm2 small {
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dec .ask {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .big {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .big button {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      min-block-size: 48px;
      padding: 6px 16px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      text-align: start;
      max-inline-size: 100%;
    }
    .big button small {
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .big button.rec {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .big button.rec small {
      color: inherit;
      opacity: 0.85;
    }
    .big select {
      min-block-size: 48px;
    }
    .dones {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
    }
    .done {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .done sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
      flex: none;
    }
    .done b {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .done span {
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .link {
      background: none;
      border: 0;
      color: var(--sw-accent-text, var(--sw-accent));
      cursor: pointer;
      padding: 0 4px;
      font-size: var(--sw-fs-xs);
      min-block-size: 28px;
    }
    .empty {
      display: grid;
      place-items: center;
      gap: 8px;
      text-align: center;
      padding: 30px;
      color: var(--sw-text-2);
    }
    .empty sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
    }

    /* ---------- step: summary ---------- */
    .sum {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
    }
    .srow {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      min-inline-size: 0;
    }
    .srow .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .srow .t b {
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .srow .t span {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .srow .t em {
      font-style: normal;
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .st {
      flex: none;
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .st.wn {
      color: var(--sw-warning-text);
    }
    .applybox {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      padding: 14px 16px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-accent-soft);
      flex: none;
    }
    .applybox .t {
      flex: 1 1 360px;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
    }
    .applybox .t b {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
    }
    .applybox ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      color: var(--sw-text-2);
    }
    .applybox li {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .donebox {
      display: grid;
      gap: 14px;
      justify-items: center;
      text-align: center;
      padding: 30px 16px;
      align-content: center;
      flex: 1 1 auto;
    }
    .donebox h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading);
    }
    .donebox p {
      margin: 0;
      color: var(--sw-text-2);
      max-inline-size: 60ch;
    }
    .badge-ok {
      inline-size: 56px;
      block-size: 56px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .offer {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      padding: 14px 18px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      max-inline-size: 720px;
    }

    /* ---------- advanced ---------- */
    .rules {
      display: flex;
      flex-direction: column;
    }
    .sr {
      display: grid;
      grid-template-columns: 24px 26px minmax(0, 1.6fr) minmax(150px, 0.8fr) minmax(90px, auto) auto;
      gap: 8px;
      align-items: center;
      padding: 7px 12px 7px 8px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
    }
    .sr.dropzone {
      background: var(--sw-accent-soft);
    }
    .sr.off {
      opacity: 0.55;
    }
    .sr .n {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .sr .sent {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .sr .sent .k {
      color: var(--sw-text-2);
    }
    .sr .cnt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .sr .acts {
      display: flex;
      gap: 2px;
    }
    .ib {
      inline-size: 32px;
      block-size: 32px;
      display: grid;
      place-items: center;
      border-radius: var(--sw-r-md);
      background: none;
      border: 0;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .ib:hover {
      background: var(--sw-surface-2);
    }
    .sr.def {
      color: var(--sw-text-3);
    }

    /* ---------- tablet / phone ---------- */
    @media (max-width: 900px) {
      .opts {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 1180px) {
      .two {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
      }
      .two .side .scroll {
        max-block-size: 150px;
      }
      .tk {
        grid-template-columns: 24px minmax(80px, 0.6fr) minmax(160px, 1fr) minmax(100px, 0.6fr) minmax(0, 1fr);
      }
    }
    @media (max-width: 1180px) and (max-height: 820px) {
      .opt .ex {
        display: none;
      }
    }
    @media (max-width: 760px) {
      :host {
        padding: 0;
      }
      .sheet {
        border-radius: 0;
        block-size: 100%;
      }
      header {
        padding: max(12px, env(safe-area-inset-top, 0px)) 14px 10px;
        gap: 10px;
      }
      h1 {
        font-size: var(--sw-fs-lg);
      }
      .num {
        inline-size: 30px;
        block-size: 30px;
      }
      .dots span {
        display: none;
      }
      main {
        padding: 10px 14px;
        gap: 10px;
      }
      footer {
        padding: 10px 14px max(10px, env(safe-area-inset-bottom, 0px));
      }
      footer .ln {
        display: none;
      }
      .opts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .q {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .detected .more {
        display: none;
      }
      .detected {
        padding: 8px 12px;
      }
      .detected > sw-icon {
        display: none;
      }
      .opt {
        grid-template-rows: auto auto;
        gap: 2px;
        padding: 8px 10px;
      }
      .opt .ex {
        display: none;
      }
      .opt h2 {
        font-size: var(--sw-fs-sm);
      }
      .ctrls {
        gap: 6px;
      }
      .ch {
        min-block-size: 32px;
        padding: 0 10px;
      }
      .live {
        grid-template-columns: minmax(0, 1fr);
      }
      .live .names {
        display: none;
      }
      .groups {
        grid-template-columns: minmax(0, 1fr);
      }
      .tk {
        grid-template-columns: 24px minmax(0, 1fr) auto;
        grid-template-areas: 'g t c' 'g s s';
        row-gap: 6px;
      }
      .tk > .grip {
        grid-area: g;
      }
      .tk > .tok {
        grid-area: t;
      }
      .tk > .c {
        grid-area: c;
        text-align: end;
      }
      .tk > select,
      .tk > .selc {
        grid-area: s;
      }
      .tk > .samp {
        display: none;
      }
      .tk.hdr {
        display: none;
      }
      .two .side {
        display: none;
      }
      .decs {
        grid-template-columns: minmax(0, 1fr);
        padding: 6px;
      }
      .sr {
        grid-template-columns: 24px minmax(0, 1fr) auto;
        grid-template-areas: 'g s a' 'g t c';
      }
      .sr > .grip {
        grid-area: g;
      }
      .sr > .n {
        display: none;
      }
      .sr > .sent {
        grid-area: s;
      }
      .sr > .to {
        grid-area: t;
      }
      .sr > .cnt {
        grid-area: c;
      }
      .sr > .acts {
        grid-area: a;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sheet,
      .press,
      .bar i {
        transition: none;
      }
    }
  `;

  // ------------------------------------------------------------------------------------------------------------------------- lifecycle

  protected willUpdate() {
    if (this.data && !this.seeded) {
      this.seeded = true;
      this.revision = this.data.revision;
      this.multiOn = this.data.multi_building;
      this.sugg = suggestSpec(this.data.mapItems);
      this.st = this.data.state ? this.data.parsed : { ...this.data.parsed, spec: { ...this.sugg.spec } };
      this.step = this.start;
      if (this.advancedOpen) this.st = { ...this.st, advanced: true };
    }
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.busy) this.close();
  };

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------------------------------------------------------------- model

  get refs(): BuildingRef[] {
    return this.data.buildings.map((b) => ({ id: b.id, name: b.name, shared: b.is_shared }));
  }

  model() {
    if (this.memo && this.memo.st === this.st) return this.memo;
    const items = this.data.mapItems;
    const det = detect(items, this.st.spec);
    const rows = tableRows(det, this.st, this.refs);
    const res = resolve(items, this.st, { buildings: this.refs, settings: this.data.settings });
    const qs = questions(items, res);
    const sum = summarize(items, res, this.refs, rows);
    const lq = levelQuestions(items, res, this.refs, this.data.ourFloors, this.data.links, this.st.levels);
    this.memo = { st: this.st, det, rows, res, qs, sum, lq };
    return this.memo;
  }

  /** Every change of the rules or the table: the manual answers it would have changed are counted (they stay - manual wins). */
  setState(next: MappingState, ruleChange = false) {
    if (ruleChange && Object.keys(next.decisions).length) {
      const n = manualImpact(this.data.mapItems, this.st, next, { buildings: this.refs, settings: this.data.settings });
      this.notice = n ? `השינוי היה משנה ${n} ${n === 1 ? 'החלטה ידנית' : 'החלטות ידניות'} - ${n === 1 ? 'היא נשארת' : 'הן נשארות'} כפי שהחלטתם.` : '';
    }
    this.st = next;
  }

  private setSpec(p: Partial<MarkSpec>) {
    this.setState({ ...this.st, spec: { ...this.st.spec, ...p } }, true);
  }

  bName(t: Target | null | undefined): string {
    if (!t) return 'לא נבחר';
    if (t.t === 'none') return 'לא משויך';
    if (t.t === 'new') return t.name;
    return this.data.buildings.find((b) => b.id === t.id)?.name ?? 'בניין שנמחק';
  }

  isShared(t: Target | null | undefined): boolean {
    return !!t && t.t === 'b' && !!this.data.buildings.find((b) => b.id === t.id)?.is_shared;
  }

  private async persist() {
    try {
      const r = await saveState(this.data.site.id, this.st, this.revision);
      this.revision = r.revision;
    } catch (err) {
      this.error = describeError(err);
      throw err;
    }
  }

  private async go(step: Step) {
    this.error = '';
    this.notice = '';
    try {
      if (!this.busy) await this.persist(); // the draft is kept on the server between steps (nothing is applied)
    } catch {
      return;
    }
    if (step === 'decide' && !this.withDecisions) step = this.afterDecide;
    if (step === 'levels' && !this.model().lq.length) step = 'summary';
    this.step = step;
  }

  /** After the decisions: "קומות ללא מפלס" when a floor waits for its level, else the summary. */
  private get afterDecide(): Step {
    return this.model().lq.length ? 'levels' : 'summary';
  }

  /** Back from the summary / the levels step: the step before it that is shown. */
  private backFrom(step: 'levels' | 'summary'): { to: Step; label: string } {
    const m = this.model();
    if (step === 'summary' && m.lq.length) return { to: 'levels', label: 'קומות ללא מפלס' };
    return this.withDecisions && (m.qs.length || Object.keys(this.st.decisions).length) ? { to: 'decide', label: 'ההחלטות' } : { to: 'table', label: 'הטבלה' };
  }

  /** One "קומות ללא מפלס" answer (undefined = unanswered again). */
  setLevel(id: string, a: LevelAnswer | undefined) {
    const levels = { ...this.st.levels };
    if (a) levels[id] = a;
    else delete levels[id];
    this.setState({ ...this.st, levels });
  }

  /** "דלג": every unanswered floor keeps the behaviour before - a new floor of level 0. */
  skipLevels() {
    const levels = { ...this.st.levels };
    for (const q of this.model().lq) if (!q.answer) levels[q.id] = { t: 'skip' };
    this.setState({ ...this.st, levels });
  }

  private async apply() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const m = this.model();
      const plan = buildPlan(this.data.mapItems, m.res, this.refs, this.data.ourFloors, this.data.links, this.st.levels);
      const r = await applyMapping(this.data.site.id, {
        state: this.st,
        revision: this.revision,
        plan,
        kind: 'apply',
        summary: { open: m.sum.open, manual: m.sum.manual, by_floor: m.sum.byFloor, total: m.sum.total, buildings: m.sum.buildings.filter((b) => b.floors + b.areas > 0).length },
      });
      this.revision = r.revision;
      // a "בניין חדש" now exists: the stored table / rules / answers name it by id from here on (the next apply must not create it again)
      if (r.created.buildings.length) {
        const ids = new Map(r.created.buildings.map((b) => [b.name, b.id]));
        const fix = (t: Target | null): Target | null => (t && t.t === 'new' && ids.has(t.name) ? { t: 'b', id: ids.get(t.name)! } : t);
        const tokens = Object.fromEntries(Object.entries(this.st.tokens).map(([k, t]) => [k, fix(t)!]));
        const decisions = Object.fromEntries(Object.entries(this.st.decisions).map(([k, t]) => [k, fix(t)!]));
        this.st = { ...this.st, tokens, decisions, rules: this.st.rules.map((x) => ({ ...x, to: fix(x.to) })) };
        try {
          this.revision = (await saveState(this.data.site.id, this.st, this.revision)).revision;
        } catch {
          /* the version is applied; the table keeps "new" names until the next save */
        }
      }
      this.applied = { version: r.version, created: r.created.buildings.length };
      this.step = 'done';
      this.dispatchEvent(new CustomEvent('applied', { detail: { version: r.version, multi: this.multiOn }, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async enableMulti() {
    this.busy = true;
    try {
      await setMultiBuilding(true);
      this.multiOn = true;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------- render

  render() {
    if (!this.data || !this.st) return nothing;
    const lqn = this.model().lq.length;
    const steps = STEPS.filter((s) => (s.id !== 'decide' || this.withDecisions) && (s.id !== 'levels' || lqn));
    const idx = steps.findIndex((s) => s.id === this.step);
    const head = this.headText();
    return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ma-h" data-mapping-assistant data-step=${this.step}>
      <header>
        <span class="num" aria-hidden="true">${this.step === 'done' ? html`<sw-icon name="check" size=${18}></sw-icon>` : this.step === 'mark' ? '?' : idx}</span>
        <div class="ttl">
          <h1 id="ma-h">${head.title}</h1>
          <div class="q">${head.q}</div>
        </div>
        ${this.step !== 'done'
          ? html`<div class="dots" aria-label=${`שלב ${idx + 1} מתוך ${steps.length}`}>${steps.map((_s, i) => html`<i class=${i < idx ? 'past' : i === idx ? 'on' : ''}></i>`)}<span>${steps[idx]?.label}</span></div>`
          : nothing}
        <sw-button class="x" variant="ghost" icon="close" iconOnly label="סגור" data-ma-close @click=${() => this.close()}></sw-button>
      </header>
      <main>
        ${this.notice ? html`<div class="notice" role="status" data-ma-manual-impact><sw-icon name="info" size=${15}></sw-icon>${this.notice}</div>` : nothing}
        ${this.step === 'mark' ? this.renderMark() : this.step === 'table' ? this.renderTable() : this.step === 'decide' ? MappingAssistant.decideView?.(this) : this.step === 'levels' ? this.renderLevels() : this.step === 'summary' ? this.renderSummary() : this.renderDone()}
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </main>
      ${this.renderFoot()}
    </div>`;
  }

  private headText(): { title: string; q: string } {
    const m = this.model();
    const d = m.det;
    switch (this.step) {
      case 'mark':
        return { title: 'איך הבניין מסומן בשמות שלכם?', q: `המערכת בדקה את כל ${d.total} השמות במערכת הבית וסימנה את מה שנראה הכי סביר. אפשר לבחור אחרת - התצוגה למטה מתעדכנת מיד.` };
      case 'table':
        return { title: 'סימון בשם ← בניין', q: `${m.rows.length} סימונים נמצאו. לכל אחד - איזה בניין? שני סימונים לאותו בניין מתאחדים (בחירה או גרירה), סימון בלי בניין - בניין חדש, קיים או "לא משויך".` };
      case 'decide':
        return { title: 'מה צריך את ההחלטה שלכם', q: `רק החריגים. כל השאר (${d.total - m.qs.reduce((n, q) => n + q.count, 0)} פריטים) כבר במקום. הכפתור המודגש הוא מה שהמערכת הייתה בוחרת.` };
      case 'levels': {
        const n = m.lq.length;
        return { title: 'קומות ללא מפלס', q: `${n === 1 ? 'קומה אחת' : `${n} קומות`} במערכת הבית בלי מפלס ובלי מספר בשם. באיזה מפלס ${n === 1 ? 'היא' : 'כל אחת'} - או "זהה לקומה קיימת"? דילוג = קומה חדשה במפלס 0, כמו היום.` };
      }
      case 'summary':
        return { title: 'סיכום ואישור', q: 'מה יקרה כשתלחצו "החל". אפשר לחזור ולשנות אחר כך.' };
      default:
        return { title: 'המיפוי הוחל', q: '' };
    }
  }

  private renderFoot() {
    const m = this.model();
    const open = m.qs.length;
    const back = (to: Step, label: string) => html`<sw-button variant="secondary" icon="chevron" data-ma-back @click=${() => void this.go(to)}>${label}</sw-button>`;
    switch (this.step) {
      case 'mark':
        return html`<footer><sw-button variant="ghost" @click=${() => this.close()}>ביטול</sw-button><span class="ln">שום דבר לא משתנה עד "החל" בסיכום</span><span class="sp"></span>
          <sw-button variant="primary" data-ma-next ?disabled=${this.busy} @click=${() => void this.go('table')}>נכון, המשך</sw-button></footer>`;
      case 'table':
        return html`<footer>${back('mark', 'צורת הסימון')}<span class="ln">שום דבר לא משתנה עד "החל" בסיכום</span><span class="sp"></span>
          <sw-button variant="primary" data-ma-next @click=${() => void this.go(this.withDecisions && open ? 'decide' : this.afterDecide)}>${this.withDecisions && open ? `המשך - ${open} ${open === 1 ? 'החלטה מחכה' : 'החלטות מחכות'}` : m.lq.length ? `המשך - ${m.lq.length === 1 ? 'קומה אחת ללא מפלס' : `${m.lq.length} קומות ללא מפלס`}` : 'המשך לסיכום'}</sw-button></footer>`;
      case 'decide':
        return html`<footer>${back('table', 'הטבלה')}<span class="ln">אפשר להמשיך גם עם החלטות פתוחות - הפריטים יישארו כמו שהם, עם אזהרה</span><span class="sp"></span>
          <sw-button variant="primary" data-ma-next @click=${() => void this.go(this.afterDecide)}>${m.lq.length ? 'המשך - קומות ללא מפלס' : 'המשך לסיכום'}</sw-button></footer>`;
      case 'levels': {
        const b = this.backFrom('levels');
        const left = m.lq.filter((q) => !q.answer).length;
        return html`<footer>${back(b.to, b.label)}<span class="ln">${left ? `${left} ${left === 1 ? 'קומה מחכה' : 'קומות מחכות'} למפלס` : 'לכל הקומות יש מפלס'}</span><span class="sp"></span>
          ${left ? html`<sw-button variant="secondary" data-ma-levels-skip @click=${() => { this.skipLevels(); void this.go('summary'); }}>${left === 1 ? 'דלג - מפלס 0' : 'דלג - מפלס 0 לכולן'}</sw-button>` : nothing}
          <sw-button variant="primary" data-ma-next ?disabled=${left > 0} @click=${() => void this.go('summary')}>המשך לסיכום</sw-button></footer>`;
      }
      case 'summary': {
        const b = this.backFrom('summary');
        return html`<footer>${back(b.to, b.label)}<span class="ln">${m.sum.manual} החלטות שלכם · ${m.sum.byFloor} לפי הקומה · השאר לפי הסימון</span><span class="sp"></span></footer>`;
      }
      default:
        return html`<footer><span class="sp"></span><sw-button variant="primary" data-ma-finish @click=${() => this.close()}>סיום</sw-button></footer>`;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------- the mark

  private renderMark() {
    const m = this.model();
    const d = m.det;
    const sug = this.sugg!;
    const sel: Position | 'advanced' = this.st.advanced ? 'advanced' : this.st.spec.position;
    const pick = (p: Position | 'advanced') => {
      if (p === 'advanced') this.setState({ ...this.st, advanced: true, rules: this.st.rules.length ? this.st.rules : [{ ...TABLE_RULE }] }, true);
      else this.setState({ ...this.st, advanced: false, spec: { ...this.st.spec, position: p, seps: p === 'end' || p === 'start' ? this.st.spec.seps : this.st.spec.seps } }, true);
    };
    const fit = (p: Position | 'advanced') => {
      if (p === 'advanced') return html`רשימת כללים בשפה פשוטה`;
      const pct = p === this.st.spec.position ? d.pct : sug.alternatives[p];
      return html`מסביר <b>${pct}%</b> מהשמות`;
    };
    const opts = html`<div class="opts" role="radiogroup" aria-label="איפה הסימון">
      ${[...POSITIONS, ...(MappingAssistant.rulesView ? ['advanced' as const] : [])].map((p) => html`<button type="button" role="radio" class="opt press" data-ma-pos=${p} aria-checked=${String(sel === p)} @click=${() => pick(p)}>
          <h2><span class="rd" aria-hidden="true"></span>${POS_TEXT[p].title}</h2>
          <div class="ex">${POS_TEXT[p].ex.map((e) => html`<span>${e}</span>`)}</div>
          <div class="fit">${fit(p)}</div>
        </button>`)}
    </div>`;
    const seps = Object.entries(d.sepUse).filter(([s]) => s !== '·');
    const detected = html`<div class="detected" data-ma-detected><sw-icon name="sparkle" size=${18}></sw-icon>
      <span>${this.st.spec.position === sug.spec.position && !this.st.advanced ? 'זיהינו: ' : 'כך נקראים השמות: '}<b>${POS_TEXT[this.st.spec.position].title}</b>${this.st.spec.position === 'start' || this.st.spec.position === 'end' ? html`, מופרד ב-<b>${this.st.spec.seps.map((s) => SEP_LABEL[s] ?? `"${s}"`).join(' / ')}</b>` : nothing}.
        מסביר <b data-ma-pct>${d.pct}%</b> מהשמות שלכם - <bdi>${d.marked}</bdi> מתוך <bdi>${d.total}</bdi>${seps.length ? html` (${seps.map(([s, n]) => `${n} עם ${SEP_LABEL[s] ?? s}`).join(', ')})` : nothing}.
        <span class="more">${d.unmarked.length ? html`${d.unmarked.length} שמות בלי סימון - ${this.data.settings.floor_inherit === 'on' ? 'מי שבקומה של בניין ברור נכנס לפי הקומה, על השאר נשאל.' : 'נשאל עליהם בהמשך.'}` : 'כל השמות מסומנים.'}</span></span>
    </div>`;
    const sp = this.st.spec;
    const chip = (on: boolean, label: string, click: () => void, count?: number, attr = '') => html`<button type="button" class="ch press" aria-pressed=${String(on)} data-ma-chip=${attr} @click=${click}>${label}${count ? html`<small>${count}</small>` : nothing}</button>`;
    const toggleSep = (s: string) => {
      const has = sp.seps.includes(s);
      const next = has ? sp.seps.filter((x) => x !== s) : [...sp.seps, s];
      if (next.length) this.setSpec({ seps: next });
    };
    const custom = sp.seps.filter((s) => !(SEP_CHIPS as readonly string[]).includes(s));
    const ctrls = this.st.spec.position === 'label' ? nothing : html`<div class="ctrls">
      ${sp.position === 'word'
        ? html`<label class="grp"><b>המילה שלפני הסימון:</b><input class="tx short" data-ma-marker .value=${sp.marker} @input=${(e: Event) => this.setSpec({ marker: (e.target as HTMLInputElement).value })} /></label>`
        : html`<div class="grp"><b>המפריד:</b>${SEP_CHIPS.map((s) => chip(sp.seps.includes(s), SEP_LABEL[s], () => toggleSep(s), d.sepUse[s], `sep-${s === ' ' ? 'space' : s}`))}
            ${custom.map((s) => chip(true, `"${s}"`, () => toggleSep(s), d.sepUse[s], 'sep-custom'))}
            <input class="tx short" placeholder="אחר…" aria-label="מפריד אחר" maxlength="4" .value=${this.customSep} @input=${(e: Event) => (this.customSep = (e.target as HTMLInputElement).value)}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && this.customSep.trim() && !sp.seps.includes(this.customSep.trim())) { this.setSpec({ seps: [...sp.seps, this.customSep.trim()] }); this.customSep = ''; } }} /></div>`}
      <div class="grp"><b>${sp.position === 'end' ? 'מה אחרי המפריד:' : sp.position === 'word' ? 'הסימון הוא:' : 'מה לפני המפריד:'}</b>${(['letter', 'number', 'word', 'any'] as TokenKind[]).map((k) => chip(sp.kind === k, KIND_LABEL[k], () => this.setSpec({ kind: k }), undefined, `kind-${k}`))}</div>
    </div>`;
    const names = [...this.data.mapItems.slice(0, 40), ...d.unmarked.slice(0, 10)];
    const preview = html`<div class="live">
      <div class="panel names"><h3>השמות שלכם, כפי שהמערכת קוראת אותם</h3><div class="scroll" data-ma-names>
        ${names.map((it) => {
          const t = tokenize(it, sp);
          return t ? html`<div class="nm"><span class="t"><bdi>${this.markName(it.name, t.token)}</bdi></span><small>${it.kind === 'floor' ? 'קומה' : 'אזור'}</small></div>` : html`<div class="nm no"><span class="t"><mark>?</mark> <bdi>${it.name}</bdi></span><small>בלי סימון</small></div>`;
        })}
        <div class="hint">… ועוד ${Math.max(0, d.total - names.length)} שמות</div></div></div>
      <div class="panel"><h3>הקיבוץ שיוצא מזה<span class="sp"></span><span class="ct">${d.tokens.length} סימונים</span></h3><div class="scroll"><div class="groups" data-ma-groups>
        ${d.tokens.map((s) => {
          const tr = m.rows.find((r) => r.token === s.token);
          const to = tr?.target;
          return html`<div class="tokc"><div class="th"><span class="g ${this.isShared(to) ? 'sh' : !to ? 'un' : ''}" title=${s.token}>${s.token}</span><span class="ct">${s.floors} קומות · ${s.areas} אזורים</span><span class="arr">← ${to ? this.bName(to) : '?'}</span></div>
            <div class="samp">${s.samples.slice(0, 4).map((x) => html`<span title=${x}><bdi>${x}</bdi></span>`)}</div></div>`;
        })}
        ${d.unmarked.length ? html`<div class="tokc"><div class="th"><span class="g un">?</span><span class="ct">${d.unmarked.length} בלי סימון</span><span class="arr">← שאלה</span></div><div class="samp">${d.unmarked.slice(0, 4).map((x) => html`<span><bdi>${x.name}</bdi></span>`)}</div></div>` : nothing}
      </div></div></div>
    </div>`;
    return html`${opts}${detected}${ctrls}${this.st.advanced && MappingAssistant.rulesView ? MappingAssistant.rulesView(this) : preview}`;
  }

  private markName(name: string, token: string) {
    const i = name.indexOf(token);
    if (i < 0) return name;
    return html`${name.slice(0, i)}<mark>${token}</mark>${name.slice(i + token.length)}`;
  }

  // ---------------------------------------------------------------------------------------------------------------------- the table

  private targetOptions(cur: Target | undefined, token: string) {
    const order = exceptionOrder(this.data.settings);
    const nw = html`<option value=${`n:${newBuildingName(token)}`} ?selected=${cur?.t === 'new'}>בניין חדש "${newBuildingName(token)}"</option>`;
    const ex = this.data.buildings.map((b) => html`<option value=${`b:${b.id}`} ?selected=${cur?.t === 'b' && cur.id === b.id}>${b.name}</option>`);
    const none = html`<option value="none" ?selected=${cur?.t === 'none'}>לא משויך</option>`;
    const parts = order.map((o) => (o === 'new' ? nw : o === 'existing' ? html`<optgroup label="בניין קיים">${ex}</optgroup>` : none));
    return html`${cur ? nothing : html`<option value="" selected>בחרו - או נשאל בהמשך</option>`}${parts}`;
  }

  parseTarget(v: string): Target | null {
    if (v.startsWith('b:')) return { t: 'b', id: v.slice(2) };
    if (v.startsWith('n:')) return { t: 'new', name: v.slice(2) };
    if (v === 'none') return { t: 'none' };
    return null;
  }

  private setToken(token: string, v: string) {
    const t = this.parseTarget(v);
    const tokens = { ...this.st.tokens };
    if (t) tokens[token] = t;
    else delete tokens[token];
    this.setState({ ...this.st, tokens }, true);
  }

  private renderTable() {
    const m = this.model();
    const sepNote = (r: TableRow) => {
      const other = Object.keys(r.stat.seps).filter((s) => s !== '·' && s !== this.st.spec.seps[0]);
      return other.length ? html`<small>גם עם ${other.map((s) => SEP_LABEL[s] ?? `"${s}"`).join(', ')}</small>` : nothing;
    };
    const drop = (onto: string) => (e: DragEvent) => {
      e.preventDefault();
      const tok = this.dragTok;
      this.dragTok = '';
      if (tok && tok !== onto) this.setState(mergeTokens(this.st, tok, onto, this.refs), true);
    };
    const rows = m.rows.map((r) => html`<div class="tk ${this.dragTok && this.dragTok !== r.token ? 'dropzone' : ''}" data-ma-token=${r.token}
        @dragover=${(e: DragEvent) => { if (this.dragTok) e.preventDefault(); }} @drop=${drop(r.token)}>
      <button class="grip" draggable="true" aria-label=${`גרור את "${r.token}" על סימון אחר כדי לאחד`} title="גרירה על שורה אחרת = אותו בניין"
        @dragstart=${(e: DragEvent) => { this.dragTok = r.token; e.dataTransfer?.setData('text/plain', r.token); }} @dragend=${() => (this.dragTok = '')}><sw-icon name="grip" size=${16}></sw-icon></button>
      <span class="tok"><span class="g ${this.isShared(r.target) ? 'sh' : !r.target ? 'un' : ''}" title=${r.token}>${r.token}</span>${sepNote(r)}${r.merged ? html`<span class="tag m" data-ma-merged>מאוחד</span>` : nothing}${r.manual ? html`<span class="tag">נוסף ידנית</span>` : nothing}</span>
      <select data-ma-target=${r.token} aria-label=${`הבניין של "${r.token}"`} @change=${(e: Event) => this.setToken(r.token, (e.target as HTMLSelectElement).value)}>${this.targetOptions(r.target, r.token)}</select>
      <span class="c"><b>${r.stat.floors} קומות, ${r.stat.areas} אזורים</b>${!r.target ? html`<small>אין בניין "${r.token}" - חדש? קיים?</small>` : r.own ? nothing : html`<small>לפי שם הבניין</small>`}</span>
      <span class="samp">${r.stat.samples.slice(0, 4).map((s) => html`<span title=${s}><bdi>${s}</bdi></span>`)}${r.stat.floors + r.stat.areas > 4 ? html`<span>+${r.stat.floors + r.stat.areas - 4}</span>` : nothing}</span>
    </div>`);
    const un = m.det.unmarked;
    const byFloor = m.sum.byFloor;
    const unRow = html`<div class="tk" data-ma-token-none><span></span><span class="tok"><span class="g un">?</span><small>בלי סימון</small></span><span class="ct">נשאל בהמשך</span>
      <span class="c"><b>${un.filter((x) => x.kind === 'floor').length} קומות, ${un.filter((x) => x.kind === 'area').length} אזורים</b>${byFloor ? html`<small>${byFloor} מהם ייכנסו לפי הקומה שלהם</small>` : nothing}</span>
      <span class="samp">${un.slice(0, 4).map((s) => html`<span><bdi>${s.name}</bdi></span>`)}</span></div>`;
    const add = html`<div class="add"><input class="tx short" data-ma-add-token placeholder="למשל A" aria-label="סימון חדש" maxlength="12" .value=${this.addTok} @input=${(e: Event) => (this.addTok = (e.target as HTMLInputElement).value)} />
      <sw-button size="sm" variant="ghost" icon="plus" data-ma-add ?disabled=${!this.addTok.trim() || m.rows.some((r) => r.token === this.addTok.trim())}
        @click=${() => { const t = this.addTok.trim(); this.setState({ ...this.st, manual_tokens: [...this.st.manual_tokens, t] }); this.addTok = ''; }}>הוסף סימון ידנית</sw-button>
      <span>אם במערכת הבית יופיעו גם שמות באנגלית, למשל "A" ← בניין א</span></div>`;
    const sideRows = m.sum.buildings.filter((b) => b.floors + b.areas + b.tokens.length > 0 || b.target.t === 'b');
    const side = html`<div class="panel side"><h3><sw-icon name="building" size=${16}></sw-icon>הבניינים שיוצאים מזה</h3><div class="scroll" data-ma-side>
      ${sideRows.map((b) => html`<div class="bl"><span class="g ${this.isShared(b.target) ? 'sh' : ''}">${b.target.t === 'new' ? html`<sw-icon name="plus" size=${14}></sw-icon>` : html`<sw-icon name="building" size=${14}></sw-icon>`}</span>
        <span class="t"><b>${this.bName(b.target)}</b><span>${b.floors} קומות · ${b.areas} אזורים${b.target.t === 'new' ? ' · ייווצר' : ''}</span></span>
        <span class="toks">${b.tokens.map((t) => html`<span class="tag">${t}</span>`)}</span></div>`)}
      <div class="bl"><span class="g un">?</span><span class="t"><b>לא משויך / שאלה</b><span>${m.sum.unassigned.floors} קומות · ${m.sum.unassigned.areas} אזורים</span></span></div>
      <div class="hint">הטבלה נשמרת: שם חדש במערכת הבית שמתחיל ב"ב ·" ייכנס לבניין ב בלי לשאול שוב (${this.data.settings.auto_insert === 'on' ? 'לבד, לפי ההגדרה' : 'אחרי "אשר"'}). סימון שלא מופיע כאן - שאלה.</div>
    </div></div>`;
    return html`<div class="two"><div class="panel"><div class="scroll" data-ma-table>
        <div class="tk hdr"><span></span><span>סימון בשם</span><span>בניין אצלנו</span><span>כמה</span><span>דוגמאות</span></div>
        ${rows}${unRow}${add}</div></div>${side}</div>`;
  }

  // ---------------------------------------------------------------------------------------------------------------------- levels

  /** MAPPING-IMPROVE-2351 "קומות ללא מפלס": one row per floor with no level anywhere - a level picker, or "זהה לקומה קיימת". */
  private renderLevels() {
    const m = this.model();
    const value = (a: LevelAnswer | undefined) => (!a ? '' : a.t === 'skip' ? 'skip' : a.t === 'floor' ? `f:${a.id}` : `l:${a.level}`);
    const parse = (v: string): LevelAnswer | undefined => {
      if (v === 'skip') return { t: 'skip' };
      if (v.startsWith('f:')) return { t: 'floor', id: v.slice(2) };
      if (v.startsWith('l:')) return { t: 'level', level: Number(v.slice(2)) };
      return undefined;
    };
    const rows = m.lq.map((q) => {
      const it = this.data.mapItems.find((x) => x.kind === 'floor' && x.id === q.id);
      const to = m.res.get(`f:${q.id}`)?.to;
      const existing = q.building.startsWith('new:') ? [] : this.data.ourFloors.filter((f) => f.building_id === q.building).sort((a, b) => b.level - a.level);
      const cur = value(q.answer);
      const levels = q.answer?.t === 'level' && !LEVEL_PICK.includes(q.answer.level) ? [...LEVEL_PICK, q.answer.level].sort((a, b) => a - b) : LEVEL_PICK;
      const tag = !q.answer
        ? html`<span class="tag wn">מחכה</span>`
        : q.answer.t === 'skip'
          ? html`<span class="tag">מפלס 0</span>`
          : html`<span class="tag ok"><sw-icon name="check" size=${12}></sw-icon>נקבע</span>`;
      return html`<div class="lv" data-ma-level=${q.id}>
        <span class="t"><b><bdi>${it?.name ?? q.rest}</bdi></b><small>${this.bName(to)} · ${q.answer?.t === 'floor' ? 'לקומה קיימת' : `קומה "${q.rest}"`}</small></span>
        <select data-ma-level-pick=${q.id} aria-label=${`המפלס של "${it?.name ?? q.rest}"`} @change=${(e: Event) => this.setLevel(q.id, parse((e.target as HTMLSelectElement).value))}>
          <option value="" ?selected=${!cur}>בחרו מפלס</option>
          ${existing.length ? html`<optgroup label="זהה לקומה קיימת">${existing.map((f) => html`<option value=${`f:${f.id}`} ?selected=${cur === `f:${f.id}`}>${f.name} (מפלס ${f.level})</option>`)}</optgroup>` : nothing}
          <optgroup label="מפלס לקומה חדשה">${levels.map((n) => html`<option value=${`l:${n}`} ?selected=${cur === `l:${n}`}>מפלס ${n}</option>`)}</optgroup>
          <option value="skip" ?selected=${cur === 'skip'}>דלג - מפלס 0, כמו היום</option>
        </select>
        ${tag}
      </div>`;
    });
    return html`<div class="panel" style="flex:1 1 auto"><h3><sw-icon name="building" size=${16}></sw-icon>קומות בלי מפלס<span class="sp"></span><span class="ct">${m.lq.length}</span></h3>
      <div class="scroll" data-ma-levels>${rows}</div></div>`;
  }

  // ---------------------------------------------------------------------------------------------------------------------- summary

  private renderSummary() {
    const m = this.model();
    const nextVersion = (this.data.versions[0]?.number ?? 0) + 1;
    const rows = m.sum.buildings.filter((b) => b.floors + b.areas > 0 || b.target.t === 'b');
    return html`<div class="panel" style="flex:1 1 auto"><div class="scroll"><div class="sum" data-ma-summary>
        ${rows.map((b) => html`<div class="srow" data-ma-sum-row=${b.key}>
          <span class="g ${this.isShared(b.target) ? 'sh' : ''}"><sw-icon name=${b.target.t === 'new' ? 'plus' : 'building'} size=${15}></sw-icon></span>
          <div class="t"><b>${this.bName(b.target)}${b.target.t === 'new' ? html` <span class="tag new">בניין חדש</span>` : nothing}</b>
            <span>${b.floors + b.areas ? `${b.floors} קומות ו-${b.areas} אזורים ממערכת הבית יופיעו תחת ${this.bName(b.target)}` : 'שום דבר ממערכת הבית לא מגיע לבניין הזה'}${b.manual ? html` · <em>${b.manual} החלטות שלכם</em>` : nothing}${b.byFloor ? ` · ${b.byFloor} לפי הקומה` : ''}${b.tokens.length ? ` · סימון ${b.tokens.map((t) => `"${t}"`).join(', ')}` : ''}</span></div>
          <span class="st ${b.floors + b.areas ? '' : 'wn'}"><sw-icon name=${b.floors + b.areas ? 'check' : 'info'} size=${14}></sw-icon>${b.floors + b.areas ? 'מוכן' : 'ריק'}</span></div>`)}
        <div class="srow" data-ma-sum-row="none"><span class="g un">?</span>
          <div class="t"><b>לא משויך</b><span>${m.sum.unassigned.floors} קומות ו-${m.sum.unassigned.areas} אזורים יישארו בלי בניין${m.sum.open ? ` (${m.sum.open} מהם מחכים להחלטה - יישארו כמו שהם)` : ''}. אפשר לסדר אותם אחר כך מההגדרות.</span></div>
          ${m.qs.length ? html`<span class="st wn"><sw-icon name="warning" size=${14}></sw-icon>${m.qs.length} החלטות פתוחות</span>` : html`<span class="st"><sw-icon name="check" size=${14}></sw-icon>הכל הוחלט</span>`}</div>
      </div></div></div>
      <div class="applybox" data-ma-applybox><div class="t"><b>להחיל את המיפוי?</b>
          <ul><li><sw-icon name="check" size=${13}></sw-icon>נשמר כגרסה ${nextVersion}</li><li><sw-icon name="check" size=${13}></sw-icon>נרשם ביומן הפעולות</li><li><sw-icon name="check" size=${13}></sw-icon>הפיך: "חזרה לגרסה זו" בהגדרות</li><li><sw-icon name="check" size=${13}></sw-icon>שום דבר לא משתנה במערכת הבית עצמה</li></ul></div>
        <sw-button variant="ghost" @click=${() => this.close()}>ביטול</sw-button>
        <sw-button variant="primary" icon="check" data-ma-apply ?disabled=${this.busy} @click=${() => void this.apply()}>${this.busy ? 'מחיל…' : 'החל'}</sw-button></div>`;
  }

  private renderDone() {
    const a = this.applied!;
    return html`<div class="donebox" data-ma-done><span class="badge-ok"><sw-icon name="check" size=${28}></sw-icon></span>
      <h2>המיפוי נשמר - גרסה ${a.version}</h2>
      <p>${a.created ? `${a.created} ${a.created === 1 ? 'בניין חדש נוצר' : 'בניינים חדשים נוצרו'}. ` : ''}שם חדש במערכת הבית עם סימון מוכר ${this.data.settings.auto_insert === 'on' ? 'ייכנס למקומו לבד' : 'יחכה ל"אשר" בכרטיס בהגדרות'}. אפשר תמיד לחזור לגרסה קודמת.</p>
      ${this.multiOn
        ? html`<p data-ma-multi-on>תצוגת ריבוי הבניינים פעילה: המסך הראשי מציג את האתר לפי בניינים.</p>`
        : this.data.can_toggle
          ? html`<div class="offer" data-ma-offer><span>תצוגת ריבוי הבניינים כבויה - המסך הראשי עדיין מציג בניין אחד.</span>
              <sw-button variant="primary" icon="building" data-ma-enable-multi ?disabled=${this.busy} @click=${() => void this.enableMulti()}>הפעל עכשיו את תצוגת ריבוי הבניינים</sw-button></div>`
          : html`<p>תצוגת ריבוי הבניינים כבויה. מי שמנהל את כל האתרים יכול להפעיל אותה בהגדרות ‹ בניינים ומיפוי.</p>`}
    </div>`;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'mapping-assistant': MappingAssistant;
  }
}

