import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SCENE_CAPTURE_DOMAINS, automationErrorText, automations, memberSummary, type SceneDraft, type SceneMember } from '../api/automations';
import { icon } from './automation-builder-icons';
import { AutomationEditorBase } from './automation-editor-base';
import { CAPTURE_DOMAIN_LABEL, clone, entityIcon, memberFields, memberNumber, setMemberField, type MemberField } from './automation-editor-logic';

/**
 * CR-017 S4: the scene editor (CR §4.3): the members of a scene and the values of each, as a table; "צלם מצב נוכחי" reads the current state of the
 * chosen devices (the server keeps per-domain attributes only) and every value stays editable before saving. Scenes of a device or hub are
 * activate-only: the editor opens them read-only. The capture table that S3 opens from the scenes grid is S3's; this is the full editor.
 *
 *   <scene-editor .itemId=${id} .mode=${'edit' | 'create'} @saved @cancel @deleted></scene-editor>
 */
@customElement('scene-editor')
export class SceneEditor extends AutomationEditorBase {
  protected get kind() { return 'scene' as const; }
  protected get nameLabel() { return 'שם הסצנה'; }
  protected get codeToggle() { return false; }
  protected subtitleNew() { return 'סצנה חדשה'; }
  protected blankDraft(): SceneDraft { return { name: '', icon: null, members: [] }; }

  static styles = [
    ...AutomationEditorBase.styles,
    css`
      .members {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mrow {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        padding: 10px 10px 10px 8px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
      }
      .mrow.bad {
        border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
      }
      .mrow .who {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1 1 180px;
        min-inline-size: 0;
      }
      .mrow .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        font-size: 16px;
        flex: none;
      }
      .mrow .nm {
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-size: 14px;
        font-weight: 600;
        min-inline-size: 0;
      }
      .mrow .nm small {
        font-size: 11.5px;
        font-weight: 500;
        color: var(--dv-text-2);
      }
      .mrow .vals {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: flex-end;
        flex: 2 1 220px;
      }
      .mrow .vals .fld {
        flex: 1 1 110px;
      }
      .mrow .x {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--dv-text-3);
        display: grid;
        place-items: center;
        font-size: 16px;
      }
      .mrow .x:hover {
        background: var(--dv-surface-3);
        color: var(--dv-danger);
      }
      .mrow .sum {
        flex: 1 1 100%;
        font-size: 12px;
        color: var(--dv-text-2);
      }
      .empty {
        padding: 22px 12px;
        text-align: center;
        color: var(--dv-text-2);
        border: 1.5px dashed var(--dv-border-strong);
        border-radius: var(--dv-radius-sm, 14px);
        font-weight: 600;
      }
    `,
  ];

  private members(): SceneMember[] { return (this.draft as SceneDraft).members; }
  private setMembers(fn: (m: SceneMember[]) => SceneMember[]) {
    if (!this.draft) return;
    const d = clone(this.draft) as SceneDraft;
    d.members = fn(d.members);
    this.change(d);
  }

  /** The picker applied a new selection: removed devices go, new ones are added and their current state is captured. */
  private applyPicked(ids: string[]) {
    const have = new Set(this.members().map((m) => m.entity_id));
    const added = ids.filter((i) => !have.has(i));
    this.setMembers((l) => [...l.filter((m) => ids.includes(m.entity_id)), ...added.map((id): SceneMember => ({ entity_id: id, state: memberFields(id)[0].options?.[0].value ?? 'on', attributes: {} }))]);
    if (added.length) void this.capture(added);
  }

  private async capture(ids: string[]) {
    try {
      const r = await automations().capture({ entity_ids: ids });
      this.setMembers((l) => l.map((m) => r.members.find((x) => x.entity_id === m.entity_id) ?? m));
    } catch (e) {
      this.saveError = automationErrorText(e);
    }
  }

