import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-block-card';
import '../components/sw-toggle';
import './automation-templates';
import './automation-entity-picker';
import './automation-code';
import {
  automationErrorText, automations, codeToDraft, configToDraft, conflictCurrent, createItem, deleteItem, draftSentence, draftToConfig, blockIsSensitive, codeViewMode, controlsSchedules, delegationState,
  hasUnknownEffects, issuesByUid, mapAutomationError, manageRight, previewSaveBlocker, readOnlyChip, refreshSentences, replaceItem, runAutomation, runScriptNow, runNeedsConfirm, saveBlocker, saveCode,
  sensitiveSteps, suggestSchedule, toggleAutomation, validateDraft, walkDraft,
  type AnyDraft, type ScriptDraft, type AutomationCatalog, type AutomationDraft, type AutomationTemplate, type AutomationsStatus, type Block, type DryRunResult, type Issue, type ItemDetail, type ItemKind, type PreviewResult, type WriteResult,
} from '../api/automations';
import { autoReady } from '../api/automations-demo';
import { loadDevicesPrefs, applyDevicesPrefs, applyDevicesScheme, DEVICES_PREFS_DEFAULT, devicesStyleTokens } from './devices-style';
import { navigate } from '../router';
import { NEW_DRAFT_KEY } from './schedule-create-dialog';
import type { BlockChip } from '../components/sw-block-card';
import { icon } from './automation-builder-icons';
import { editorShared, editorTokens } from './automation-editor-css';
import { formFor, formStyles, type FormCtx, type PickerRequest } from './automation-block-forms';
import {
  EMPTY_CATALOG, MODE_LABEL, MODE_SUMMARY, ROOT, TYPES_OF, TYPE_POP_TITLE, addBlock, allLists, blockIcon, buildEnv, canMove, canonicalOf, capReached, clone, diffDrafts, duplicateBlock, freshDraftUids, grantText, issueLine, locate, lockedFingerprints,
  makeBlock, mergeIssues, moveBlock, moveBlockTo, placeChips, removeBlock, resolveList, saveRoute, scanJson, storedConfigOf, subtreeUids, updateBlock, withTemplateText,
  type EditorEnv, type Section,
} from './automation-editor-logic';

/** The short reason chip of a locked block ("why locked"). */
const WHY_SHORT: Record<string, string> = { template: 'תבנית', device: 'מכשיר', purpose_trigger: 'ייעודי', custom_service: 'שירות מיוחד', service_not_allowed: 'לא מותר', unsupported_step: 'מתקדם', disabled_step: 'מושבת', secret: 'חסוי', code: 'חסוי', unknown: 'לא מוכר' };
/** Item read-only reasons that block only the SAVE (editing, preview and the dry-run still work; mockup 25-26). */
const SOFT_REASONS = new Set(['delegation_off', 'grant_required']);

type DialogId = null | 'discard' | 'confirm-save' | 'run' | 'dry' | 'compare' | 'suggest' | 'delete' | 'enable';
interface Banner { id: string; tone: 'info' | 'warn' | 'bad'; icon: string; title: string; sub?: string }

/**
 * CR-017 S4: the shell and the logic every editor shares (`<automation-builder>`, `<script-editor>`, `<scene-editor>`): the glass sheet with its header,
 * body and footer; loading the status, the catalogue and the item; the draft with its tree operations; the live preview (debounced 400 ms) with the
 * inline issues by block path; the banners (conflict, delegation off, missing grant, view-only); the type chooser and the picker; the builder <-> code
 * toggle; save with the server revision and the conflict resolution; run-now, dry-run, delete; the unsaved guard.
 *
 * Interface for S3 (the lists screen mounts the editors by tag):
 *   .itemId  .mode ('edit' | 'create')  .open (default true)  .scheme ('' | light | dark | auto)  .draft0 (a starting draft for create)
 *   saved    {kind, id, item, created, status: 'ok' | 'not_loaded'}   the editor closes itself afterwards (`open` = false)
 *   cancel   {}
 *   deleted  {kind, id, trash_id, expires_at}
 *   item-changed {kind, id}   the enable toggle or a run changed the item (a list refreshes its row)
 * Public: `notifyExternalChange()` (a push says the item changed in HA: re-reads it and shows the conflict banner when its revision moved).
 */
export abstract class AutomationEditorBase extends LitElement {
  @property({ attribute: 'item-id' }) itemId: string | null = null;
  @property() mode: 'edit' | 'create' = 'edit';
  @property({ type: Boolean, reflect: true }) open = true;
  /** The colour scheme when the host knows it (light | dark | auto); empty = the installation's `devices.scheme`. */
  @property() scheme: '' | 'light' | 'dark' | 'auto' = '';
  @property({ attribute: false }) draft0: AnyDraft | null = null;

  @state() protected phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() protected loadError = '';
  /** The load answered 403 / 404: no retry button (owner decision 1b: an automation is not seen at all without automation.manage). */
  @state() protected loadDenied = false;
  @state() protected status: AutomationsStatus | null = null;
  @state() protected env: EditorEnv | null = null;
  @state() protected item: ItemDetail | null = null;
  @state() protected draft: AnyDraft | null = null;
  @state() protected openUid: string | null = null;
  @state() protected view: 'builder' | 'code' = 'builder';
  @state() protected codeText = '';
  @state() protected codeOk = true;
  @state() protected preview: PreviewResult | null = null;
  @state() protected busy: '' | 'save' | 'run' | 'dry' | 'delete' | 'toggle' = '';
  @state() protected pop: { section: Section; owner: string; name: string } | null = null;
  @state() protected picker: PickerRequest | null = null;
  @state() protected dialog: DialogId = null;
  @state() protected dryResult: DryRunResult | null = null;
  @state() protected saveError = '';
  @state() protected serverIssues: Issue[] = [];
  @state() protected conflict: ItemDetail | null = null;
  @state() protected note = '';
  @state() protected dragUid: string | null = null;
  @state() protected dropAt: { owner: string; name: string; index: number } | null = null;
  @state() protected touched = false;
  @state() protected stage: 'templates' | 'edit' = 'edit';
  @state() protected templateName = '';
  @state() protected optionsOpen = false;

  protected abstract get kind(): ItemKind;
  protected abstract blankDraft(): AnyDraft;
  protected abstract renderBuilderBody(): TemplateResult;
  protected abstract subtitleNew(): string;
  protected abstract get nameLabel(): string;
  protected get codeToggle(): boolean { return true; }
  protected get startsWithGallery(): boolean { return false; }
  protected footerExtras(): TemplateResult | typeof nothing { return nothing; }

  protected version = 0;
  protected previewVersion = -1;
  protected previewFailed = false;
  protected initial = '';
  protected storedDraft: AnyDraft | null = null;
  protected codeBase = '';
  protected lockedFps: ReadonlySet<string> = new Set();
  private previewTimer = 0;
  private loadToken = 0;
  private lastDialogClose = 0;
  private lastKeyEsc = 0;
  private suggestDraft: unknown = null;
  @query('dialog.sheet') protected sheet!: HTMLDialogElement;
  @query('automation-code') protected codeEl?: HTMLElement & { focusLine(n: number): void };

