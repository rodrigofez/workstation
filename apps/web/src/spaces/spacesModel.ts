import type { ProjectIconColor } from "@t3tools/contracts";

// Spaces are client-local: the server, contracts and other clients never see
// them. Membership is keyed by physical project (environment + normalized
// workspace root) so grouping settings can change without losing it.

export const UNASSIGNED_SPACE_ID = "unassigned";

export const SPACE_COLORS = [
  "blue",
  "violet",
  "pink",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
] as const satisfies readonly ProjectIconColor[];
export type SpaceColor = (typeof SPACE_COLORS)[number];

export interface Space {
  readonly id: string;
  readonly name: string;
  readonly emoji: string | null;
  readonly color: SpaceColor;
}

export interface SpaceMembership {
  readonly spaceId: string;
  readonly environmentId: string;
}

export interface SpacesState {
  readonly spaces: readonly Space[];
  readonly membership: Readonly<Record<string, SpaceMembership>>;
  // No-project threads have no physical project of their own, so they keep
  // the space they were created in, keyed by scoped thread key.
  readonly scratchThreadSpaces: Readonly<Record<string, string>>;
  readonly activeSpaceId: string;
  readonly lastTargetBySpace: Readonly<Record<string, SpaceRouteTarget>>;
  readonly pickerBySpace: Readonly<Record<string, string | null>>;
}

export type SpaceRouteTarget =
  | { readonly kind: "thread"; readonly environmentId: string; readonly threadId: string }
  | { readonly kind: "draft"; readonly draftId: string };

export type SpaceSwitchTarget =
  | SpaceRouteTarget
  | { readonly kind: "landing"; readonly projectRef: SpacesProjectRef | null };

export interface SpaceTargetLookup {
  readonly thread: (ref: {
    readonly environmentId: string;
    readonly threadId: string;
  }) => SpacesThreadRef | null;
  readonly draft: (draftId: string) => SpacesThreadRef | null;
}

export interface SpacesProjectRef {
  readonly environmentId: string;
  readonly projectId: string;
}

export interface SpacesCatalogMember {
  readonly physicalKey: string;
  readonly environmentId: string;
  readonly lastUsedAt: number;
}

export interface SpacesCatalogGroup {
  readonly key: string;
  readonly isScratch: boolean;
  readonly members: readonly SpacesCatalogMember[];
  readonly projectRefs: readonly SpacesProjectRef[];
}

export interface SpacesCatalog {
  // Until every environment's projects have loaded, an empty Unassigned is
  // not evidence that sorting finished.
  readonly ready: boolean;
  readonly groups: readonly SpacesCatalogGroup[];
  readonly scratchThreadKeys: readonly string[];
}

export interface SpaceSwitcherEntry {
  readonly id: string;
  readonly name: string;
  readonly emoji: string | null;
  readonly color: SpaceColor | null;
}

export interface SpacesView {
  readonly switcher: readonly SpaceSwitcherEntry[];
  readonly activeSpaceId: string;
  readonly groupSpaceByKey: ReadonlyMap<string, string>;
  readonly firstProjectRefBySpace: ReadonlyMap<string, SpacesProjectRef>;
  readonly projectRefKeysBySpace: ReadonlyMap<string, ReadonlySet<string>>;
  readonly spaceByProjectRefKey: ReadonlyMap<string, string>;
  readonly scratchProjectRefKeys: ReadonlySet<string>;
  readonly unassignedGroupKeys: readonly string[];
  readonly unassignedScratchThreadKeys: readonly string[];
  // Groups whose physical members were assigned to different spaces.
  readonly conflictGroupKeys: readonly string[];
}

export interface SpacesThreadRef {
  readonly threadKey: string;
  readonly projectRef: SpacesProjectRef;
}

export function spacesProjectRefKey(ref: SpacesProjectRef): string {
  return `${ref.environmentId}:${ref.projectId}`;
}

export function initialSpacesState(): SpacesState {
  return {
    spaces: [
      { id: "work", name: "Work", emoji: "💼", color: "blue" },
      { id: "personal", name: "Personal", emoji: "🏠", color: "green" },
    ],
    membership: {},
    scratchThreadSpaces: {},
    activeSpaceId: UNASSIGNED_SPACE_ID,
    lastTargetBySpace: {},
    pickerBySpace: {},
  };
}