  private field(m: SceneMember, f: MemberField) {
    if (f.kind === 'select') {
      return html`<div class="fld"><label>${f.label}</label><select class="selx" data-fld=${`${m.entity_id}.${f.key}`} aria-label=${f.label} @change=${(e: Event) => this.setMembers((l) => l.map((x) => (x.entity_id === m.entity_id ? setMemberField(x, f, (e.target as HTMLSelectElement).value) : x)))}>
        ${(f.options?.some((o) => o.value === m.state) ? f.options : [...(f.options ?? []), { value: m.state, label: m.state }]).map((o) => html`<option value=${o.value} ?selected=${o.value === m.state}>${o.label}</option>`)}</select></div>`;
    }
    const v = memberNumber(m, f);
    return html`<div class="fld"><label>${f.label}</label><label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${`${m.entity_id}.${f.key}`} aria-label=${f.label} .value=${v === null ? '' : String(v)}
      @change=${(e: Event) => { const t = (e.target as HTMLInputElement).value.trim().replace(',', '.'); const n = t === '' ? null : Number(t); const c = n === null || !Number.isFinite(n) ? null : f.min !== undefined && n < f.min ? f.min : f.max !== undefined && n > f.max ? f.max : n; this.setMembers((l) => l.map((x) => (x.entity_id === m.entity_id ? setMemberField(x, f, c) : x))); }} />${f.unit ? html`<span class="u">${f.unit}</span>` : nothing}</label></div>`;
  }

  private row(m: SceneMember, i: number) {
    const e = this.env!.byId.get(m.entity_id);
    const bad = this.issues.some((x) => x.path === `members.${i}`);
    const fields = memberFields(m.entity_id).filter((f) => f.key === 'state' || !f.only || (f.only === 'on' && m.state === 'on')).filter((f) => f.key === 'state' || m.state !== 'off');
    return html`<div class="mrow ${bad ? 'bad' : ''}" data-member=${m.entity_id}>
      <div class="who"><span class="rg">${icon(entityIcon(m.entity_id))}</span><span class="nm">${this.env!.ctx.names!(m.entity_id)}<small>${[CAPTURE_DOMAIN_LABEL[m.entity_id.split('.')[0]], e?.area?.name].filter(Boolean).join(' · ')}</small></span></div>
      <div class="vals">${fields.map((f) => this.field(m, f))}</div>
      ${this.hardReadOnly ? nothing : html`<button class="x" type="button" aria-label=${`הסרת ${this.env!.ctx.names!(m.entity_id)}`} data-member-remove=${m.entity_id} @click=${() => this.setMembers((l) => l.filter((x) => x.entity_id !== m.entity_id))}>${icon('close')}</button>`}
      <span class="sum">${memberSummary(m)}</span>
    </div>`;
  }

  protected renderBuilderBody() {
    const d = this.draft as SceneDraft;
    const env = this.env!;
    return html`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="members">
        <h4><span class="k when">${icon('light', 14)}</span>מכשירים<small>${d.members.length ? d.members.length : 'בחרו מכשירים'}</small></h4>
        <div class="members">${d.members.length ? d.members.map((m, i) => this.row(m, i)) : html`<div class="empty" data-members-empty>עדיין לא נבחרו מכשירים</div>`}</div>
        ${this.hardReadOnly ? nothing : html`<div class="frow">
          <button class="btn" type="button" data-scene-add @click=${() => { this.picker = { uid: 'scene', filter: { purpose: 'target', controllable: true, domains: [...SCENE_CAPTURE_DOMAINS] }, selected: d.members.map((m) => m.entity_id), multi: true, apply: (ids) => this.applyPicked(ids) }; this.pop = null; }}>${icon('plus')}הוסף מכשירים</button>
          <button class="btn" type="button" data-scene-capture ?disabled=${!d.members.length} @click=${() => void this.capture(d.members.map((m) => m.entity_id))}>${icon('camera')}צלם מצב נוכחי</button>
        </div>`}
      </section>
      ${env && !this.isNew ? this.renderDeleteRow() : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scene-editor': SceneEditor;
  }
}
