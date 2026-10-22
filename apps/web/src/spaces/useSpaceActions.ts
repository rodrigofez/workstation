import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";

import { resolveThreadStatusPill } from "../components/Sidebar.logic";
import { randomUUID } from "../lib/utils";
import { readLocalApi } from "../localApi";
import { useQuietThreadShells } from "../state/entities";
import { useEnvironments } from "../state/environments";
import {
  assignGroupToSpace,
  createSpace,
  deleteSpace,
  editSpace,
  moveScratchThread,
  moveSpace,
  projectCountInSpace,
  spacesNeedingAttention,
  unavailableProjects,
  type SpaceDraft,
} from "./spacesModel";
import { useSpacesStore } from "./spacesStore";

export function createSpaceFromDraft(draft: SpaceDraft): string {
  const id = randomUUID();
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

export function useSpacesNeedingAttention(): ReadonlySet<string> {
  const view = useSpacesStore((store) => store.view);
  const state = useSpacesStore((store) => store.state);
  const threads = useQuietThreadShells();
  if (view === null) return new Set();
  return spacesNeedingAttention(
    view,
    state,
    threads.flatMap((thread) => {
      if (thread.archivedAt !== null) return [];
      const pill = resolveThreadStatusPill({ thread })?.label;
      return [
        {
          threadKey: scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
          projectRef: { environmentId: thread.environmentId, projectId: thread.projectId },
          needsAttention:
            pill === "Pending Approval" || pill === "Awaiting Input" || pill === "Failed",
        },
      ];
    }),
  );
}

export function useUnavailableSpaceProjects(spaceId: string | null) {
  const state = useSpacesStore((store) => store.state);
  const { environments } = useEnvironments();
  if (spaceId === null) return [];
  return unavailableProjects(
    state,
    spaceId,
    environments.map((environment) => ({
      environmentId: environment.environmentId,
      label: environment.label,
      connected: environment.connection.phase === "connected",
    })),
  );
}