  static styles = [
    devicesStyleTokens,
    editorTokens,
    editorShared,
    formStyles,
    css`
      :host {
        display: contents;
      }
      dialog.sheet {
        position: fixed;
        margin: 0;
        padding: 0;
        border: 1px solid var(--dv-border);
        color: var(--dv-text);
        background: var(--ab-sheen), var(--ab-sheet);
        -webkit-backdrop-filter: blur(40px) saturate(1.8);
        backdrop-filter: blur(40px) saturate(1.8);
        border-radius: var(--dv-radius-lg, 28px);
        box-shadow: var(--dv-shadow-3);
        inset-block: 12px;
        inset-inline-start: 12px;
        inset-inline-end: auto;
        inline-size: min(620px, calc(100vw - 24px));
        block-size: calc(100dvh - 24px);
        max-block-size: none;
        max-inline-size: none;
        overflow: hidden;
        flex-direction: column;
        isolation: isolate;
        font-family: var(--dv-font, var(--sw-font));
      }
      dialog.sheet:focus,
      dialog.sheet:focus-visible {
        outline: none;
      }
      dialog.sheet[open] {
        display: flex;
        animation: rin 300ms var(--ab-ease);
      }
      dialog.sheet::backdrop {
        background: rgba(15, 23, 42, 0.38);
      }
      @keyframes rin {
        from {
          opacity: 0;
          transform: translateX(24px);
        }
      }
      @keyframes rup {
        from {
          opacity: 0;
          transform: translateY(40px);
        }
      }
      /* the confirmations and small forms over the sheet read on a solid surface (the sheet itself is the glass) */
      sw-dialog {
        --sw-surface: var(--dv-surface-solid, #fff);
        --sw-glass-blur: none;
      }
      .grab {
        display: none;
        inline-size: 40px;
        block-size: 5px;
        border-radius: 3px;
        background: var(--dv-border-strong);
        margin: 8px auto 0;
        flex: none;
      }
      header.shh {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 16px 10px;
        flex: none;
        min-inline-size: 0;
      }
      .shh .tx {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.25;
        gap: 2px;
      }
      .shh .tx small {
        font-size: 13px;
        color: var(--dv-text-2);
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .shh h3 {
        margin: 0;
        font-size: 21px;
        font-weight: 700;
        letter-spacing: -0.025em;
      }
      .shh .bk {
        inline-size: 38px;
        block-size: 38px;
        border-radius: 50%;
        border: 0;
        background: var(--dv-surface-3);
        display: grid;
        place-items: center;
        color: var(--dv-text);
        flex: none;
        font-size: 17px;
      }
      .namein {
        inline-size: 100%;
        min-inline-size: 0;
        border: 0;
        background: transparent;
        font: inherit;
        font-size: 21px;
        font-weight: 700;
        letter-spacing: -0.025em;
        color: var(--dv-text);
        outline: none;
        border-block-end: 1.5px dashed var(--dv-border-strong);
        padding: 2px 0 3px;
      }
      .namein:focus {
        border-block-end-color: var(--dv-accent);
      }
      .namein::placeholder {
        color: var(--dv-text-3);
        font-weight: 600;
      }
      .shh .tgl {
        flex: none;
        --sw-accent: var(--dv-toggle-on, #34c759);
      }
      .shsub {
        padding: 0 16px 6px;
        display: none;
      }
      .shsub .seg {
        inline-size: 100%;
      }
      .shsub .seg button {
        flex: 1;
        min-block-size: 40px;
      }
      .shb {
        flex: 1;
        overflow: auto;
        padding: 2px 16px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scrollbar-width: thin;
        overscroll-behavior: contain;
        position: relative;
        min-block-size: 0;
      }
      .shb > * {
        flex-shrink: 0;
      }
      footer.shf {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 16px 16px;
        border-block-start: 1px solid var(--dv-border);
        background: var(--ab-sheen), var(--ab-sheet);
      }
      footer.shf .sp {
        flex: 1;
      }
      .sugg {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-block-size: 40px;
        padding-inline: 14px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--dv-accent) 45%, transparent);
        background: var(--dv-accent-soft);
        color: var(--dv-accent-text);
        font-weight: 600;
        font-size: 13.5px;
      }
      /* ---- banners ---- */
      .banner {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 12px 14px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-warning-soft);
        border: 1px solid color-mix(in srgb, var(--dv-warning) 40%, transparent);
        font-size: 13px;
        line-height: 1.45;
      }
      .banner.info {
        background: var(--dv-accent-soft);
        border-color: color-mix(in srgb, var(--dv-accent) 30%, transparent);
      }
      .banner.bad {
        background: var(--dv-danger-soft);
        border-color: color-mix(in srgb, var(--dv-danger) 35%, transparent);
      }
      .banner > .ic {
        font-size: 18px;
        margin-block-start: 1px;
        color: var(--ab-amber-text);
      }
      .banner.info > .ic {
        color: var(--dv-accent-text);
      }
      .banner.bad > .ic {
        color: var(--dv-danger);
      }
      .banner .t {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .banner .t b {
        font-size: 13.5px;
      }
      .banner .t small {
        color: var(--dv-text-2);
        font-size: 12.5px;
      }
      .banner .acts {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-block-start: 8px;
      }
      .sentbox {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 14px 16px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-accent-soft);
        color: var(--dv-text);
        font-size: 15px;
        line-height: 1.55;
        font-weight: 500;
      }
      .sentbox > .ic {
        font-size: 20px;
        color: var(--dv-accent-text);
        margin-block-start: 2px;
      }
      .sentbox small {
        display: flex;
        gap: 5px;
        align-items: center;
        font-size: 12.5px;
        color: var(--dv-text-2);
        font-weight: 500;
        margin-block-start: 3px;
      }
      .valbox {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-danger-soft);
        border: 1px solid color-mix(in srgb, var(--dv-danger) 30%, transparent);
      }
      .valbox > b {
        font-size: 13.5px;
        display: flex;
        gap: 8px;
        align-items: center;
        color: var(--dv-danger);
      }
      .valbox button {
        display: flex;
        gap: 6px;
        text-align: start;
        border: 0;
        background: transparent;
        min-block-size: 32px;
        font-size: 13px;
        padding: 0;
        align-items: center;
      }
      .valbox button span {
        color: var(--dv-text-2);
        font-weight: 600;
      }
      /* ---- sections ---- */
      .bsec2 {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .bsec2 > h4 {
        display: flex;
        gap: 10px;
        align-items: center;
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }
      .bsec2 > h4 small {
        font-size: 12.5px;
        font-weight: 500;
        color: var(--dv-text-2);
      }
      .bsec2 > h4 .k {
        inline-size: 28px;
        block-size: 28px;
        border-radius: 9px;
      }
      .bsec2 > h4 .k.when {
        background: #ff9f0a;
      }
      .bsec2 > h4 .k.if {
        background: #8e8e93;
      }
      .bsec2 > h4 .k.then {
        background: var(--dv-accent);
      }
      .blist {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .slot {
        position: relative;
      }
      .slot.drag {
        opacity: 0.45;
      }
      .slot.drop-before::before,
      .blist.drop-end::after {
        content: '';
        display: block;
        block-size: 3px;
        border-radius: 2px;
        background: var(--dv-accent);
        margin-block: -5px 2px;
      }
      .slot.drop-before::before {
        position: absolute;
        inset-inline: 0;
        inset-block-start: -6px;
        margin: 0;
      }
      .addblk {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-block-size: 44px;
        border-radius: var(--dv-radius-sm, 14px);
        border: 1.5px dashed var(--dv-border-strong);
        background: transparent;
        color: var(--dv-accent-text);
        font-weight: 600;
        font-size: 13.5px;
        inline-size: 100%;
      }
      .addblk:hover {
        background: var(--dv-accent-soft);
      }
      .addblk .ic {
        font-size: 16px;
      }
      .scrim {
        position: absolute;
        inset: 0;
        z-index: 70;
        background: transparent;
      }
      .scrim.soft {
        background: rgba(15, 23, 42, 0.18);
      }
      .typepop {
        position: absolute;
        z-index: 75;
        inset-inline: 16px;
        inset-block-start: 110px;
        max-block-size: calc(100% - 130px);
        overflow: auto;
        background: var(--ab-sheet);
        -webkit-backdrop-filter: blur(40px) saturate(1.8);
        backdrop-filter: blur(40px) saturate(1.8);
        border: 1px solid var(--dv-border);
        border-radius: 22px;
        box-shadow: var(--dv-shadow-3);
        padding: 10px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        animation: pop 180ms var(--ab-ease);
      }
      .typepop .hd {
        grid-column: 1 / -1;
        font-size: 12px;
        color: var(--dv-text-2);
        font-weight: 600;
        padding: 4px 10px 0;
      }
      .typepop button {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        background: transparent;
        border-radius: 14px;
        padding: 8px 10px;
        text-align: start;
        font-size: 13.5px;
        font-weight: 600;
        min-block-size: 50px;
        color: var(--dv-text);
      }
      .typepop button:hover {
        background: var(--dv-surface-3);
      }
      .typepop button .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        font-size: 16px;
        flex: none;
      }
      .typepop button.sensb .rg {
        background: var(--ab-sens-bg);
        color: var(--ab-sens-fg);
      }
      .typepop button small {
        display: block;
        font-size: 11.5px;
        color: var(--dv-text-2);
        font-weight: 500;
      }
      .pickpop {
        position: absolute;
        z-index: 75;
        inset-inline: 16px;
        inset-block-start: 86px;
        max-block-size: min(560px, calc(100% - 110px));
        animation: pop 180ms var(--ab-ease);
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: translateY(-6px) scale(0.985);
        }
      }
      .state-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 10px;
        padding: 56px 24px;
        color: var(--dv-text-2);
      }
      .state-box b {
        font-size: 17px;
        color: var(--dv-text);
      }
      .state-box.err b {
        color: var(--dv-danger);
      }
      .opts-wrap {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .runnote {
        font-size: 12.5px;
        color: var(--dv-text-2);
        padding-inline: 4px;
      }
      .dlg-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 13.5px;
        line-height: 1.5;
      }
      .dlg-body h5 {
        margin: 6px 0 0;
        font-size: 13px;
      }
      .kvrow {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
        border-block-end: 1px solid var(--dv-border);
        font-size: 13px;
      }
      .kvrow:last-child {
        border-block-end: 0;
      }
      .kvrow .bad {
        color: var(--dv-danger);
        font-weight: 600;
      }
      .kvrow .ok {
        color: var(--ab-ok-text);
        font-weight: 600;
      }
      .diff {
        display: grid;
        grid-template-columns: 70px 1fr 1fr;
        gap: 6px 10px;
        font-size: 12.5px;
      }
      .diff .h {
        font-weight: 700;
        color: var(--dv-text-2);
      }
      .diff .c {
        padding: 6px 8px;
        border-radius: 10px;
        background: var(--dv-surface-3);
        line-height: 1.4;
      }
      .diff .c.mine {
        background: var(--dv-accent-soft);
      }
      .diff .g {
        font-weight: 700;
        padding-block: 6px;
      }
      @media (max-width: 767px) {
        dialog.sheet {
          inset: auto 0 0 0;
          inline-size: auto;
          block-size: calc(100dvh - 20px);
          border-radius: 28px 28px 0 0;
          border-block-end: 0;
        }
        dialog.sheet[open] {
          animation-name: rup;
        }
        .grab {
          display: block;
        }
        header.shh {
          padding: 8px 14px 10px;
        }
        .shh .bk {
          inline-size: 44px;
          block-size: 44px;
        }
        .shh .seg.top {
          display: none;
        }
        .shsub {
          display: block;
        }
        .shb {
          padding-inline: 14px;
        }
        footer.shf {
          padding: 10px 14px 14px;
        }
        footer.shf .sp {
          display: none;
        }
        footer.shf .btn,
        footer.shf .sugg {
          flex: 1 1 auto;
          min-block-size: 44px;
          justify-content: center;
        }
        footer.shf .btn.primary {
          flex: 1 1 100%;
          order: 20;
        }
        .typepop {
          inset-inline: 10px;
          grid-template-columns: 1fr;
          inset-block-start: 96px;
        }
        .pickpop {
          inset-inline: 10px;
          inset-block-start: 70px;
          max-block-size: calc(100% - 90px);
        }
        .diff {
          grid-template-columns: 56px 1fr 1fr;
        }
      }
    `,
  ];

