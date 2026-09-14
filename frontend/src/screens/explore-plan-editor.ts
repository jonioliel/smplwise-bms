import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-icon';
import '../map/sw-plan-canvas';
import type { PlanMarker } from '../map/sw-plan-canvas';
import { demoCameras, demoEntities, demoFloors, demoPlan } from '../fixtures/demo';
import type { IconName } from '../components/sw-icon';

const TOOLS: { id: string; icon: IconName; label: string }[] = [
  { id: 'select', icon: 'target', label: 'בחירה' },
  { id: 'camera', icon: 'camera', label: 'הוספת מצלמה' },
  { id: 'entity', icon: 'light', label: 'הוספת ישות' },
  { id: 'area', icon: 'map', label: 'ציור אזור' },
  { id: 'label', icon: 'list', label: 'תווית' },
  { id: 'scale', icon: 'fit', label: 'קנה מידה' },
];

/** SC06 — plan editor (board 2 screen 13): tools rail, canvas, properties, undo/redo, publish. */
@customElement('explore-plan-editor')
export class ExplorePlanEditor extends LitElement {
  @state() private tool = 'select';
  @state() private selectedId: string | null = 'cam-1';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr) 300px;
      gap: var(--sw-s-3);
      min-block-size: 560px;
      flex: 1;
    }
    .tools {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: var(--sw-s-2);
    }
    .tools button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 2px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: 10px;
      cursor: pointer;
    }
    .tools button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .canvas {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      position: relative;
      min-block-size: 480px;
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sw-s-2);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 60px minmax(0, 1fr);
      }
      .props {
        grid-column: 1 / -1;
      }
    }
  `;

  private get markers(): PlanMarker[] {
    const cams: PlanMarker[] = demoCameras.filter((c) => c.floorId === 'f0').map((c) => ({ id: c.id, kind: 'camera', label: c.name, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, state: 'neutral' }));
    const ents: PlanMarker[] = demoEntities.filter((e) => e.floorId === 'f0').map((e) => ({ id: e.id, kind: e.domain, label: e.name, x: e.x, y: e.y, state: 'neutral' }));
    return [...cams, ...ents];
  }

  render() {
    const floor = demoFloors[0];
    const cam = demoCameras.find((c) => c.id === this.selectedId);
    return html`
      <sw-page heading="עורך תוכנית · קומה 0" subheading="טיוטה · גרסה 3 · נשמר אוטומטית לפני 20 שנ׳ · נתוני הדגמה" wide>
        <sw-button slot="actions" variant="ghost" icon="history">בטל</sw-button>
        <sw-button slot="actions" variant="ghost" icon="refresh">בצע שוב</sw-button>
        <sw-button slot="actions" icon="clock">גרסאות</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">פרסום</sw-button>
        <div class="layout">
          <div class="tools">${TOOLS.map((t) => html`<button class=${t.id === this.tool ? 'on' : ''} @click=${() => (this.tool = t.id)} title=${t.label}><sw-icon .name=${t.icon} size=${20}></sw-icon>${t.label}</button>`)}</div>
          <div class="canvas">
            <sw-plan-canvas .planWidth=${floor.planWidth} .planHeight=${floor.planHeight} .plan=${demoPlan('f0')} .markers=${this.markers} .selectedId=${this.selectedId} @marker-select=${(e: CustomEvent<{ id: string | null }>) => (this.selectedId = e.detail.id)}></sw-plan-canvas>
          </div>
          <div class="props">
            <sw-card heading=${cam ? cam.name : 'מאפיינים'}>
              ${cam
                ? html`
                    <div class="two">
                      <sw-field label="X (0–1)"><input data-ltr value=${cam.x.toFixed(3)} /></sw-field>
                      <sw-field label="Y (0–1)"><input data-ltr value=${cam.y.toFixed(3)} /></sw-field>
                      <sw-field label="כיוון (°)"><input data-ltr value=${String(cam.rotation)} /></sw-field>
                      <sw-field label="זווית ראייה (°)"><input data-ltr value=${String(cam.fov)} /></sw-field>
                    </div>
                    <sw-field label="מרחק קונוס (מ׳)" hint="משוער עד כיול קנה מידה"><input data-ltr value="12" /></sw-field>
                    <sw-field label="שכבה"><select><option>מצלמות</option><option>דלתות</option><option>תאורה</option></select></sw-field>
                  `
                : html`<div class="note">בחר סמן במפה או הוסף חדש מסרגל הכלים. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.</div>`}
            </sw-card>
            <sw-card heading="קנה מידה">
              <sw-badge kind="unknown" label="לא מכויל"></sw-badge>
              <div class="note" style="margin-block-start:8px">שתי נקודות ומרחק ידוע קובעים קנה מידה. עד אז מרחקים מוצגים כמשוערים.</div>
            </sw-card>
            <sw-card heading="שינויים בטיוטה">
              <div class="note">3 סמנים הוזזו · 1 נוסף · 0 נמחקו. הפרסום יוצר PlanVersion מאושרת ונרשם באודיט; אפשר לחזור לגרסה קודמת.</div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
