import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ApiError, describeError } from '../api/client';
import { getGeometry, saveGeometryDraft, type CopyCandidate, type GeometryIssue, type GeometryResponse } from '../api/geometry';
import type { GeometryDoc } from './geometry';
import { guardShared, isShared } from './shared-space';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface StudioApi {
  load: (versionId: string) => Promise<GeometryResponse>;
  save: (versionId: string, doc: GeometryDoc, baseRevision: number) => Promise<GeometryResponse>;
}

/** What the server computes on save and the editor cannot (T085): the connectors derived from objects that connect levels
 * and each circuit's power. Walls, openings, labels, objects and circuit members stay the editor's - except the items of a
 * room another floor shares with this one (CR-009): those are the home floor's, re-attached by the answer with the home
 * draft's new revision, so they and `shared_spaces` come from the server. */
function adoptServerParts(local: GeometryDoc, server: GeometryDoc): GeometryDoc {
  const power = new Map((server.circuits ?? []).map((k) => [k.id, k.power_w]));
  const out: GeometryDoc = {
    ...local,
    connectors: server.connectors ?? local.connectors,
    circuits: local.circuits.map((k) => (power.has(k.id) ? { ...k, power_w: power.get(k.id)! } : k)),
  };
  if (!server.shared_spaces?.length && !local.shared_spaces?.length) return out;
  for (const coll of SHARED_PARTS) {
    const own = ((out[coll] ?? []) as { shared?: unknown }[]).filter((x) => !isShared(x));
    const theirs = ((server[coll] ?? []) as { shared?: unknown }[]).filter((x) => isShared(x));
    (out as unknown as Record<string, unknown[]>)[coll] = [...own, ...theirs];
  }
  out.shared_spaces = server.shared_spaces;
  return out;
}

/** The collections a shared room attaches items to (CR-009); connectors are merged whole, as before. */
const SHARED_PARTS = ['walls', 'openings', 'objects', 'labels', 'circuits', 'groups', 'levels'] as const;
type MergedColl = (typeof SHARED_PARTS)[number] | 'connectors';
const MERGED: readonly MergedColl[] = ['connectors', ...SHARED_PARTS];
type Item = { id: string; far?: unknown; shared?: unknown };

/** The part of a collection a rebase merges item by item: every connector, and the shared items of the others. */
function mergedPart(d: GeometryDoc, coll: MergedColl): Item[] {
  const xs = ((d[coll] ?? []) as Item[]);
  return coll === 'connectors' ? xs : xs.filter((x) => isShared(x));
}
function ownPart(d: GeometryDoc, coll: MergedColl): Item[] {
  return coll === 'connectors' ? [] : ((d[coll] ?? []) as Item[]).filter((x) => !isShared(x));
}

/** "המדרגות בקומה 1 לא עודכנו - אין לך הרשאת עריכה שם" (T085 review M-a): the stairs changed here, their twin there did
 * not follow. */
