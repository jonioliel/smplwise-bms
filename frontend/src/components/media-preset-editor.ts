import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-button';
import { ApiError } from '../api/client';
import { players, playerErrorText, type GroupPreset, type PlayerDevice } from '../api/media-players';
import { bidi } from '../i18n/bidi';
import {
  NEW_PRESET, PRESET_NAME_MAX, parseCeiling, presetCandidates, presetDraftError, presetVolumes,
  type PresetDraft,
} from '../screens/multimedia-players-layout';

/** A saved group as the editor starts from it (`NEW_PRESET` for a new one). */
export const draftOf = (p: GroupPreset | null): PresetDraft =>
  p ? { id: p.id, revision: p.revision, name: p.name, leader_key: p.leader_key, member_keys: [...new Set([p.leader_key, ...p.member_keys])], volumes: p.volumes ? { ...p.volumes } : null } : { ...NEW_PRESET };

/**
 * CR-016: the editor of a SAVED GROUP ("סלון + מטבח": a name, the rooms, who leads, optional volumes) - one dialog shared by the
 * groups page (media.layout holders) and הגדרות › מולטימדיה › קבוצות שמורות. The rooms are the approved devices with live grouping in
 * their last known mask; once one is ticked only rooms of the SAME grouping layer stay selectable (never a mix, CR §5.3). The
 * volumes are optional: a field left empty leaves that room's volume alone. Saving is one request (create / save with the
 * revision: a 409 `revision_conflict` says the group was edited elsewhere); the dialog closes on success and raises `preset-saved`.
 * Short wording, no hint paragraphs; every control is a 44 px target.
 *   <media-preset-editor .devices=${devices} @preset-saved=${...}></media-preset-editor>   el.show(draftOf(preset))
 */
@customElement('media-preset-editor')
export class MediaPresetEditor extends LitElement {
  @property({ attribute: false }) devices: PlayerDevice[] = [];
  @state() private open = false;
  @state() private draft: PresetDraft = { ...NEW_PRESET };
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    .ed {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: var(--sw-fs-sm);
    }
    input[type='text'],
    input[type='number'] {
      box-sizing: border-box;
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 10px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    input[type='text'] {
      inline-size: 100%;
    }
    input[type='number'] {
      inline-size: 84px;
      min-block-size: 40px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 300px;
      overflow: auto;
    }
    .row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 10px;
      min-block-size: 48px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border);
      border-radius: 12px;
    }
    .row.off {
      opacity: 0.5;
    }
    .row input[type='checkbox'] {
      inline-size: 22px;
      block-size: 22px;
      accent-color: var(--sw-accent);
    }
    .row .nm {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .row .nm b {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .nm small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .lead {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-block-size: 44px;
    }
    .lead input {
      inline-size: 20px;
      block-size: 20px;
      accent-color: var(--sw-accent);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .why {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding-block-start: 4px;
    }
  `;

  /** Opens the editor on a draft (`draftOf(preset)` / `draftOf(null)`). */
  show(draft: PresetDraft) {
    this.draft = { ...draft, member_keys: [...draft.member_keys], volumes: draft.volumes ? { ...draft.volumes } : null };
    this.error = '';
    this.busy = false;
    this.open = true;
  }

  private set(patch: Partial<PresetDraft>) {
    this.draft = { ...this.draft, ...patch };
    this.error = '';
  }

  private toggle(key: string, on: boolean) {
    const d = this.draft;
    const members = on ? [...new Set([...d.member_keys, key])] : d.member_keys.filter((k) => k !== key);
    const leader = members.includes(d.leader_key) ? d.leader_key : members[0] ?? '';
    this.set({ member_keys: members, leader_key: leader, volumes: presetVolumes({ leader_key: leader, member_keys: members, volumes: d.volumes }) });
  }

  private setVolume(key: string, raw: string) {
    const n = parseCeiling(raw);
    const vols = { ...(this.draft.volumes ?? {}) };
    if (n === null || n === 'invalid') delete vols[key];
    else vols[key] = n;
    this.set({ volumes: Object.keys(vols).length ? vols : null });
  }

  private async save() {
    const d = this.draft;
    const bad = presetDraftError(d);
    if (bad) {
      this.error = bad;
      return;
    }
    this.busy = true;
    const body = { name: d.name.trim(), leader_key: d.leader_key, member_keys: d.member_keys, volumes: presetVolumes(d) };
    try {
      const saved = d.id ? await players().savePreset(d.id, body, d.revision) : await players().createPreset(body);
      this.open = false;
      this.busy = false;
      this.dispatchEvent(new CustomEvent('preset-saved', { detail: saved, bubbles: true, composed: true }));
    } catch (err) {
      this.error = playerErrorText(err);
      this.busy = false;
      if (err instanceof ApiError && err.code === 'revision_conflict') this.dispatchEvent(new CustomEvent('preset-stale', { bubbles: true, composed: true }));
    }
  }

  render() {
    if (!this.open) return html`<sw-dialog data-preset-editor="closed"></sw-dialog>`;
    const d = this.draft;
    const cands = presetCandidates(this.devices, d.member_keys);
    const problem = presetDraftError(d);
    return html`<sw-dialog open ?locked=${this.busy} heading=${d.id ? 'עריכת קבוצה שמורה' : 'קבוצה שמורה חדשה'} data-preset-editor="open" @close=${() => (this.open = false)}>
      <div class="ed">
        <input type="text" data-pe-name maxlength=${PRESET_NAME_MAX} placeholder="שם הקבוצה" aria-label="שם הקבוצה" .value=${d.name} @input=${(e: Event) => this.set({ name: (e.target as HTMLInputElement).value })} />
        <div class="list" role="group" aria-label="חדרים">
          ${repeat(cands, (c) => c.device.key, ({ device: x, disabled }) => {
            const on = d.member_keys.includes(x.key);
            const place = [x.area_name, x.floor_name].filter(Boolean).join(' · ') || 'ללא חדר';
            return html`<div class=${disabled ? 'row off' : 'row'} data-pe-row=${x.key}>
              <input type="checkbox" .checked=${on} ?disabled=${disabled} aria-label=${x.name} @change=${(e: Event) => this.toggle(x.key, (e.target as HTMLInputElement).checked)} />
              <span class="nm"><b>${bidi(x.name)}</b><small>${bidi(place)}${x.live.power === 'unavailable' ? ' · לא זמין' : ''}</small></span>
              ${on ? html`<label class="lead"><input type="radio" name="lead" .checked=${d.leader_key === x.key} @change=${() => this.set({ leader_key: x.key })} />מוביל</label>
                <input type="number" min="0" max="100" data-pe-vol=${x.key} placeholder="עוצמה" aria-label=${`עוצמה · ${x.name}`} .value=${d.volumes?.[x.key] === undefined ? '' : String(d.volumes[x.key])} @change=${(e: Event) => this.setVolume(x.key, (e.target as HTMLInputElement).value)} />` : nothing}
            </div>`;
          })}
        </div>
        ${this.error ? html`<div class="err" role="alert" data-pe-error>${this.error}</div>` : problem && d.name ? html`<div class="why" data-pe-why>${problem}</div>` : nothing}
        <div class="actions"><sw-button data-pe-cancel ?disabled=${this.busy} @click=${() => (this.open = false)}>ביטול</sw-button><sw-button variant="primary" data-pe-save ?disabled=${this.busy || !!problem} @click=${() => void this.save()}>שמור</sw-button></div>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-preset-editor': MediaPresetEditor;
  }
}