export const UNASSIGNED_ENTRY: SpaceSwitcherEntry = {
  id: UNASSIGNED_SPACE_ID,
  name: "Unassigned",
  emoji: null,
  color: null,
};

function resolveGroupSpace(
  state: SpacesState,
  spaceIds: ReadonlySet<string>,
  group: SpacesCatalogGroup,
): { readonly spaceId: string; readonly conflict: boolean } {
  let best: { spaceId: string; lastUsedAt: number } | null = null;
  const seen = new Set<string>();
  for (const member of group.members) {
    const spaceId = state.membership[member.physicalKey]?.spaceId;
    if (spaceId === undefined || !spaceIds.has(spaceId)) continue;
    seen.add(spaceId);
    if (best === null || member.lastUsedAt > best.lastUsedAt) {
      best = { spaceId, lastUsedAt: member.lastUsedAt };
    }
  }
  return { spaceId: best?.spaceId ?? UNASSIGNED_SPACE_ID, conflict: seen.size > 1 };
}

function existingScratchSpace(
  state: SpacesState,
  spaceIds: ReadonlySet<string>,
  threadKey: string,
): string {
  const spaceId = state.scratchThreadSpaces[threadKey];
  return spaceId !== undefined && spaceIds.has(spaceId) ? spaceId : UNASSIGNED_SPACE_ID;
}

export function deriveSpacesView(state: SpacesState, catalog: SpacesCatalog): SpacesView {
  const spaceIds = new Set(state.spaces.map((space) => space.id));
  const groupSpaceByKey = new Map<string, string>();
  const firstProjectRefBySpace = new Map<string, SpacesProjectRef>();
  const projectRefKeysBySpace = new Map<string, Set<string>>();
  const spaceByProjectRefKey = new Map<string, string>();
  const scratchProjectRefKeys = new Set<string>();
  const unassignedGroupKeys: string[] = [];
  const conflictGroupKeys: string[] = [];
  for (const group of catalog.groups) {
    if (group.isScratch) {
      for (const ref of group.projectRefs) scratchProjectRefKeys.add(spacesProjectRefKey(ref));
      continue;
    }
    const { spaceId, conflict } = resolveGroupSpace(state, spaceIds, group);
    groupSpaceByKey.set(group.key, spaceId);
    const firstRef = group.projectRefs[0];
    if (firstRef !== undefined && !firstProjectRefBySpace.has(spaceId)) {
      firstProjectRefBySpace.set(spaceId, firstRef);
    }
    if (conflict) conflictGroupKeys.push(group.key);
    if (spaceId === UNASSIGNED_SPACE_ID) unassignedGroupKeys.push(group.key);
    let refKeys = projectRefKeysBySpace.get(spaceId);
    if (refKeys === undefined) {
      refKeys = new Set();
      projectRefKeysBySpace.set(spaceId, refKeys);
    }
    for (const ref of group.projectRefs) {
      const refKey = spacesProjectRefKey(ref);
      refKeys.add(refKey);
      spaceByProjectRefKey.set(refKey, spaceId);
    }
  }
  const unassignedScratchThreadKeys = catalog.scratchThreadKeys.filter(
    (threadKey) => existingScratchSpace(state, spaceIds, threadKey) === UNASSIGNED_SPACE_ID,
  );
  const showUnassigned =
    !catalog.ready || unassignedGroupKeys.length > 0 || unassignedScratchThreadKeys.length > 0;
  const switcher: SpaceSwitcherEntry[] = [
    ...state.spaces.map((space) => ({ ...space })),
    ...(showUnassigned ? [UNASSIGNED_ENTRY] : []),
  ];
  const activeExists = switcher.some((entry) => entry.id === state.activeSpaceId);
  return {
    switcher,
    activeSpaceId: activeExists ? state.activeSpaceId : (switcher[0]?.id ?? UNASSIGNED_SPACE_ID),
    groupSpaceByKey,
    firstProjectRefBySpace,
    projectRefKeysBySpace,
    spaceByProjectRefKey,
    scratchProjectRefKeys,
    unassignedGroupKeys,
    unassignedScratchThreadKeys,
    conflictGroupKeys,
  };
}

