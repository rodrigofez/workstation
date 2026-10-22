import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import {
  spaceOfThread,
  spacesProjectRefKey,
  UNASSIGNED_SPACE_ID,
  type SpacesProjectRef,
  type SpacesState,
  type SpacesView,
} from "./spacesModel";
import { useSpacesStore } from "./spacesStore";

// Integration hooks for upstream lists. Each returns its input untouched while
// spaces are off, so upstream behaviour is the fallback everywhere.

export interface SpaceScope {
  readonly view: SpacesView;
  readonly state: SpacesState;
  readonly spaceId: string;
}

export function useSpaceScope(): SpaceScope | null {
  const view = useSpacesStore((store) => store.view);
  const state = useSpacesStore((store) => store.state);
  return view === null ? null : { view, state, spaceId: view.activeSpaceId };
}

export function readSpaceScope(): SpaceScope | null {
  const { view, state } = useSpacesStore.getState();
  return view === null ? null : { view, state, spaceId: view.activeSpaceId };
}

export function spaceOfProjectRef(scope: SpaceScope, ref: SpacesProjectRef): string | null {
  const refKey = spacesProjectRefKey(ref);
  if (scope.view.scratchProjectRefKeys.has(refKey)) return null;
  return scope.view.spaceByProjectRefKey.get(refKey) ?? UNASSIGNED_SPACE_ID;
}

// Scratch projects are shared by every space; their threads are scoped one by
// one instead.
export function isProjectInSpace(scope: SpaceScope, ref: SpacesProjectRef): boolean {
  const spaceId = spaceOfProjectRef(scope, ref);
  return spaceId === null || spaceId === scope.spaceId;
}

export interface SpaceScopedThread {
  readonly environmentId: EnvironmentId;
  readonly id: ThreadId;
  readonly projectId: string;
}

export function spaceOfThreadShell(scope: SpaceScope, thread: SpaceScopedThread): string {
  return spaceOfThread(scope.view, scope.state, {
    threadKey: scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
    projectRef: { environmentId: thread.environmentId, projectId: thread.projectId },
  });
}

export function useSpaceScopedThreads<T extends SpaceScopedThread>(
  threads: readonly T[],
): readonly T[] {
  const scope = useSpaceScope();
  if (scope === null) return threads;
  return threads.filter((thread) => spaceOfThreadShell(scope, thread) === scope.spaceId);
}

export function useSpaceScopedProjects<
  T extends { readonly environmentId: EnvironmentId; readonly id: string },
>(projects: readonly T[]): readonly T[] {
  const scope = useSpaceScope();
  if (scope === null) return projects;
  return projects.filter((project) =>
    isProjectInSpace(scope, { environmentId: project.environmentId, projectId: project.id }),
  );
}

export function useSpaceScopedProjectGroups<
  T extends { readonly memberProjectRefs: readonly SpacesProjectRef[] },
>(groups: readonly T[]): readonly T[] {
  const scope = useSpaceScope();
  if (scope === null) return groups;
  return groups.filter((group) =>
    group.memberProjectRefs.some((ref) => isProjectInSpace(scope, ref)),
  );
}

export function useSpaceDraftFilter():
  | ((session: {
      readonly environmentId: EnvironmentId;
      readonly threadId: ThreadId;
      readonly projectId: string;
    }) => boolean)
  | null {
  const scope = useSpaceScope();
  if (scope === null) return null;
  return (session) =>
    spaceOfThreadShell(scope, {
      environmentId: session.environmentId,
      id: session.threadId,
      projectId: session.projectId,
    }) === scope.spaceId;
}