  // ------------------------------------------------------------------------------------------------ derived

  protected get isNew(): boolean { return this.mode === 'create' || !this.itemId; }
  protected get dirty(): boolean {
    if (!this.draft || !this.env) return false;
    if (this.view === 'code' && this.codeText !== this.codeBase) return true;
    return canonicalOf(this.kind, this.draft, this.env.ctx, this.item?.config_id ?? null) !== this.initial;
  }
  protected get hardReadOnly(): boolean {
    if (!this.status) return false;
    if (this.isNew) return !manageRight(this.kind, this.status);
    const reasons = this.item?.read_only?.reasons ?? [];
    return !!this.item && (reasons.some((r) => !SOFT_REASONS.has(r.code)) || (!this.item.can.edit && !reasons.length));
  }
  protected get roText(): string {
    if (this.isNew) return 'אין הרשאת עריכה';
    const hard = this.item?.read_only?.reasons.find((r) => !SOFT_REASONS.has(r.code));
    return hard ? readOnlyChip({ read_only: { reasons: [hard] } })?.text ?? 'צפייה בלבד' : 'צפייה בלבד';
  }
  protected get codeMode(): 'hidden' | 'readonly' | 'editable' {
    if (!this.status || !this.codeToggle) return 'hidden';
    return codeViewMode(this.status, this.isNew ? null : this.item);
  }
  protected get freshPreview(): PreviewResult | null { return this.preview && (this.previewVersion === this.version) ? this.preview : null; }

  protected get issues(): Issue[] {
    if (!this.draft || !this.env) return [];
    const local = validateDraft(this.kind, this.draft, { shabbatSensor: this.env.catalog.shabbat_sensor, notifyTargets: this.env.notifyActions, ...(this.env.catalog.allowed_actions ? { allowedActions: this.env.catalog.allowed_actions } : {}) });
    return mergeIssues(local, this.freshPreview?.errors ?? [], this.serverIssues);
  }
  protected get missingGrants(): NonNullable<PreviewResult['sensitive_steps']> {
    if (!this.draft || !this.env) return [];
    const steps = this.preview?.sensitive_steps ?? sensitiveSteps(this.draft, (id) => this.env!.byId.get(id)?.class ?? null);
    return steps.filter((s) => !s.granted);
  }

  /** Why the save is off right now (null = it may be pressed). */
  protected get saveGate(): { text: string } | null {
    const s = this.status;
    if (!s || !this.draft || !this.env) return { text: 'טוען' };
    if (this.hardReadOnly) return { text: this.roText };
    if (this.busy) return { text: '' };
    const sb = saveBlocker(this.kind, s);
    if (sb) return { text: sb.text };
    if (this.view === 'code') {
      if (this.codeMode === 'readonly') return { text: 'צפייה בלבד' };
      return this.codeOk && this.codeDirtyOrDraft ? null : { text: this.codeOk ? '' : 'יש דברים לתקן' };
    }
    if (this.issues.length) return { text: 'יש דברים לתקן' };
    if (this.missingGrants.length) return { text: grantText(this.missingGrants[0].action, this.env.ctx.names!(this.missingGrants[0].entity_id)) };
    const p = this.freshPreview;
    if (p) { const pb = previewSaveBlocker(p, s); if (pb && pb.code !== 'invalid') return { text: pb.text }; }
    if (!this.isNew && !this.dirty) return { text: '' };
    return null;
  }
  protected get codeDirtyOrDraft(): boolean { return this.isNew || this.codeText !== this.codeBase || this.dirty; }

  protected sentenceOf(b: Block): string { return this.freshPreview?.block_sentences[b.uid] ?? b.sentence; }

