import { readLocalApi } from "../localApi";
import {
  assignGroupToSpace,
  createSpace,
  deleteSpace,
  editSpace,
  moveScratchThread,
  moveSpace,
  projectCountInSpace,
  type SpaceDraft,
} from "./spacesModel";
import { useSpacesStore } from "./spacesStore";

// lib/utils' randomUUID would pull the composer store into every importer of
// these actions; a short random id is all a client-local space needs.
function newSpaceId(): string {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createSpaceFromDraft(draft: SpaceDraft): string {
  const id = newSpaceId();
  useSpacesStore.getState().update((state) => createSpace(state, { id, ...draft }));
  return id;
}

export function editSpaceFromDraft(spaceId: string, draft: Partial<SpaceDraft>): void {
  useSpacesStore.getState().update((state) => editSpace(state, spaceId, draft));
}

export function moveSpaceBy(spaceId: string, offset: -1 | 1): void {
  useSpacesStore.getState().update((state) => moveSpace(state, spaceId, offset));
}

// Moving a group moves every physical member, including copies on other
// environments, so it is sorted once.
export function assignProjectGroupToSpace(groupKey: string, spaceId: string): void {
  const group = useSpacesStore.getState().catalog?.groups.find((entry) => entry.key === groupKey);
  if (group === undefined) return;
  useSpacesStore.getState().update((state) => assignGroupToSpace(state, group, spaceId));
}

export function moveScratchThreadsToSpace(threadKeys: readonly string[], spaceId: string): void {
  useSpacesStore
    .getState()
    .update((state) =>
      threadKeys.reduce(
        (current, threadKey) => moveScratchThread(current, threadKey, spaceId),
        state,
      ),
    );
}

export async function confirmAndDeleteSpace(spaceId: string): Promise<boolean> {
  const { state, view } = useSpacesStore.getState();
  const space = state.spaces.find((candidate) => candidate.id === spaceId);
  if (space === undefined || view === null) return false;
  const count = projectCountInSpace(view, spaceId);
  const confirmed =
    (await readLocalApi()?.dialogs.confirm(
      `Delete the space “${space.name}”? ${
        count === 0
          ? "It has no projects."
          : `Its ${count} project${count === 1 ? "" : "s"} will move to Unassigned.`
      } No projects, threads or worktrees are deleted.`,
      { variant: "destructive" },
    )) ?? false;
  if (confirmed) useSpacesStore.getState().update((current) => deleteSpace(current, spaceId));
  return confirmed;
}
