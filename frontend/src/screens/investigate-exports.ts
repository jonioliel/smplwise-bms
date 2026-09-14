import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import { demoJobs } from '../fixtures/catalog';

/** SC18 — exports and downloads (Beta): durable jobs, progress/cancel/partial/fail, scoped download. */
@customElement('investigate-exports')
export class InvestigateExports extends LitElement {
  static styles = css`
    .job {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 160px auto;
      gap: var(--sw-s-3);
      align-items: center;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .job:last-child {
      border-block-end: 0;
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .actions {
      display: flex;
      gap: 4px;
    }
    @media (max-width: 767px) {
      .job {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    return html`
      <sw-page heading="ייצוא והורדות" subheading="עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="download">ייצוא חדש</sw-button>
        <sw-card>
          ${demoJobs.map(
            (j) => html`<div class="job">
              <div><strong>${j.title}</strong><div class="meta">${j.size} · ${j.hash}</div></div>
              <div><div class="bar ${j.status.startsWith('נכשל') ? 'fail' : ''}"><i style="inline-size:${j.progress}%"></i></div><div class="meta">${j.status} · ${j.progress}%</div></div>
              <div class="actions">
                ${j.progress === 100 ? html`<sw-button size="sm" icon="download">הורדה</sw-button>` : j.status.startsWith('נכשל') ? html`<sw-button size="sm" icon="refresh">נסה שוב</sw-button>` : html`<sw-button size="sm" variant="ghost" icon="close">בטל</sw-button>`}
              </div>
            </div>`,
          )}
        </sw-card>
        <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.</div>
      </sw-page>
    `;
  }
}