export function spaceOfThread(
  view: SpacesView,
  state: SpacesState,
  thread: SpacesThreadRef,
): string {
  const refKey = spacesProjectRefKey(thread.projectRef);
  if (view.scratchProjectRefKeys.has(refKey)) {
    const spaceId = state.scratchThreadSpaces[thread.threadKey];
    return spaceId !== undefined && view.switcher.some((entry) => entry.id === spaceId)
      ? spaceId
      : UNASSIGNED_SPACE_ID;
  }
  return view.spaceByProjectRefKey.get(refKey) ?? UNASSIGNED_SPACE_ID;
}

export function isKnownProjectRef(view: SpacesView, ref: SpacesProjectRef): boolean {
  const refKey = spacesProjectRefKey(ref);
  return view.spaceByProjectRefKey.has(refKey) || view.scratchProjectRefKeys.has(refKey);
}

export function recordScratchThread(
  state: SpacesState,
  threadKey: string,
  spaceId: string,
): SpacesState {
  if (spaceId === UNASSIGNED_SPACE_ID || state.scratchThreadSpaces[threadKey] !== undefined) {
    return state;
  }
  return { ...state, scratchThreadSpaces: { ...state.scratchThreadSpaces, [threadKey]: spaceId } };
}

export function assignGroupToSpace(
  state: SpacesState,
  group: Pick<SpacesCatalogGroup, "members">,
  spaceId: string,
): SpacesState {
  const membership = { ...state.membership };
  for (const member of group.members) {
    if (spaceId === UNASSIGNED_SPACE_ID) {
      delete membership[member.physicalKey];
    } else {
      membership[member.physicalKey] = { spaceId, environmentId: member.environmentId };
    }
  }
  return { ...state, membership };
}

export function switchSpace(state: SpacesState, spaceId: string): SpacesState {
  if (state.activeSpaceId === spaceId) return state;
  if (spaceId !== UNASSIGNED_SPACE_ID && !state.spaces.some((space) => space.id === spaceId)) {
    return state;
  }
  return { ...state, activeSpaceId: spaceId };
}

export function recordSpaceVisit(
  state: SpacesState,
  spaceId: string,
  target: SpaceRouteTarget,
): SpacesState {
  const previous = state.lastTargetBySpace[spaceId];
  if (
    previous !== undefined &&
    (previous.kind === "thread"
      ? target.kind === "thread" &&
        previous.environmentId === target.environmentId &&
        previous.threadId === target.threadId
      : target.kind === "draft" && previous.draftId === target.draftId)
  ) {
    return state;
  }
  return { ...state, lastTargetBySpace: { ...state.lastTargetBySpace, [spaceId]: target } };
}

export function rememberSpacePicker(
  state: SpacesState,
  spaceId: string,
  pickerKey: string | null,
): SpacesState {
  if (spacePicker(state, spaceId) === pickerKey) return state;
  return { ...state, pickerBySpace: { ...state.pickerBySpace, [spaceId]: pickerKey } };
}

export function spacePicker(state: SpacesState, spaceId: string): string | null {
  return state.pickerBySpace[spaceId] ?? null;
}

export function resolveSwitchTarget(
  view: SpacesView,
  state: SpacesState,
  spaceId: string,
  lookup: SpaceTargetLookup,
): SpaceSwitchTarget {
  const last = state.lastTargetBySpace[spaceId];
  if (last !== undefined) {
    const ref = last.kind === "thread" ? lookup.thread(last) : lookup.draft(last.draftId);
    if (ref !== null && spaceOfThread(view, state, ref) === spaceId) return last;
  }
  return { kind: "landing", projectRef: view.firstProjectRefBySpace.get(spaceId) ?? null };
}

export function projectCountInSpace(view: SpacesView, spaceId: string): number {
  let count = 0;
  for (const groupSpaceId of view.groupSpaceByKey.values()) {
    if (groupSpaceId === spaceId) count += 1;
  }
  return count;
}

export interface SpaceDraft {
  readonly name: string;
  readonly emoji: string | null;
  readonly color: SpaceColor;
}

function isSpaceColor(value: unknown): value is SpaceColor {
  return typeof value === "string" && (SPACE_COLORS as readonly string[]).includes(value);
}

