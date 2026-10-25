import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-dialog';
import { ApiError, describeError } from '../api/client';
import { deleteNotice } from '../api/notices';
import { nt } from '../i18n/notices';
import { canConfirmDelete, isLive, isUrgentLive, type DeleteTarget } from './delete-model';

export * from './delete-model';

/**
 * NOTICEDEL-295: the confirmation of a real deletion. It names the notice and says it cannot be undone; a notice that is on air also needs
 * a tick ("it will leave every board at once"). Events (bubble, composed): `notice-deleted` ({id}) after the server removed it,
 * `notice-delete-close`. The server decides again (notices.delete, the live step, the emergency right) and its refusal is shown as it comes.
 */
@customElement('notice-delete')
export class NoticeDelete extends LitElement {
  static styles = css`
    p { margin: 0 0 var(--sw-s-3, 12px); color: var(--sw-text); }
    .ck { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); margin: 8px 0 0; }
  `;

  /** The notice to delete (null = closed). */
  @property({ attribute: false }) notice: DeleteTarget | null = null;
  @state() private ticked = false;
  @state() private busy = false;
  @state() private err = '';

  protected willUpdate(p: Map<string, unknown>): void {
    if (p.has('notice')) {
      this.ticked = false;
      this.busy = false;
      this.err = '';
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('notice-delete-close', { bubbles: true, composed: true }));
  }

  private async confirm(): Promise<void> {
    const n = this.notice;
    if (!n || !canConfirmDelete(n, this.ticked, this.busy)) return;
    this.busy = true;
    this.err = '';
    try {
      await deleteNotice(n.id, isLive(n));
      this.dispatchEvent(new CustomEvent('notice-deleted', { detail: { id: n.id }, bubbles: true, composed: true }));
    } catch (e) {
      this.err = e instanceof ApiError && e.status === 403 && e.code === 'emergency_notice' ? nt('delRefused') : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const n = this.notice;
    if (!n) return html`<sw-dialog></sw-dialog>`;
    return html`<sw-dialog open data-delete-dialog heading=${nt('delTitle')} @close=${() => this.close()}>
      <p data-delete-line>${nt('delBody', { title: n.title })}</p>
      ${isLive(n) ? html`<label class="ck"><input type="checkbox" data-delete-live .checked=${this.ticked} @change=${(e: Event) => (this.ticked = (e.target as HTMLInputElement).checked)}>${nt(isUrgentLive(n) ? 'delUrgentTick' : 'delLiveTick')}</label>` : nothing}
      ${this.err ? html`<p class="err" role="alert" data-delete-error>${this.err}</p>` : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => this.close()}>${nt('cancel')}</sw-button>
      <sw-button slot="footer" variant="danger" data-delete-confirm ?disabled=${!canConfirmDelete(n, this.ticked, this.busy)} @click=${() => this.confirm()}>${nt('delConfirm')}</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-delete': NoticeDelete;
  }
}
