import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ApiError, describeError } from '../api/client';
import { getGeometry, saveGeometryDraft, type CopyCandidate, type GeometryIssue, type GeometryResponse } from '../api/geometry';
import type { GeometryDoc } from './geometry';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface StudioApi {
  load: (versionId: string) => Promise<GeometryResponse>;
  save: (versionId: string, doc: GeometryDoc, baseRevision: number) => Promise<GeometryResponse>;
}

/** What the server computes on save and the editor cannot (T085): the connectors derived from objects that connect levels
 * and each circuit's power. Walls, openings, labels, objects and circuit members stay the editor's. */
function adoptServerParts(local: GeometryDoc, server: GeometryDoc): GeometryDoc {
  const power = new Map((server.circuits ?? []).map((k) => [k.id, k.power_w]));
  return {
    ...local,
    connectors: server.connectors ?? local.connectors,
    circuits: local.circuits.map((k) => (power.has(k.id) ? { ...k, power_w: power.get(k.id)! } : k)),
  };
}

const DEFAULT_API: StudioApi = { load: (id) => getGeometry(id, { draft: true }), save: (id, doc, base) => saveGeometryDraft(id, doc, base) };

/**
 * Plan Studio draft state for the editor (T084): the working document, undo / redo, and the autosave that PUTs the
 * draft `delayMs` after the last edit with the revision the server gave last time. A 409 keeps the local edit, says so
 * and holds every save until the editor reloads. Any other failure keeps the edit unsaved: the next edit arms the
 * autosave again and every explicit flush tries once more.
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
  /** A save was refused as stale: nothing is sent until load() brings the current draft. */
  private conflicted = false;
  /** Every load() takes a token; only the answer of the latest one is used. */
  private loadToken = 0;
  /** The token of the load the working state comes from; a save answered after a newer load is ignored. */
  private loaded = 0;

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

  /** A save was refused as stale: the editor offers a reload (a retry would overwrite the other editor's change). */
  get hasConflict(): boolean {
    return this.conflicted;
  }

  /** The draft differs from what viewers see, and there is something to show. */
  get pendingPublish(): boolean {
    const d = this.doc;
    if (!d || !this.hash || this.hash === this.publishedHash) return false;
    // What the server's is_empty counts.
    return this.publishedHash !== null || d.walls.length > 0 || d.openings.length > 0 || d.labels.length > 0 || d.objects.length > 0 || d.connectors.length > 0;
  }

  async load(versionId: string): Promise<void> {
    clearTimeout(this.timer);
    const token = ++this.loadToken;
    let r: GeometryResponse;
    try {
      r = await this.api.load(versionId);
    } catch (err) {
      if (token === this.loadToken) throw err;
      return; // a later load() took over: its outcome is the one that counts
    }
    if (token !== this.loadToken) return;
    this.loaded = token;
    this.versionId = versionId;
    this.apply(r);
    this.doc = r.doc;
    this.copyCandidates = r.copy_candidates ?? [];
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
    this.conflicted = false;
    this.saveState = 'idle';
    this.error = '';
    this.host.requestUpdate();
  }

  commit(next: GeometryDoc): void {
    if (!this.doc) return;
    this.undoStack = [...this.undoStack.slice(-59), this.doc]; // at most 60 steps back
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

  /** A draft the server edited itself (the detection accept, T086), taken like a save's answer: its revision, hash,
   * issues and document become the working state, as one undo step (an undo then autosaves the draft as it was before).
   * The caller flushes first. False, and nothing changes, when the answer is for another version or a local edit (unsaved
   * or on its way) would be lost under it: the caller then reloads the stored draft instead. */
  adopt(r: GeometryResponse): boolean {
    if (!this.doc || !this.versionId || r.doc.plan_version_id !== this.versionId || this.dirty || this.inflight) return false;
    clearTimeout(this.timer);
    this.undoStack = [...this.undoStack.slice(-59), this.doc];
    this.redoStack = [];
    this.apply(r);
    this.doc = r.doc;
    this.dirty = false;
    this.conflicted = false;
    this.saveState = 'saved';
    this.error = '';
    this.host.requestUpdate();
    return true;
  }

  /** Save now and wait: before publishing, calibrating or leaving the editor. True when nothing is left unsaved. A
   * conflict sends nothing; after any other failure each call tries once more, and a failure of its own ends it. */
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    let attempted = false;
    for (;;) {
      if (this.inflight) {
        await this.inflight; // a save another caller started; an edit made meanwhile goes out next, so look again
        continue;
      }
      if (!this.dirty || this.conflicted || (attempted && this.saveState === 'error')) break;
      attempted = true;
      this.inflight = this.saveOnce();
      await this.inflight;
      this.inflight = null;
    }
    return !this.dirty && this.saveState !== 'error';
  }

  private change(next: GeometryDoc): void {
    this.doc = next;
    this.dirty = true;
    clearTimeout(this.timer);
    if (!this.conflicted) {
      // While a conflict holds, the edit stays local and the error stays up until the editor reloads.
      if (this.saveState !== 'saving') this.saveState = 'pending';
      this.timer = setTimeout(() => void this.flush(), this.delayMs);
    }
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
    const loaded = this.loaded;
    if (!doc || !id) {
      this.dirty = false; // nothing loaded, so nothing can be saved: flush() stops here instead of asking again forever
      return;
    }
    this.dirty = false;
    this.saveState = 'saving';
    this.host.requestUpdate();
    try {
      const r = await this.api.save(id, doc, this.revision);
      if (loaded !== this.loaded) return; // a newer load replaced the working state: this answer belongs to the old one
      this.apply(r);
      if (this.doc === doc && r.doc) this.doc = adoptServerParts(doc, r.doc);
      this.saveState = this.dirty ? 'pending' : 'saved';
      this.error = '';
    } catch (err) {
      if (loaded !== this.loaded) return;
      this.dirty = true;
      if (err instanceof ApiError && err.code === 'stale_revision') this.conflicted = true;
      this.saveState = 'error';
      this.error = this.conflicted ? 'טיוטת המבנה נערכה במקום אחר; טען מחדש את העורך כדי לא לדרוס שינוי.' : describeError(err);
    } finally {
      this.host.requestUpdate();
    }
  }
}
