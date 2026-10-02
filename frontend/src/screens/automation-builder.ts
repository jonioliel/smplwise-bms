import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { AutomationDraft } from '../api/automations';
import { icon } from './automation-builder-icons';
import { AutomationEditorBase } from './automation-editor-base';
import { ROOT } from './automation-editor-logic';

/**
 * CR-017 S4: the automation builder (CR §4.2.1; mockups 14-33): the three stacked sections כאשר · אם · אז with a block card per trigger, condition
 * and step (typed forms, locked blocks shown / movable / deletable, nested lists for if / choose / repeat / groups), the live Hebrew sentence of the
 * whole automation, templates for a new one, the "בונה · קוד" toggle (only with `automation.code_view`), validation by block path, dry-run,
 * run-now, the "צור כתזמון" suggestion, the conflict banner and the unsaved guard. Everything shared with the script and scene editors is in
 * automation-editor-base.ts, which documents the interface S3 mounts:
 *
 *   <automation-builder .itemId=${id} .mode=${'edit' | 'create'} @saved @cancel @deleted></automation-builder>
 */
@customElement('automation-builder')
export class AutomationBuilder extends AutomationEditorBase {
  protected get kind() { return 'automation' as const; }
  protected get nameLabel() { return 'שם האוטומציה'; }
  protected get startsWithGallery() { return true; }
  protected subtitleNew() { return 'אוטומציה חדשה'; }
  protected blankDraft(): AutomationDraft {
    return { alias: '', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] };
  }

  protected renderBuilderBody() {
    const d = this.draft as AutomationDraft;
    const t = d.triggers.length;
    return html`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="trigger">
        <h4><span class="k when">${icon('bolt', 14)}</span>כאשר<small>${t === 0 ? 'מה מפעיל' : t === 1 ? 'טריגר אחד' : `${t} טריגרים · אחד מהם מספיק`}</small></h4>
        ${this.renderList(ROOT, 'triggers', 'trigger')}
      </section>
      <section class="bsec2" data-section="condition">
        <h4><span class="k if">${icon('question', 14)}</span>אם<small>${d.conditions.length ? 'כל התנאים צריכים להתקיים' : 'לא חובה'}</small></h4>
        ${this.renderList(ROOT, 'conditions', 'condition')}
      </section>
      <section class="bsec2" data-section="action">
        <h4><span class="k then">${icon('play', 14)}</span>אז<small>${d.actions.length ? `${d.actions.length} צעדים, לפי הסדר` : 'מה לעשות'}</small></h4>
        ${this.renderList(ROOT, 'actions', 'action')}
      </section>
      ${this.renderOptionsBox(this.renderDeleteRow() ?? nothing)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'automation-builder': AutomationBuilder;
  }
}
