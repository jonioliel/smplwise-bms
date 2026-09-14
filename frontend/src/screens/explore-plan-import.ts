import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-steps';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-icon';

const STEPS = ['קובץ', 'עמוד', 'חיתוך וסיבוב', 'שם וקומה', 'כיול', 'שמירה'];

/** SC05 — plan import (board 2 screen 13): PDF/PNG → page → crop/rotate → name → optional calibration → draft. */
@customElement('explore-plan-import')
export class ExplorePlanImport extends LitElement {
  @state() private step = 2;

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .stage {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: var(--sw-s-4);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sw-s-3);
    }
    .pane {
      aspect-ratio: 4 / 3;
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      position: relative;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
    }
    .pane .lbl {
      position: absolute;
      inset-block-start: var(--sw-s-2);
      inset-inline-start: var(--sw-s-2);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      color: var(--sw-text-2);
    }
    .crop {
      position: absolute;
      inset: 14% 10%;
      border: 2px dashed var(--sw-accent);
      border-radius: 4px;
    }
    .crop i {
      position: absolute;
      inline-size: 10px;
      block-size: 10px;
      background: var(--sw-accent);
      border-radius: 2px;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .row {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 1023px) {
      .layout,
      .stage {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    return html`
      <sw-page heading="ייבוא תוכנית לקומה 2-" subheading="המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת · נתוני הדגמה">
        <sw-steps .steps=${STEPS} .current=${this.step}></sw-steps>
        <div class="layout">
          <div class="stage">
            <div class="pane">
              <span class="lbl">מקור: קומה -2.pdf · עמוד 1 · A4 לרוחב</span>
              <sw-icon name="map" size=${40}></sw-icon>
              <div class="crop"><i style="inset-block-start:-5px;inset-inline-start:-5px"></i><i style="inset-block-start:-5px;inset-inline-end:-5px"></i><i style="inset-block-end:-5px;inset-inline-start:-5px"></i><i style="inset-block-end:-5px;inset-inline-end:-5px"></i></div>
            </div>
            <div class="pane">
              <span class="lbl">תוצאה: רקע לקומה (ללא AI)</span>
              <sw-icon name="floor" size=${40}></sw-icon>
            </div>
          </div>
          <div class="side">
            <sw-card heading="חיתוך וסיבוב">
              <div class="row">
                <sw-button size="sm" icon="refresh">סובב 90°</sw-button>
                <sw-button size="sm" icon="fit">אפס חיתוך</sw-button>
              </div>
              <div class="note" style="margin-block-start:8px">קואורדינטות נשמרות ביחס למקור (0–1, ראשית שמאל־למעלה); סיבוב וחיתוך הם טרנספורמציה הפיכה.</div>
            </sw-card>
            <sw-card heading="קובץ">
              <sw-badge kind="neutral" label="PDF · 1.6 MB · 1 עמוד"></sw-badge>
              <div class="note" style="margin-block-start:8px">MIME אומת לפי תוכן · <span class="ltr">sha256 44229e2a…</span> · אין גישה לרשת בזמן רינדור</div>
            </sw-card>
            <sw-card heading="ניתוח AI (אופציונלי)">
              <div class="note">כבוי כברירת מחדל. שליחה לספק חיצוני דורשת הסכמה מפורשת ותקרת עלות (T060). אפשר לפרסם רקע ולהציב ציוד בלי AI.</div>
            </sw-card>
            <div class="foot">
              <sw-button variant="ghost" icon="chevron" ?disabled=${this.step === 0} @click=${() => (this.step = Math.max(0, this.step - 1))}>הקודם</sw-button>
              <sw-button variant="primary" @click=${() => (this.step = Math.min(STEPS.length - 1, this.step + 1))}>${this.step === STEPS.length - 1 ? 'שמור כטיוטה' : 'הבא'}</sw-button>
            </div>
          </div>
        </div>
      </sw-page>
    `;
  }
}