function sanitizeEmoji(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createSpace(state: SpacesState, input: SpaceDraft & { readonly id: string }) {
  const name = input.name.trim();
  if (
    name.length === 0 ||
    !isSpaceColor(input.color) ||
    input.id === UNASSIGNED_SPACE_ID ||
    state.spaces.some((space) => space.id === input.id)
  ) {
    return state;
  }
  return {
    ...state,
    spaces: [
      ...state.spaces,
      { id: input.id, name, emoji: sanitizeEmoji(input.emoji), color: input.color },
    ],
  };
}

export function editSpace(
  state: SpacesState,
  spaceId: string,
  patch: Partial<SpaceDraft>,
): SpacesState {
  return {
    ...state,
    spaces: state.spaces.map((space) => {
      if (space.id !== spaceId) return space;
      const name = patch.name?.trim();
      return {
        ...space,
        ...(name ? { name } : {}),
        ...(patch.emoji !== undefined ? { emoji: sanitizeEmoji(patch.emoji) } : {}),
        ...(isSpaceColor(patch.color) ? { color: patch.color } : {}),
      };
    }),
  };
}

export function moveSpace(state: SpacesState, spaceId: string, offset: -1 | 1): SpacesState {
  const index = state.spaces.findIndex((space) => space.id === spaceId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= state.spaces.length) return state;
  const spaces = [...state.spaces];
  [spaces[index], spaces[target]] = [spaces[target]!, spaces[index]!];
  return { ...state, spaces };
}

function withoutSpace<T>(record: Readonly<Record<string, T>>, spaceId: string) {
  const { [spaceId]: _removed, ...rest } = record;
  return rest;
}

// Deleting a space only forgets assignments; projects, threads and worktrees
// stay where they are and resurface in Unassigned.
export function deleteSpace(state: SpacesState, spaceId: string): SpacesState {
  if (!state.spaces.some((space) => space.id === spaceId)) return state;
  return {
    ...state,
    spaces: state.spaces.filter((space) => space.id !== spaceId),
    membership: Object.fromEntries(
      Object.entries(state.membership).filter(([, entry]) => entry.spaceId !== spaceId),
    ),
    scratchThreadSpaces: Object.fromEntries(
      Object.entries(state.scratchThreadSpaces).filter(([, entry]) => entry !== spaceId),
    ),
    activeSpaceId: state.activeSpaceId === spaceId ? UNASSIGNED_SPACE_ID : state.activeSpaceId,
    lastTargetBySpace: withoutSpace(state.lastTargetBySpace, spaceId),
    pickerBySpace: withoutSpace(state.pickerBySpace, spaceId),
  };
}

export function moveScratchThread(
  state: SpacesState,
  threadKey: string,
  spaceId: string,
): SpacesState {
  const { [threadKey]: _previous, ...rest } = state.scratchThreadSpaces;
  return recordScratchThread({ ...state, scratchThreadSpaces: rest }, threadKey, spaceId);
}

// The add-project flow captures its space when it starts, so a clone that
// finishes after a switch still lands where it was started.
export function recordProjectCreatedInSpace(
  state: SpacesState,
  project: { readonly physicalKey: string; readonly environmentId: string },
  spaceId: string,
): SpacesState {
  if (
    state.membership[project.physicalKey] !== undefined ||
    !state.spaces.some((space) => space.id === spaceId)
  ) {
    return state;
  }
  return {
    ...state,
    membership: {
      ...state.membership,
      [project.physicalKey]: { spaceId, environmentId: project.environmentId },
    },
  };
}

export function spacesNeedingAttention(
  view: SpacesView,
  state: SpacesState,
  threads: ReadonlyArray<SpacesThreadRef & { readonly needsAttention: boolean }>,
): ReadonlySet<string> {
  const flagged = new Set<string>();
  for (const thread of threads) {
    if (thread.needsAttention) flagged.add(spaceOfThread(view, state, thread));
  }
  return flagged;
}

export interface SpacesEnvironment {
  readonly environmentId: string;
  readonly label: string;
  readonly connected: boolean;
}

export function unavailableProjects(
  state: SpacesState,
  spaceId: string,
  environments: readonly SpacesEnvironment[],
): Array<{ environmentId: string; label: string; count: number }> {
  const offline = environments.filter((environment) => !environment.connected);
  return offline.flatMap((environment) => {
    let count = 0;
    for (const entry of Object.values(state.membership)) {
      if (entry.spaceId === spaceId && entry.environmentId === environment.environmentId) {
        count += 1;
      }
    }
    return count > 0
      ? [{ environmentId: environment.environmentId, label: environment.label, count }]
      : [];
  });
}

const SPACES_STATE_VERSION = 1;

export function serializeSpacesState(state: SpacesState): string {
  return JSON.stringify({ version: SPACES_STATE_VERSION, ...state });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRouteTarget(value: unknown): SpaceRouteTarget | null {
  if (!isRecord(value)) return null;
  if (
    value.kind === "thread" &&
    typeof value.environmentId === "string" &&
    typeof value.threadId === "string"
  ) {
    return { kind: "thread", environmentId: value.environmentId, threadId: value.threadId };
  }
  if (value.kind === "draft" && typeof value.draftId === "string") {
    return { kind: "draft", draftId: value.draftId };
  }
  return null;
}

export function parseSpacesState(raw: unknown): SpacesState {
  if (!isRecord(raw) || raw.version !== SPACES_STATE_VERSION || !Array.isArray(raw.spaces)) {
    return initialSpacesState();
  }
  const spaces: Space[] = [];
  for (const candidate of raw.spaces) {
    if (!isRecord(candidate)) continue;
    const { id, name } = candidate;
    if (typeof id !== "string" || id.length === 0 || id === UNASSIGNED_SPACE_ID) continue;
    if (typeof name !== "string" || name.trim().length === 0) continue;
    if (spaces.some((space) => space.id === id)) continue;
    spaces.push({
      id,
      name: name.trim(),
      emoji: sanitizeEmoji(candidate.emoji),
      color: isSpaceColor(candidate.color) ? candidate.color : SPACE_COLORS[0],
    });
  }
  const spaceIds = new Set(spaces.map((space) => space.id));
  const membership: Record<string, SpaceMembership> = {};
  for (const [physicalKey, entry] of Object.entries(
    isRecord(raw.membership) ? raw.membership : {},
  )) {
    if (
      isRecord(entry) &&
      typeof entry.spaceId === "string" &&
      spaceIds.has(entry.spaceId) &&
      typeof entry.environmentId === "string"
    ) {
      membership[physicalKey] = { spaceId: entry.spaceId, environmentId: entry.environmentId };
    }
  }
  const scratchThreadSpaces: Record<string, string> = {};
  for (const [threadKey, spaceId] of Object.entries(
    isRecord(raw.scratchThreadSpaces) ? raw.scratchThreadSpaces : {},
  )) {
    if (typeof spaceId === "string" && spaceIds.has(spaceId))
      scratchThreadSpaces[threadKey] = spaceId;
  }
  const lastTargetBySpace: Record<string, SpaceRouteTarget> = {};
  for (const [spaceId, value] of Object.entries(
    isRecord(raw.lastTargetBySpace) ? raw.lastTargetBySpace : {},
  )) {
    const target = parseRouteTarget(value);
    if (target !== null && (spaceIds.has(spaceId) || spaceId === UNASSIGNED_SPACE_ID)) {
      lastTargetBySpace[spaceId] = target;
    }
  }
  const pickerBySpace: Record<string, string | null> = {};
  for (const [spaceId, value] of Object.entries(
    isRecord(raw.pickerBySpace) ? raw.pickerBySpace : {},
  )) {
    if (
      (value === null || typeof value === "string") &&
      (spaceIds.has(spaceId) || spaceId === UNASSIGNED_SPACE_ID)
    ) {
      pickerBySpace[spaceId] = value;
    }
  }
  const activeSpaceId =
    typeof raw.activeSpaceId === "string" && spaceIds.has(raw.activeSpaceId)
      ? raw.activeSpaceId
      : UNASSIGNED_SPACE_ID;
  return {
    spaces,
    membership,
    scratchThreadSpaces,
    activeSpaceId,
    lastTargetBySpace,
    pickerBySpace,
  };
}

export type SpaceShortcut =
  | { readonly kind: "previous" }
  | { readonly kind: "next" }
  | { readonly kind: "index"; readonly index: number };

export function resolveSpaceShortcut(view: SpacesView, shortcut: SpaceShortcut): string | null {
  const currentIndex = view.switcher.findIndex((entry) => entry.id === view.activeSpaceId);
  const targetIndex =
    shortcut.kind === "index" ? shortcut.index : currentIndex + (shortcut.kind === "next" ? 1 : -1);
  if (targetIndex === currentIndex) return null;
  return view.switcher[targetIndex]?.id ?? null;
}
