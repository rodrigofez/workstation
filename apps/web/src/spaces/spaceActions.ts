import { msg } from "gt-react";

import { m } from "../i18n/messages";
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

// Membership is per physical project, so a group's copies on other
// environments are assigned together; otherwise a later regroup could split
// them across spaces.
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
      count === 0
        ? m(
            msg(
              "Delete the space “{name}”? It has no projects. No projects, threads or worktrees are deleted.",
            ),
            { name: space.name },
          )
        : m(
            msg(
              "{count, plural, one {Delete the space “{name}”? Its {count} project will move to Unassigned. No projects, threads or worktrees are deleted.} other {Delete the space “{name}”? Its {count} projects will move to Unassigned. No projects, threads or worktrees are deleted.}}",
            ),
            { name: space.name, count },
          ),
      { variant: "destructive" },
    )) ?? false;
  if (confirmed) useSpacesStore.getState().update((current) => deleteSpace(current, spaceId));
  return confirmed;
}