  // ------------------------------------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    // the editors are glass sheets (the approved mockup) in the installation's palette and scheme (`devices.theme` / `devices.scheme`); a host may force the scheme
    applyDevicesPrefs(this, { ...DEVICES_PREFS_DEFAULT, style: 'glass', ...(this.scheme === 'light' || this.scheme === 'dark' || this.scheme === 'auto' ? { scheme: this.scheme } : {}) });
    void loadDevicesPrefs().then((p) => {
      if (!this.isConnected) return;
      applyDevicesPrefs(this, { ...p, style: 'glass' });
      if (this.scheme) applyDevicesScheme(this, this.scheme);
    });
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.previewTimer);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.loadToken++;
  }

  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.open && this.dirty && !this.busy) { e.preventDefault(); e.returnValue = ''; }
  };

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('scheme') && this.scheme) applyDevicesScheme(this, this.scheme);
    if (changed.has('open') && !this.open) { window.clearTimeout(this.previewTimer); }
    if ((changed.has('itemId') || changed.has('mode') || changed.has('draft0') || (changed.has('open') && this.open)) && this.open) void this.init();
    if (this.env) this.setAttribute('data-chip', this.env.sensitiveChip);
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has('open')) this.syncDialog();
    else if (this.open && this.sheet && !this.sheet.open) this.syncDialog();
  }

  private syncDialog() {
    const dlg = this.sheet;
    if (!dlg) return;
    if (this.open && !dlg.open) {
      try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
      dlg.focus({ preventScroll: true }); // focus lands in the sheet, not on its first button (no ring on "back")
    } else if (!this.open && dlg.open) dlg.close();
  }

  protected async init() {
    const token = ++this.loadToken;
    this.phase = 'loading';
    this.item = null; this.draft = null; this.preview = null; this.previewVersion = -1; this.previewFailed = false; this.openUid = null; this.view = 'builder'; this.dialog = null; this.conflict = null; this.saveError = '';
    this.serverIssues = []; this.touched = false; this.note = ''; this.pop = null; this.picker = null; this.templateName = ''; this.optionsOpen = false; this.dryResult = null;
    try {
      await autoReady(); // the demo persona (no backend) is applied before the first read; with a backend this resolves at once
      if (token !== this.loadToken) return;
      const a = automations();
      const [status, catalog, item] = await Promise.all([
        a.status(),
        a.catalog().catch((): AutomationCatalog => EMPTY_CATALOG),
        this.isNew ? Promise.resolve(null) : a.get(this.kind, this.itemId!),
      ]);
      if (token !== this.loadToken) return;
      this.status = status;
      this.env = buildEnv(status, catalog);
      this.item = item;
      const d = clone(item ? item.draft : this.draft0 ?? this.blankDraft());
      refreshSentences(d, this.env.ctx);
      this.draft = d;
      this.storedDraft = item ? clone(item.draft) : null;
      this.initial = this.isNew && this.draft0 === null ? canonicalOf(this.kind, d, this.env.ctx) : canonicalOf(this.kind, d, this.env.ctx, item?.config_id ?? null);
      this.lockedFps = lockedFingerprints(d);
      this.stage = this.isNew && this.draft0 === null && this.startsWithGallery && status.ui.templates_enabled !== false && status.can.manage ? 'templates' : 'edit';
      if (this.draft0) this.touched = true;
      this.phase = 'ready';
      this.version++;
      this.schedulePreview(0);
    } catch (e) {
      if (token !== this.loadToken) return;
      this.loadError = automationErrorText(e);
      const st = mapAutomationError(e).status;
      this.loadDenied = st === 403 || st === 404;
      this.phase = 'error';
    }
  }

  /** A push said this item changed in the platform: re-read it; a moved revision shows the conflict banner (mockup 27). */
  async notifyExternalChange(): Promise<void> {
    if (this.isNew || !this.item || this.busy) return;
    try {
      const cur = await automations().get(this.kind, this.itemId!);
      if (cur.revision !== this.item.revision) this.conflict = cur;
    } catch { /* the item may be gone: the next save says so */ }
  }

  // ------------------------------------------------------------------------------------------------ draft changes and the live preview

  protected change(next: AnyDraft) {
    if (!this.env) return;
    refreshSentences(next, this.env.ctx);
    this.draft = next;
    this.version++;
    this.touched = true;
    this.saveError = '';
    this.serverIssues = [];
    this.schedulePreview();
  }
  protected patchBlock(uid: string, fn: (b: Block) => void) { if (this.draft) this.change(updateBlock(this.draft, uid, fn)); }

  private schedulePreview(ms = 400) {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => void this.runPreview(), ms);
  }
  private async runPreview() {
    if (!this.draft || !this.open) return;
    const v = this.version;
    try {
      const p = await automations().preview({ kind: this.kind, id: this.isNew ? null : this.item?.id ?? null, draft: this.draft });
      if (v !== this.version) return;
      this.preview = p; this.previewVersion = v; this.previewFailed = false;
    } catch {
      if (v === this.version) { this.previewFailed = true; this.previewVersion = v; }
    }
  }

  // ------------------------------------------------------------------------------------------------ close, cancel, keys

  protected closeSelf() { this.open = false; }
  protected emit(name: string, detail: unknown) { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })); }

  protected requestCancel() {
    if (this.busy) return;
    if (this.dirty && !this.hardReadOnly) { this.dialog = 'discard'; return; }
    this.cancel();
  }
  protected cancel() {
    this.dialog = null;
    this.emit('cancel', {});
    this.closeSelf();
  }

  private onSheetCancel = (e: Event) => {
    e.preventDefault();
    const now = performance.now();
    if (now - this.lastDialogClose < 120 || now - this.lastKeyEsc < 120) return; // a nested dialog, the picker or the type chooser already took this Escape
    this.requestCancel();
  };
  private onSheetKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (this.picker || this.pop) {
      e.preventDefault(); e.stopPropagation();
      this.picker = null; this.pop = null; this.lastKeyEsc = performance.now();
    }
  };
  protected dialogClosed = () => { this.dialog = null; this.lastDialogClose = performance.now(); };

  // ------------------------------------------------------------------------------------------------ save

  private async save(confirm = false) {
    if (!this.draft || !this.env || !this.status) return;
    if (!confirm && this.saveGate) return;
    if (!confirm && this.view === 'builder' && (this.freshPreview?.requires.confirm ?? hasUnknownEffects(this.draft))) { this.dialog = 'confirm-save'; return; }
    this.busy = 'save'; this.saveError = ''; this.dialog = null;
    try {
      const r = await this.write(confirm);
      this.afterWrite(r);
    } catch (e) {
      this.onSaveError(e);
    }
    this.busy = '';
  }

  private async write(confirm: boolean): Promise<WriteResult> {
    const env = this.env!;
    let draft = this.draft!;
    let cfg: Record<string, unknown> | null = null;
    if (this.view === 'code') {
      const s = scanJson(this.codeText);
      if (!s.ok || typeof s.value !== 'object' || s.value === null || Array.isArray(s.value)) throw new Error('code');
      cfg = s.value as Record<string, unknown>;
      draft = configToDraft(this.kind, cfg, env.ctx).draft;
    }
    const route = saveRoute(this.isNew, draft, this.storedDraft);
    const rev = this.item?.revision ?? null;
    if (route === 'create') return createItem(this.kind, draft as never, { enabled: true, confirm });
    if (route === 'replace') return replaceItem(this.kind, this.itemId!, draft as never, rev, { confirm });
    // a locked block changed: only the code view's route accepts it (CR §4.5); the config carries every top-level key
    const text = cfg ?? draftToConfig(this.kind, draft as never, storedConfigOf(this.item), env.ctx, { id: this.item?.config_id ?? null });
    if (!storedConfigOf(this.item) && (this.item?.extras.length ?? 0) > 0) {
      throw Object.assign(new Error('extras'), { extras: true });
    }
    return saveCode(this.kind, this.itemId!, text, rev, { confirm });
  }

  private afterWrite(r: WriteResult) {
    const created = this.isNew;
    const item = r.item ?? null;
    this.emit('saved', { kind: this.kind, id: item?.id ?? this.itemId, item, created, status: r.status === 'not_loaded' ? 'not_loaded' : 'ok' });
    if (r.status === 'not_loaded') this.note = 'נשמר, אך עדיין לא נטען במערכת';
    this.initial = this.env ? canonicalOf(this.kind, this.draft!, this.env.ctx, item?.config_id ?? this.item?.config_id ?? null) : this.initial;
    this.touched = false; this.codeBase = this.codeText;
    this.closeSelf();
  }

  private onSaveError(e: unknown) {
    if ((e as { extras?: boolean }).extras) { this.saveError = 'לפריט יש הגדרות נוספות שאינן מוצגות כאן; עריכת חלק נעול תתאפשר כשהקוד המלא יוצג'; return; }
    if (e instanceof Error && e.message === 'code') { this.saveError = 'הקוד אינו תקין'; return; }
    const f = mapAutomationError(e);
    if (f.kind === 'conflict') {
      const cur = conflictCurrent(e);
      if (cur) { this.conflict = cur; return; }
    }
    if (f.kind === 'confirm') { this.dialog = 'confirm-save'; return; }
    if (f.kind === 'validation' && f.issues.length) { this.serverIssues = f.issues; this.touched = true; this.saveError = f.message; return; }
    this.saveError = f.maybe_saved ? `${f.message}` : f.message;
  }

  // ------------------------------------------------------------------------------------------------ conflict (mockup 27)

  private reloadTheirs() {
    const cur = this.conflict;
    if (!cur || !this.env) return;
    this.item = cur;
    const d = clone(cur.draft);
    refreshSentences(d, this.env.ctx);
    this.draft = d; this.storedDraft = clone(cur.draft); this.initial = canonicalOf(this.kind, d, this.env.ctx, cur.config_id);
    this.lockedFps = lockedFingerprints(d); this.conflict = null; this.touched = false; this.openUid = null; this.view = 'builder'; this.version++; this.schedulePreview(0);
  }
  private keepMine() {
    const cur = this.conflict;
    if (!cur) return;
    // the same edit on top of the current revision (an explicit choice; the server re-checks everything)
    this.item = { ...cur, draft: this.item?.draft ?? cur.draft } as ItemDetail;
    this.storedDraft = clone(cur.draft);
    this.conflict = null;
    void this.save();
  }

  // ------------------------------------------------------------------------------------------------ run, dry-run, enable, delete

  protected async runNow(confirm = false, skipCondition = true) {
    if (!this.item || this.kind === 'scene') return;
    if (!confirm && runNeedsConfirm(this.item)) { this.dialog = 'run'; return; }
    this.busy = 'run'; this.note = ''; this.dialog = null;
    try {
      if (this.kind === 'script') {
        const fields = (this.item.draft as ScriptDraft).fields;
        await runScriptNow(this.item.id, Object.fromEntries(fields.filter((f) => f.default !== undefined).map((f) => [f.key, f.default])), { confirm });
        this.note = 'הופעל';
      } else {
        await runAutomation(this.item.id, { skip_condition: skipCondition, confirm });
        this.note = skipCondition ? 'הופעלה' : 'נבדקה והופעלה';
      }
      this.emit('item-changed', { kind: this.kind, id: this.item.id });
    } catch (e) {
      const f = mapAutomationError(e);
      if (f.kind === 'confirm') this.dialog = 'run'; else this.note = f.message;
    }
    this.busy = '';
  }

  protected async dryRun() {
    if (!this.draft) return;
    this.busy = 'dry'; this.note = '';
    try {
      const saved = !this.isNew && !this.dirty && this.item;
      if (saved) this.dryResult = await automations().dryRun(this.kind, this.item!.id);
      else {
        const p = await automations().preview({ kind: this.kind, id: this.isNew ? null : this.item?.id ?? null, draft: this.draft });
        this.dryResult = { conditions: ('conditions' in this.draft ? this.draft.conditions : []).map((c) => ({ sentence: c.sentence, passed: null })), effects: p.effects };
      }
      this.dialog = 'dry';
    } catch (e) { this.note = automationErrorText(e); }
    this.busy = '';
  }

  private async toggleEnabled(on: boolean, confirm = false) {
    if (!this.item) return;
    if (on && !confirm && this.item.unknown_effects) { this.dialog = 'enable'; return; }
    this.busy = 'toggle'; this.dialog = null;
    try {
      const r = await toggleAutomation(this.item.id, on, { confirm });
      this.item = { ...this.item, state: r.item.state };
      this.emit('item-changed', { kind: this.kind, id: this.item.id });
    } catch (e) { this.note = automationErrorText(e); }
    this.busy = '';
  }

  private async deleteNow() {
    if (!this.item) return;
    this.busy = 'delete'; this.dialog = null;
    try {
      const r = await deleteItem(this.kind, this.item.id, this.item.revision);
      this.emit('deleted', { kind: this.kind, id: this.item.id, trash_id: r.trash_id, expires_at: r.expires_at });
      this.closeSelf();
    } catch (e) {
      const f = mapAutomationError(e);
      const cur = conflictCurrent(e);
      if (f.kind === 'conflict' && cur) this.conflict = cur; else this.saveError = f.message;
    }
    this.busy = '';
  }

  // ------------------------------------------------------------------------------------------------ the builder <-> code toggle

  protected setView(v: 'builder' | 'code') {
    if (v === this.view || !this.draft || !this.env) return;
    if (v === 'code') {
      const cfg = draftToConfig(this.kind, this.draft as never, storedConfigOf(this.item), this.env.ctx, { id: this.item?.config_id ?? null });
      this.codeText = JSON.stringify(cfg, null, 2);
      this.codeBase = this.codeText; this.codeOk = true; this.view = 'code'; this.pop = null; this.picker = null;
      return;
    }
    const r = codeToDraft(this.kind, this.codeText, this.env.ctx);
    if (!r.ok) return;
    const next = refreshSentences(r.draft, this.env.ctx);
    this.draft = next; this.lockedFps = lockedFingerprints(next); this.view = 'builder'; this.openUid = null; this.version++; this.touched = true; this.schedulePreview(0);
  }
  private onCode = (e: CustomEvent<{ text: string; ok: boolean }>) => {
    this.codeText = e.detail.text; this.codeOk = e.detail.ok; this.saveError = '';
  };
  protected gotoCode = () => { this.setView('code'); };
  protected editTemplate = (uid: string, text: string) => this.patchBlock(uid, (b) => { if (b.kind === 'locked') Object.assign(b, withTemplateText(b, text)); });

  // ------------------------------------------------------------------------------------------------ blocks: cards, lists, add, pickers

  protected chipsOf(b: Block, section: Section): BlockChip[] {
    const env = this.env!;
    const out: BlockChip[] = [];
    if (b.kind === 'locked') {
      out.push({ tone: 'lock', text: 'נעול', icon: 'lock', title: 'נשמר כמו שהוא' }, { tone: 'why', text: WHY_SHORT[b.reason] ?? 'לא מוכר', title: b.label });
      if (b.reason === 'template') out.push({ tone: 'code', text: '{{ }}' });
      if (b.sensitive && env.sensitiveWarning) out.push({ tone: 'sens', text: 'פעולה רגישה', icon: 'alarm' });
      if (controlsSchedules(b)) out.push({ tone: 'warn', text: 'שולט בתזמונים', icon: 'calendar' });
      if (b.masked) out.push({ tone: 'bad', text: 'ערך חסוי' });
      const rid = typeof (b.raw as { id?: unknown } | null)?.id === 'string' && section === 'trigger' ? String((b.raw as { id: string }).id) : null;
      if (rid) out.push({ tone: 'code', text: `id: ${rid}` });
      return out;
    }
    const t = b as Block & { id?: string | null };
    if (section === 'trigger' && t.id) out.push({ tone: 'code', text: `id: ${t.id}` });
    if (section === 'action' && env.sensitiveWarning && blockIsSensitive(b, (id) => env.byId.get(id)?.class ?? null)) out.push({ tone: 'sens', text: 'פעולה רגישה', icon: 'alarm' });
    const ids = (b as { entity_ids?: string[] }).entity_ids ?? [];
    if (ids.some((id) => env.byId.get(id)?.missing)) out.push({ tone: 'bad', text: 'מכשיר חסר', icon: 'warning' });
    return out;
  }

  protected formCtx(b: Block, section: Section, issues: Issue[]): FormCtx {
    const env = this.env!;
    const draft = this.draft!;
    const triggerIds = 'triggers' in draft ? draft.triggers.map((t) => (t.kind === 'typed' ? t.id ?? null : typeof (t.raw as { id?: unknown } | null)?.id === 'string' ? String((t.raw as { id: string }).id) : null)).filter((x): x is string => !!x) : [];
    return {
      env, kind: this.kind, block: b, section, issues, triggerIds, canCode: this.codeMode === 'editable',
      patch: (fn) => this.patchBlock(b.uid, fn),
      pick: (req) => { this.picker = req; this.pop = null; },
      nested: (owner, name, sec) => this.renderList(owner, name, sec),
      child: (inner, sec) => this.formCtx(inner, sec, this.issuesBy[inner.uid] ?? []),
      gotoCode: this.gotoCode, editTemplate: this.editTemplate,
    };
  }

  private get issuesBy(): Record<string, Issue[]> {
    return this.draft ? issuesByUid(this.draft, this.issues) : {};
  }

  protected renderCard(b: Block, section: Section, ref: { owner: string; name: string; index: number; count: number }, by: Record<string, Issue[]>) {
    // a card is open when it is the open one or holds the open one (a nested block is edited inside its parent's form)
    const openDirect = this.openUid === b.uid;
    const open = openDirect || (!!this.openUid && subtreeUids(b).has(this.openUid));
    const iss = by[b.uid] ?? [];
    const drop = this.dropAt && this.dropAt.owner === ref.owner && this.dropAt.name === ref.name && this.dropAt.index === ref.index;
    return html`<div class="slot ${this.dragUid === b.uid ? 'drag' : ''} ${drop ? 'drop-before' : ''}" data-uid=${b.uid} data-block-slot>
      <sw-block-card .uid=${b.uid} .icon=${blockIcon(b, section)} .heading=${this.sentenceOf(b)} .chips=${this.chipsOf(b, section)} .open=${open} .locked=${b.kind === 'locked'} .invalid=${iss.length > 0}
        .nested=${ref.owner !== ROOT} .readonly=${this.hardReadOnly} .canUp=${ref.index > 0} .canDown=${ref.index < ref.count - 1}
        @card-toggle=${() => { if (!(this.hardReadOnly && b.kind === 'typed')) this.openUid = openDirect ? null : b.uid; }}
        @card-remove=${() => { if (this.draft) { this.change(removeBlock(this.draft, b.uid)); if (this.openUid === b.uid) this.openUid = null; } }}
        @card-move=${(e: CustomEvent<{ delta: -1 | 1; from?: 'key' | 'button' }>) => this.moveCard(b.uid, e.detail.delta, e.detail.from)}
        @card-duplicate=${() => { if (this.draft) this.change(duplicateBlock(this.draft, b.uid)); }}
        @card-dragstart=${() => { this.dragUid = b.uid; }}>
        ${open ? html`<fieldset class="bf" ?disabled=${this.hardReadOnly} style="border:0;padding:0;margin:0;min-inline-size:0">${formFor(this.formCtx(b, section, iss))}</fieldset>` : nothing}
      </sw-block-card>
    </div>`;
  }

  /** A block list with its add button; the sections of the builder and every nested list (if / choose / repeat / groups) are this. */
  protected renderList(owner: string, name: string, section: Section): TemplateResult {
    const draft = this.draft!;
    const list = resolveList(draft, owner, name) ?? [];
    const by = this.issuesBy;
    const end = this.dropAt && this.dropAt.owner === owner && this.dropAt.name === name && this.dropAt.index >= list.length;
    return html`<div class="blist ${end ? 'drop-end' : ''}" data-list=${`${owner}|${name}`} @dragover=${(e: DragEvent) => this.onDragOver(e, owner, name)} @drop=${(e: DragEvent) => this.onDrop(e, owner, name)} @dragleave=${(e: DragEvent) => this.onDragLeave(e)}>
      ${repeat(list, (b) => b.uid, (b, i) => this.renderCard(b, section, { owner, name, index: i, count: list.length }, by))}
      ${this.hardReadOnly || capReached(draft, section, list.length) ? nothing : html`<button class="addblk" type="button" data-add=${section} data-add-list=${`${owner}|${name}`} @click=${() => { this.pop = { section, owner, name }; this.picker = null; }}>${icon('plus')}הוסף</button>`}
    </div>`;
  }

  /** Moves a block one place; the DOM node of a moved card is re-inserted, so the focus is put back where the user was (the header, or the button pressed). */
  private moveCard(uid: string, delta: -1 | 1, from?: 'key' | 'button') {
    if (!this.draft || !canMove(this.draft, uid, delta)) return;
    this.change(moveBlock(this.draft, uid, delta));
    void this.updateComplete.then(() => {
      const c = this.renderRoot.querySelector(`[data-uid="${uid}"] > sw-block-card`);
      const sel = from === 'button' ? (delta < 0 ? '[data-block-up]' : '[data-block-down]') : '[data-block-main]';
      let t = c?.shadowRoot?.querySelector<HTMLElement>(sel);
      if (t && (t as HTMLButtonElement).disabled) t = c?.shadowRoot?.querySelector<HTMLElement>(delta < 0 ? '[data-block-down]' : '[data-block-up]');
      (t ?? c?.shadowRoot?.querySelector<HTMLElement>('[data-block-main]'))?.focus({ preventScroll: true });
    });
  }

  private onDragOver(e: DragEvent, owner: string, name: string) {
    if (!this.dragUid || !this.draft) return;
    const at = locate(this.draft, this.dragUid);
    const target = allLists(this.draft).find((l) => l.owner === owner && l.name === name);
    if (!at || !target || target.section !== at.section) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const slots = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(':scope > .slot')];
    let index = slots.length;
    for (let i = 0; i < slots.length; i++) { const r = slots[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { index = i; break; } }
    if (!this.dropAt || this.dropAt.owner !== owner || this.dropAt.name !== name || this.dropAt.index !== index) this.dropAt = { owner, name, index };
  }
  private onDragLeave(e: DragEvent) {
    const to = e.relatedTarget as Node | null;
    if (!to || !(e.currentTarget as HTMLElement).contains(to)) this.dropAt = null;
  }
  private onDrop(e: DragEvent, owner: string, name: string) {
    if (!this.dragUid || !this.draft) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = this.dropAt && this.dropAt.owner === owner && this.dropAt.name === name ? this.dropAt.index : 0;
    const next = moveBlockTo(this.draft, this.dragUid, owner, name, idx);
    this.dragUid = null; this.dropAt = null;
    if (next) this.change(next);
  }
  protected onDragEnd = () => { this.dragUid = null; this.dropAt = null; };

  private chooseType(id: string) {
    const p = this.pop;
    if (!p || !this.draft || !this.env) return;
    const b = makeBlock(p.section, id, this.env);
    this.pop = null;
    if (!b) return;
    this.change(addBlock(this.draft, p.owner, p.name, b));
    this.openUid = b.uid;
    this.updateComplete.then(() => this.scrollToBlock(b.uid));
  }

  protected scrollToBlock(uid: string) {
    const el = this.renderRoot.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  protected goto(path: string) {
    if (!this.draft) return;
    const w = walkDraft(this.draft).filter((x) => path === x.path || path.startsWith(`${x.path}.`)).sort((a, b) => b.path.length - a.path.length)[0];
    if (!w) return;
    this.openUid = w.block.uid;
    this.updateComplete.then(() => this.scrollToBlock(w.block.uid));
  }

  // ------------------------------------------------------------------------------------------------ render parts

  protected renderTypePop() {
    const p = this.pop;
    if (!p || !this.env || !this.draft) return nothing;
    const ownerBlock = p.owner === ROOT ? null : walkDraft(this.draft).find((w) => w.block.uid === p.owner)?.block;
    const inGroup = !!ownerBlock && ['and', 'or', 'not'].includes((ownerBlock as { type?: string }).type ?? '');
    const types = TYPES_OF[p.section].filter((t) => (!t.available || t.available(this.env!, this.draft!)) && !(p.section === 'condition' && inGroup && ['and', 'or', 'not'].includes(t.id)));
    return html`<div class="scrim" data-scrim @click=${() => (this.pop = null)}></div>
      <div class="typepop" role="menu" data-typepop>
        <div class="hd">${TYPE_POP_TITLE[p.section]}</div>
        ${types.map((t) => html`<button type="button" role="menuitem" class=${t.sensitive ? 'sensb' : ''} data-type=${t.id} @click=${() => this.chooseType(t.id)}><span class="rg">${icon(t.icon)}</span><span><span>${t.label}</span><small>${t.hint}</small></span></button>`)}
      </div>`;
  }

  protected renderPicker() {
    const r = this.picker;
    if (!r || !this.env) return nothing;
    return html`<div class="scrim" data-scrim @click=${() => (this.picker = null)}></div>
      <automation-entity-picker class="pickpop" .env=${this.env} .filter=${r.filter} .where=${r.where ?? null} .selected=${r.selected} .multi=${r.multi ?? true}
        @picker-change=${(e: CustomEvent<{ ids: string[] }>) => { r.apply(e.detail.ids); this.picker = { ...r, selected: e.detail.ids }; }}
        @picker-done=${() => (this.picker = null)}></automation-entity-picker>`;
  }

  protected banners(): Banner[] {
    const out: Banner[] = [];
    const s = this.status;
    if (!s || !this.env) return out;
    if (this.hardReadOnly) out.push({ id: 'readonly', tone: 'info', icon: 'eye', title: this.roText });
    const sb = !this.hardReadOnly ? saveBlocker(this.kind, s) : null;
    if (sb && sb.code === 'delegation_off') out.push({ id: 'delegation', tone: 'warn', icon: 'info', title: 'שמירה דורשת מנהל', sub: 'אפשר לערוך ולבדוק; השמירה תתאפשר אחרי שמנהל יאשר זאת בתשתית המערכת.' });
    else if (sb && sb.code !== 'no_permission') out.push({ id: 'blocked', tone: 'warn', icon: 'info', title: sb.text });
    const mg = this.missingGrants[0];
    if (mg && !this.hardReadOnly) out.push({ id: 'grant', tone: 'warn', icon: 'alarm', title: `${grantText(mg.action, this.env.ctx.names!(mg.entity_id))}. השמירה תיחסם עד שהצעד יוסר או שתקבל את ההרשאה.` });
    const p = this.freshPreview;
    if (p && !this.hardReadOnly && !sb) {
      const pb = previewSaveBlocker(p, s);
      if (pb && pb.code !== 'invalid') out.push({ id: pb.code, tone: 'warn', icon: 'lock', title: pb.text });
    }
    if (this.saveError) out.push({ id: 'error', tone: 'bad', icon: 'warning', title: this.saveError });
    return out;
  }

  protected renderBanners() {
    return this.banners().map((b) => html`<div class="banner ${b.tone}" role=${b.tone === 'bad' ? 'alert' : 'status'} data-banner=${b.id}>${icon(b.icon)}<div class="t"><b>${b.title}</b>${b.sub ? html`<small>${b.sub}</small>` : nothing}</div></div>`);
  }

  protected renderConflict() {
    const c = this.conflict;
    if (!c) return nothing;
    return html`<div class="banner" role="alert" data-banner="conflict">${icon('warning')}<div class="t"><b>הפריט שונה במקום אחר לפני רגע</b><small>נשמרה גרסה חדשה. מה לעשות עם השינויים שלך?</small>
      <div class="acts">
        <button class="btn sm" type="button" data-conflict="reload" @click=${() => this.reloadTheirs()}>${icon('history')}טען את החדש</button>
        <button class="btn sm" type="button" data-conflict="compare" @click=${() => (this.dialog = 'compare')}>${icon('copy')}השווה</button>
        <button class="btn sm primary" type="button" data-conflict="mine" @click=${() => this.keepMine()}>שמור את שלי</button>
      </div></div></div>`;
  }

  protected renderSentence() {
    if (!this.draft || !this.env) return nothing;
    const text = this.freshPreview?.sentence ?? draftSentence(this.kind, this.draft, this.env.ctx);
    const n = this.preview?.sensitive_steps.length ?? 0;
    return html`<div class="sentbox" data-sentence>${icon('bolt')}<div>${text}${n && this.env.sensitiveWarning ? html`<small>${icon('alarm', 12)}כולל ${n === 1 ? 'פעולה רגישה אחת' : `${n} פעולות רגישות`} – נבדקות כמו שליטה ידנית</small>` : nothing}</div></div>`;
  }

  protected renderValidation() {
    if (!this.draft || !this.touched) return nothing;
    const issues = this.issues;
    if (!issues.length) return nothing;
    return html`<div class="valbox" role="alert" data-validation><b>${icon('warning')}${issues.length === 1 ? 'דבר אחד לתקן' : `${issues.length} דברים לתקן`}</b>
      ${issues.map((i) => { const l = issueLine(i); return html`<button type="button" data-goto=${i.path} @click=${() => this.goto(i.path)}><span>${l.where} ·</span> ${l.what}</button>`; })}</div>`;
  }

  protected renderCodeView() {
    if (!this.draft) return nothing;
    const ds = this.status ? delegationState(this.status) : { state: 'not_needed' as const };
    const parsed = scanJson(this.codeText);
    let needsAdmin = false;
    if (parsed.ok && typeof parsed.value === 'object' && parsed.value !== null && !Array.isArray(parsed.value) && this.env) {
      const d = configToDraft(this.kind, parsed.value, this.env.ctx).draft;
      needsAdmin = saveRoute(this.isNew, d, this.storedDraft) === 'code';
    }
    return html`<automation-code .value=${this.codeText} .locked=${this.lockedFps} ?readonly=${this.codeMode === 'readonly'} @code-input=${this.onCode}>
      <span slot="chips" class="tag ${needsAdmin && ds.state !== 'not_needed' ? 'warn' : 'ok'}">${needsAdmin && ds.state !== 'not_needed' ? 'שמירת תוכן שאינו מהבונה – מנהל בלבד' : 'מנהל · הכל ניתן לשמירה'}</span>
      <span slot="note">${icon('info')} שינוי כאן מתורגם לבלוקים; מה שהבונה לא מכיר נשאר נעול.</span>
    </automation-code>`;
  }

  protected renderHeader(): TemplateResult {
    const dd = this.draft as unknown as Record<string, unknown> | null;
    const name = dd ? String(('alias' in dd ? dd.alias : dd.name) ?? '') : '';
    const pl = this.draft && this.env ? placeChips(this.item, this.draft, this.env) : { floors: '', areas: '', more: 0 };
    const sub = this.isNew ? (this.templateName ? `מתבנית "${this.templateName}"` : this.subtitleNew()) : null;
    const cm = this.codeMode;
    const seg = cm !== 'hidden' ? html`<div class="seg top" role="tablist" aria-label="תצוגה" data-view-toggle>
      <button type="button" role="tab" aria-selected=${this.view === 'builder'} data-view="builder" @click=${() => this.setView('builder')}>${icon('blocks')}בונה</button>
      <button type="button" role="tab" aria-selected=${this.view === 'code'} data-view="code" @click=${() => this.setView('code')}>${icon('code')}קוד</button></div>` : nothing;
    const on = this.item ? this.item.state !== 'off' : true;
    const tgl = this.kind === 'automation' && !this.isNew && this.item?.can.toggle && !this.hardReadOnly
      ? html`<sw-toggle class="tgl" labelHidden label="פעילה" .checked=${on} ?disabled=${this.busy !== ''} data-enable-toggle @change=${(e: CustomEvent<{ checked: boolean }>) => void this.toggleEnabled(e.detail.checked)}></sw-toggle>` : nothing;
    return html`<div class="grab" aria-hidden="true"></div>
      <header class="shh">
        <button class="bk" type="button" aria-label="סגירה" data-editor-close @click=${() => this.requestCancel()}>${icon('chevron')}</button>
        <div class="tx">
          <input class="namein" data-name-input aria-label=${this.nameLabel} placeholder=${this.nameLabel} .value=${name} ?disabled=${this.hardReadOnly} @input=${(e: Event) => this.setName((e.target as HTMLInputElement).value)} />
          <small>${sub ?? html`${pl.floors ? html`${icon('layers', 13)}<span>${pl.floors}</span>` : nothing}${pl.areas ? html`<span>${pl.areas}${pl.more ? ` ${pl.more}+` : ''}</span>` : nothing}`}</small>
        </div>
        ${seg}${tgl}
      </header>
      ${cm !== 'hidden' ? html`<div class="shsub">${seg}</div>` : nothing}`;
  }

  protected setName(v: string) {
    if (!this.draft) return;
    const d = clone(this.draft) as unknown as Record<string, unknown>;
    if ('alias' in d) d.alias = v; else d.name = v;
    this.change(d as unknown as AnyDraft);
  }

  protected renderFooter(): TemplateResult {
    const gate = this.saveGate;
    const sug = this.kind === 'automation' && this.view === 'builder' && this.status?.scheduler_present && this.draft ? this.suggestion() : null;
    return html`<footer class="shf">
      ${this.kind === 'automation' && this.view === 'builder' ? html`<button class="btn" type="button" data-dry-run ?disabled=${!!this.busy || this.phase !== 'ready'} @click=${() => void this.dryRun()}>${icon('flask')}בדיקה</button>` : nothing}
      ${!this.isNew && this.kind !== 'scene' && this.item?.can.run ? html`<button class="btn" type="button" data-run-now ?disabled=${!!this.busy} @click=${() => void this.runNow()}>${icon('play')}הרץ עכשיו</button>` : nothing}
      ${this.footerExtras()}
      ${sug ? html`<button class="sugg" type="button" data-suggest-schedule @click=${() => { this.suggestDraft = sug.schedule_draft; this.dialog = 'suggest'; }}>${icon('calendar')}צור כתזמון</button>` : nothing}
      <span class="sp"></span>
      <button class="btn quiet" type="button" data-editor-cancel @click=${() => this.requestCancel()}>ביטול</button>
      <button class="btn primary" type="button" data-editor-save title=${gate?.text ?? ''} ?disabled=${!!gate} @click=${() => void this.save()}>${icon('check')}${this.busy === 'save' ? 'שומר…' : 'שמירה'}</button>
    </footer>${this.note ? html`<div class="runnote" role="status" data-note>${this.note}</div>` : nothing}`;
  }

  private suggestion(): { schedule_draft: unknown } | null {
    const p = this.freshPreview?.suggest_schedule ?? null;
    if (p) return p;
    if (!this.draft || !this.env || this.freshPreview) return null;
    return suggestSchedule(this.draft as AutomationDraft, { schedulerPresent: true, shabbatSensor: this.env.catalog.shabbat_sensor, classOf: (id) => this.env!.byId.get(id)?.class ?? null });
  }

  protected renderOptionsBox(extra: TemplateResult | typeof nothing = nothing) {
    const d = this.draft as unknown as { mode?: string; max?: number | null; description?: string } | null;
    if (!d || d.mode === undefined) return nothing;
    return html`<details class="opts" ?open=${this.optionsOpen} @toggle=${(e: Event) => (this.optionsOpen = (e.target as HTMLDetailsElement).open)} data-options>
      <summary>${icon('chevronDown')}אפשרויות · ${MODE_SUMMARY[d.mode] ?? ''}</summary>
      <div class="opts-wrap" ?inert=${this.hardReadOnly}>
        <div class="frow">
          <div class="fld"><label>אם מופעלת שוב בזמן ריצה</label><select class="selx" data-fld="mode" aria-label="מצב" @change=${(e: Event) => this.setField('mode', (e.target as HTMLSelectElement).value)}>
            ${(['single', 'restart', 'queued', 'parallel'] as const).map((m) => html`<option value=${m} ?selected=${d.mode === m}>${MODE_LABEL[m]}</option>`)}</select></div>
          ${d.mode === 'queued' || d.mode === 'parallel' ? html`<div class="fld sm"><label>מקסימום</label><label class="inp"><input class="n" data-fld="max" type="text" inputmode="numeric" aria-label="מקסימום" .value=${d.max == null ? '' : String(d.max)} @change=${(e: Event) => { const n = parseInt((e.target as HTMLInputElement).value, 10); this.setField('max', Number.isFinite(n) && n > 0 ? n : null); }} /></label></div>` : nothing}
        </div>
        <div class="fld full"><label>תיאור</label><label class="inp"><input data-fld="description" aria-label="תיאור" placeholder="לא חובה" .value=${d.description ?? ''} @input=${(e: Event) => this.setField('description', (e.target as HTMLInputElement).value)} /></label></div>
        ${extra}
      </div>
    </details>`;
  }
  protected setField(key: string, value: unknown) {
    if (!this.draft) return;
    const d = clone(this.draft) as unknown as Record<string, unknown>;
    d[key] = value;
    this.change(d as unknown as AnyDraft);
  }

  protected renderDeleteRow() {
    if (this.isNew || !this.item?.can.delete || this.hardReadOnly) return nothing;
    return html`<div class="frow"><button class="btn sm danger" type="button" data-editor-delete @click=${() => (this.dialog = 'delete')}>${icon('trash')}מחיקה</button></div>`;
  }

  // ------------------------------------------------------------------------------------------------ dialogs

  protected renderDialogs() {
    const d = this.dialog;
    const name = this.item?.name || (this.draft as { alias?: string } | null)?.alias || '';
    const close = this.dialogClosed;
    return html`
      <sw-dialog heading="לצאת בלי לשמור?" ?open=${d === 'discard'} @close=${close}>
        <div class="dlg-body">השינויים שעשיתם לא יישמרו.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" data-discard="keep" @click=${() => (this.dialog = null)}>המשך עריכה</button><button class="btn danger" type="button" data-discard="leave" @click=${() => this.cancel()}>צא בלי לשמור</button></div>
      </sw-dialog>
      <sw-dialog heading="לשמור?" ?open=${d === 'confirm-save'} @close=${close}>
        <div class="dlg-body">כולל פעולה מתקדמת שהמערכת לא יודעת לתאר – ${name ? `"${name}"` : 'הפריט'} עלול לשנות מכשירים נוספים.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${() => (this.dialog = null)}>ביטול</button><button class="btn primary" type="button" data-confirm-save @click=${() => void this.save(true)}>שמירה</button></div>
      </sw-dialog>
      <sw-dialog heading="להריץ עכשיו?" ?open=${d === 'run'} @close=${close}>
        <div class="dlg-body" data-run-confirm>${this.item?.sensitive ? 'כולל פעולה רגישה – נבדקת כמו שליטה ידנית.' : 'כולל פעולה מתקדמת שהמערכת לא יודעת לתאר.'}${this.dirty ? ' ההרצה תתבצע על הגרסה השמורה.' : ''}</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${() => (this.dialog = null)}>ביטול</button><button class="btn primary" type="button" data-run-confirm-ok @click=${() => void this.runNow(true)}>הרץ</button></div>
      </sw-dialog>
      <sw-dialog heading="להפעיל?" ?open=${d === 'enable'} @close=${close}>
        <div class="dlg-body">כולל פעולה מתקדמת שהמערכת לא יודעת לתאר.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${() => (this.dialog = null)}>ביטול</button><button class="btn primary" type="button" @click=${() => void this.toggleEnabled(true, true)}>הפעל</button></div>
      </sw-dialog>
      <sw-dialog heading="למחוק?" ?open=${d === 'delete'} @close=${close}>
        <div class="dlg-body">${name ? `"${name}"` : 'הפריט'} יועבר לסל המחזור, ואפשר לשחזר אותו משם.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${() => (this.dialog = null)}>ביטול</button><button class="btn danger" type="button" data-delete-confirm @click=${() => void this.deleteNow()}>מחיקה</button></div>
      </sw-dialog>
      <sw-dialog heading="בדיקה · בלי להפעיל כלום" ?open=${d === 'dry'} @close=${close}>
        ${this.dryResult ? html`<div class="dlg-body" data-dry-result>
          ${this.dryResult.conditions.length ? html`<h5>תנאים עכשיו</h5>${this.dryResult.conditions.map((c) => html`<div class="kvrow"><span>${c.sentence}</span>${c.passed === null ? html`<span>לא ניתן לבדוק</span>` : c.passed ? html`<span class="ok">מתקיים</span>` : html`<span class="bad">לא מתקיים</span>`}</div>`)}` : nothing}
          <h5>מה יקרה</h5>
          ${this.dryResult.effects.entities.length ? this.dryResult.effects.entities.map((e) => html`<div class="kvrow"><span>${e.name}</span><span>${e.from ? `${e.from} → ` : ''}${e.to ?? ''}</span></div>`) : html`<div class="kvrow"><span>לא ידוע אילו מכשירים ישתנו</span></div>`}
          ${this.dryResult.effects.unknown ? html`<div class="kvrow"><span>כולל פעולה מתקדמת</span></div>` : nothing}
        </div>` : nothing}
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%">
          ${!this.isNew && this.kind === 'automation' && this.item?.can.run ? html`<button class="btn" type="button" data-dry-run-then @click=${() => { this.dialog = null; void this.runNow(!(this.item && runNeedsConfirm(this.item)), false); }}>${icon('play')}בדוק תנאים ואז הרץ</button>` : nothing}
          <button class="btn primary" type="button" data-dry-close @click=${() => (this.dialog = null)}>סגירה</button></div>
      </sw-dialog>
      <sw-dialog heading="השוואה" subheading="שלי מול הגרסה החדשה" ?open=${d === 'compare'} @close=${close}>${this.renderCompare()}
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${() => (this.dialog = null)}>סגירה</button></div>
      </sw-dialog>
      <sw-dialog heading="ליצור כתזמון?" ?open=${d === 'suggest'} @close=${close}>
        <div class="dlg-body" data-suggest-body>"${name || 'האוטומציה'}" היא שעון + שליטה במכשירים – בתזמונים זה פשוט יותר. חלון התזמון ייפתח עם הנתונים שכבר הזנתם.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" data-suggest-no @click=${() => (this.dialog = null)}>השאר אוטומציה</button><button class="btn primary" type="button" data-suggest-yes @click=${() => this.openSchedule()}>פתח תזמון חדש</button></div>
      </sw-dialog>`;
  }

  private renderCompare() {
    if (!this.conflict || !this.draft || !this.env || this.dialog !== 'compare') return nothing;
    const rows = diffDrafts(this.kind, this.draft, this.conflict.draft, this.env.ctx);
    if (!rows.length) return html`<div class="dlg-body">אין הבדלים בתוכן.</div>`;
    return html`<div class="diff" data-compare><span class="h"></span><span class="h">שלי</span><span class="h">החדש</span>
      ${rows.map((r) => html`<span class="g">${r.group}</span><span class="c mine">${r.mine}</span><span class="c">${r.theirs}</span>`)}</div>`;
  }

  private openSchedule() {
    const draft = this.suggestDraft;
    this.dialog = null;
    if (!draft) { this.note = 'לא ניתן לפתוח את התזמונים כרגע'; return; }
    try {
      sessionStorage.setItem(NEW_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      this.note = 'לא ניתן לפתוח את התזמונים כרגע';
      return;
    }
    this.emit('cancel', { reason: 'schedule' });
    this.closeSelf();
    navigate('/devices/schedules/new/edit', { draft: '1' });
  }

  // ------------------------------------------------------------------------------------------------ the sheet

  protected renderBody(): TemplateResult {
    if (this.phase === 'loading') return html`<div class="state-box" data-editor-state="loading"><b>טוען…</b></div>`;
    if (this.phase === 'error' && this.loadDenied) return html`<div class="state-box err" data-editor-state="forbidden"><b>${this.loadError}</b></div>`;
    if (this.phase === 'error') return html`<div class="state-box err" data-editor-state="error"><b>לא הצלחנו לטעון</b><span>${this.loadError}</span><button class="btn" type="button" @click=${() => void this.init()}>${icon('refresh')}נסו שוב</button></div>`;
    return this.view === 'code'
      ? html`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderCodeView()}`
      : this.renderBuilderBody();
  }

  render() {
    const ready = this.phase === 'ready' && this.draft;
    return html`<dialog class="sheet" tabindex="-1" autofocus aria-label=${this.nameLabel} @cancel=${this.onSheetCancel} @keydown=${this.onSheetKey} @dragend=${this.onDragEnd}>
      ${this.stage === 'templates' && ready ? this.renderGalleryShell() : html`${this.renderHeader()}
        <div class="shb" id="shb" data-editor-body data-view=${this.view}>${this.renderBody()}</div>
        ${ready ? this.renderFooter() : html`<footer class="shf"><span class="sp"></span><button class="btn quiet" type="button" @click=${() => this.cancel()}>סגירה</button></footer>`}
        ${this.renderTypePop()}${this.renderPicker()}`}
      ${this.renderDialogs()}
    </dialog>`;
  }

  protected renderGalleryShell(): TemplateResult {
    return html`<div class="grab" aria-hidden="true"></div>
      <header class="shh"><div class="tx"><h3>אוטומציה חדשה</h3><small>מתבנית או מאפס</small></div>
        <button class="bk" type="button" aria-label="סגירה" data-editor-close @click=${() => this.cancel()}>${icon('close')}</button></header>
      <div class="shb" data-editor-body data-stage="templates"><automation-templates .enabled=${this.status?.ui.templates_enabled !== false} @template-pick=${(e: CustomEvent<{ template: AutomationTemplate | null }>) => this.adoptTemplate(e.detail.template)}></automation-templates></div>`;
  }

  /** A template becomes the draft (fresh uids; the pickers stay empty: nothing is saved without review), or the blank draft when `t` is null. */
  protected adoptTemplate(t: AutomationTemplate | null) {
    this.stage = 'edit';
    if (!t || !this.env) return;
    const d = freshDraftUids(clone(t.draft as AnyDraft));
    refreshSentences(d, this.env.ctx);
    this.draft = d; this.templateName = t.name; this.touched = true; this.version++; this.schedulePreview(0);
  }
}
