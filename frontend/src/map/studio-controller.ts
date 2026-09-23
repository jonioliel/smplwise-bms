import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ApiError, describeError } from '../api/client';
import { getGeometry, saveGeometryDraft, type CopyCandidate, type GeometryIssue, type GeometryResponse } from '../api/geometry';
import type { GeometryDoc } from './geometry';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface StudioApi {
  load: (versionId: string) => Promise<GeometryResponse>;
  save: (versionId: string, doc: GeometryDoc, baseRevision: number) => Promise<GeometryResponse>;
}

const DEFAULT_API: StudioApi = { load: (id) => getGeometry(id, { draft: true }), save: (id, doc, base) => saveGeometryDraft(id, doc, base) };

/**
 * Plan Studio draft state for the editor (T084): the working document, undo / redo, and the autosave that PUTs the
 * draft `delayMs` after the last edit with the revision the server gave last time. A 409 keeps the local edit and says
 * so; the editor offers a reload.
 */
export class StudioController implements ReactiveController {
  doc: GeometryDoc | null = null;
  revision = 0;
  hash: string | null = null;
  publishedHash: string | null = null;
  issues: GeometryIssue[] = [];
  copyCandidates: CopyCandidate[] = [];
  saveState: SaveState = 'idle';
  error = '';
  private versionId: string | null = null;
  private undoStack: GeometryDoc[] = [];
  private redoStack: GeometryDoc[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private inflight: Promise<void> | null = null;

  constructor(private readonly host: ReactiveControllerHost, private readonly api: StudioApi = DEFAULT_API, private readonly delayMs = 2000) {
    host.addController(this);
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    clearTimeout(this.timer);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** The draft differs from what viewers see, and there is something to show. */
  get pendingPublish(): boolean {
    const d = this.doc;
    if (!d || !this.hash || this.hash === this.publishedHash) return false;
    return this.publishedHash !== null || d.walls.length > 0 || d.openings.length > 0 || d.labels.length > 0;
  }

  async load(versionId: string): Promise<void> {
    clearTimeout(this.timer);
    this.versionId = versionId;
    const r = await this.api.load(versionId);
    this.apply(r);
    this.doc = r.doc;
    this.copyCandidates = r.copy_candidates ?? [];
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
    this.saveState = 'idle';
    this.error = '';
    this.host.requestUpdate();
  }

  commit(next: GeometryDoc): void {
    if (!this.doc) return;
    this.undoStack = [...this.undoStack.slice(-60), this.doc];
    this.redoStack = [];
    this.change(next);
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev || !this.doc) return;
    this.redoStack.push(this.doc);
    this.change(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next || !this.doc) return;
    this.undoStack.push(this.doc);
    this.change(next);
  }

  /** Save now and wait: before publishing, calibrating or leaving the editor. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    for (;;) {
      if (this.inflight) await this.inflight;
      if (!this.dirty || this.saveState === 'error') return;
      this.inflight = this.saveOnce();
      await this.inflight;
      this.inflight = null;
    }
  }

  private change(next: GeometryDoc): void {
    this.doc = next;
    this.dirty = true;
    if (this.saveState !== 'saving') this.saveState = 'pending';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
    this.host.requestUpdate();
  }

  private apply(r: GeometryResponse): void {
    this.revision = r.geometry.revision;
    this.hash = r.geometry.doc_hash;
    this.publishedHash = r.published_hash;
    this.issues = r.issues;
  }

  private async saveOnce(): Promise<void> {
    const doc = this.doc;
    const id = this.versionId;
    if (!doc || !id) return;
    this.dirty = false;
    this.saveState = 'saving';
    this.host.requestUpdate();
    try {
      const r = await this.api.save(id, doc, this.revision);
      this.apply(r);
      this.saveState = this.dirty ? 'pending' : 'saved';
      this.error = '';
    } catch (err) {
      this.dirty = true;
      this.saveState = 'error';
      this.error = err instanceof ApiError && err.code === 'stale_revision' ? 'טיוטת המבנה נערכה במקום אחר; טען מחדש את העורך כדי לא לדרוס שינוי.' : describeError(err);
    } finally {
      this.host.requestUpdate();
    }
  }
}