export function skippedTwinsMessage(floors: readonly { name: string }[]): string {
  const names = [...new Set(floors.map((f) => f.name))];
  return `המדרגות ב${names.join(' וב')} לא עודכנו - אין לך הרשאת עריכה שם`;
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/** An item as stored: a connector's `far` is computed on every read and says nothing about an edit. */
const itemKey = (c: Item): string => {
  const { far: _far, ...rest } = c;
  void _far;
  return JSON.stringify(rest);
};
const indexOf = (xs: Item[]) => new Map(xs.map((c) => [c.id, itemKey(c)]));

/** T085 review L-e, CR-009: the draft moved on the server while this editor held unsaved edits - a twin synced from
 * another floor raised its revision, or the home floor of a room shared with this one changed that room (the save
 * answered 409 because the home draft moved). When the server's change touched only connectors and shared items this
 * editor did not edit (compared with `base`, the document the local edits started from), the local edits are replayed
 * on the server's document: its connectors and shared items, with the ones edited here (added, changed or removed)
 * taken from here, the floor's own items from here, and `shared_spaces` (the home revision the next save echoes) from
 * the server. Null when the server changed anything else, an item edited here too, or nothing visible at all (then the
 * conflict stands and the editor asks for a reload). */
export function rebaseOnServer(base: GeometryDoc, local: GeometryDoc, server: GeometryDoc): GeometryDoc | null {
  const keys = new Set([...Object.keys(base), ...Object.keys(server)]) as Set<keyof GeometryDoc>;
  for (const k of keys) {
    if (k === 'shared_spaces') continue;
    if ((MERGED as readonly string[]).includes(k)) {
      if (!sameJson(ownPart(base, k as MergedColl), ownPart(server, k as MergedColl))) return null;
    } else if (!sameJson(base[k], server[k])) return null;
  }
  let changed = false;
  const out: GeometryDoc = { ...local, shared_spaces: server.shared_spaces };
  for (const coll of MERGED) {
    const b = indexOf(mergedPart(base, coll));
    const l = indexOf(mergedPart(local, coll));
    const s = indexOf(mergedPart(server, coll));
    const ids = [...new Set([...b.keys(), ...l.keys(), ...s.keys()])];
    const mine = new Set(ids.filter((id) => b.get(id) !== l.get(id)));
    const theirs = ids.filter((id) => b.get(id) !== s.get(id));
    if (theirs.some((id) => mine.has(id))) return null;
    if (theirs.length) changed = true;
    const localById = new Map(mergedPart(local, coll).map((c) => [c.id, c]));
    const merged = mergedPart(server, coll).flatMap((c) => (mine.has(c.id) ? (localById.has(c.id) ? [localById.get(c.id)!] : []) : [c]));
    for (const c of mergedPart(local, coll)) if (mine.has(c.id) && !s.has(c.id)) merged.push(c);
    (out as unknown as Record<string, unknown[]>)[coll] = [...ownPart(local, coll), ...merged];
  }
  return changed ? out : null;
}

/** The connectors and shared items the server changed against `base` (added, changed or removed; `far` ignored). */
export function serverChangedItems(base: GeometryDoc, server: GeometryDoc): Map<MergedColl, Set<string>> {
  const out = new Map<MergedColl, Set<string>>();
  for (const coll of MERGED) {
    const b = indexOf(mergedPart(base, coll));
    const s = indexOf(mergedPart(server, coll));
    const ids = [...new Set([...b.keys(), ...s.keys()])].filter((id) => b.get(id) !== s.get(id));
    if (ids.length) out.set(coll, new Set(ids));
  }
  return out;
}

/** The connectors the server changed against `base` (added, changed or removed; `far` ignored). */
export function serverChangedConnectors(base: GeometryDoc, server: GeometryDoc): Set<string> {
  return serverChangedItems(base, server).get('connectors') ?? new Set();
}

/** A document of the undo / redo history with the server's version of the items in `changed` (review M-1): an undo after
 * a rebase must never bring back the connector the other floor's sync replaced (and push it back there) - nor a shared
 * room's item the home floor changed (CR-009). */
export function withServerItems(doc: GeometryDoc, server: GeometryDoc, changed: ReadonlyMap<MergedColl, ReadonlySet<string>>): GeometryDoc {
  if (!changed.size) return doc;
  const out: GeometryDoc = { ...doc, shared_spaces: server.shared_spaces ?? doc.shared_spaces };
  for (const [coll, ids] of changed) {
    const byId = new Map(((server[coll] ?? []) as Item[]).map((c) => [c.id, c]));
    const xs = ((doc[coll] ?? []) as Item[]).flatMap((c) => (ids.has(c.id) ? (byId.has(c.id) ? [byId.get(c.id)!] : []) : [c]));
    const have = new Set(xs.map((c) => c.id));
    for (const c of (server[coll] ?? []) as Item[]) if (ids.has(c.id) && !have.has(c.id)) xs.push(c);
    (out as unknown as Record<string, unknown[]>)[coll] = xs;
  }
  return out;
}

/** The connector-only form of withServerItems (T085). */
export function withServerConnectors(doc: GeometryDoc, server: GeometryDoc, ids: ReadonlySet<string>): GeometryDoc {
  return withServerItems(doc, server, new Map([['connectors', ids]]));
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
  /** CR-009: the new items the last commit claimed for a shared room's home floor, old id -> namespaced id. */
  claimed: ReadonlyMap<string, string> = new Map();
  /** Called with a message the person should see after a save (the editor shows it for a while). */
  onNotice: ((message: string) => void) | null = null;
  private versionId: string | null = null;
  /** The server's document the local edits started from (the last load or save answer): what a rebase compares with. */
  private base: GeometryDoc | null = null;
  /** A rebase was done since the last successful save: a second stale answer is a real conflict (review L-e). */
  private rebased = false;
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
    this.base = r.doc;
    this.rebased = false;
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
    // CR-009: a room another floor shares with this one - its read-only pieces never change here, and a new item drawn
    // inside it is claimed for its home floor (renamed: "claimed" maps the old id to the new one for the selection)
    const guarded = guardShared(this.doc, next);
    this.claimed = guarded.claimed;
    next = guarded.doc;
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
    this.base = r.doc;
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
    const skipped = r.twins_skipped ?? [];
    if (skipped.length) this.onNotice?.(skippedTwinsMessage(skipped));
  }

  /** After a stale answer: load the server's draft and replay the local edits on it when they cannot collide
   * (rebaseOnServer). True when the working state moved to the server's revision and still waits to be saved. */
  private async rebase(id: string, loaded: number): Promise<boolean> {
    if (!this.base || this.rebased) return false;
    let r: GeometryResponse;
    try {
      r = await this.api.load(id);
    } catch {
      return false;
    }
    if (loaded !== this.loaded || !this.doc) return false;
    const merged = rebaseOnServer(this.base, this.doc, r.doc);
    if (!merged) return false;
    this.rebased = true;
    const theirs = serverChangedItems(this.base, r.doc);
    this.undoStack = this.undoStack.map((d) => withServerItems(d, r.doc, theirs));
    this.redoStack = this.redoStack.map((d) => withServerItems(d, r.doc, theirs));
    this.apply(r);
    this.base = r.doc;
    this.doc = merged;
    this.dirty = true;
    this.saveState = 'pending';
    this.error = '';
    return true;
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
      if (r.doc) this.base = r.doc;
      this.rebased = false;
      if (this.doc === doc && r.doc) this.doc = adoptServerParts(doc, r.doc);
      this.saveState = this.dirty ? 'pending' : 'saved';
      this.error = '';
    } catch (err) {
      if (loaded !== this.loaded) return;
      this.dirty = true;
      if (err instanceof ApiError && err.code === 'stale_revision') {
        if (await this.rebase(id, loaded)) return; // the local edits go out again on the server's revision (flush loops)
        this.conflicted = true;
      }
      this.saveState = 'error';
      this.error = this.conflicted ? 'הקומה עודכנה מקומה אחרת או במקום אחר; טען מחדש את העורך כדי לא לדרוס שינוי (שינויים שלא נשמרו כאן לא יישמרו).' : describeError(err);
    } finally {
      this.host.requestUpdate();
    }
  }
}
