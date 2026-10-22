import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ContextMenuItem, EnvironmentId, ThreadId } from "@t3tools/contracts";

import { spacesProjectRefKey, UNASSIGNED_ENTRY } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";
import { assignProjectGroupToSpace, moveScratchThreadsToSpace } from "./spaceActions";
import { readSpaceScope, spaceOfThreadShell } from "./useSpaceScope";

const MOVE_TO_SPACE_PREFIX = "move-to-space:";
export type MoveToSpaceMenuId = `move-to-space:${string}`;

interface MenuThread {
  readonly environmentId: EnvironmentId;
  readonly id: ThreadId;
  readonly projectId: string;
}

function isScratchThread(thread: MenuThread): boolean {
  return (
    readSpaceScope()?.view.scratchProjectRefKeys.has(
      spacesProjectRefKey({ environmentId: thread.environmentId, projectId: thread.projectId }),
    ) ?? false
  );
}

// "Move project to space ▸" moves the thread's whole project group; a
// no-project thread has no group, so only that thread moves.
function appendMoveToSpaceMenu<T extends string>(
  items: readonly ContextMenuItem<T>[],
  thread: MenuThread,
): readonly ContextMenuItem<T | MoveToSpaceMenuId>[] {
  const scope = readSpaceScope();
  if (scope === null) return items;
  const currentSpaceId = spaceOfThreadShell(scope, thread);
  return [
    ...items,
    {
      id: `${MOVE_TO_SPACE_PREFIX}menu`,
      label: isScratchThread(thread) ? "Move thread to space" : "Move project to space",
      separatorBefore: true,
      children: [...scope.state.spaces, UNASSIGNED_ENTRY].map((space) => ({
        id: `${MOVE_TO_SPACE_PREFIX}${space.id}` as const,
        label: space.emoji ? `${space.emoji} ${space.name}` : space.name,
        checked: space.id === currentSpaceId,
      })),
    },
  ];
}

interface ContextMenuApi {
  readonly show: <T extends string>(
    items: readonly ContextMenuItem<T>[],
    position?: { x: number; y: number },
  ) => Promise<T | null>;
}

export function withMoveToSpaceMenu(contextMenu: ContextMenuApi, thread: MenuThread) {
  return {
    show: <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => contextMenu.show(appendMoveToSpaceMenu(items, thread), position),
  };
}

export function isMoveToSpaceChoice(value: string): value is MoveToSpaceMenuId {
  return value.startsWith(MOVE_TO_SPACE_PREFIX);
}

export function applyMoveToSpaceChoice(choice: MoveToSpaceMenuId, thread: MenuThread): void {
  const spaceId = choice.slice(MOVE_TO_SPACE_PREFIX.length);
  if (isScratchThread(thread)) {
    moveScratchThreadsToSpace(
      [scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
      spaceId,
    );
    return;
  }
  const refKey = spacesProjectRefKey({
    environmentId: thread.environmentId,
    projectId: thread.projectId,
  });
  const group = useSpacesStore
    .getState()
    .catalog?.groups.find((candidate) =>
      candidate.projectRefs.some((ref) => spacesProjectRefKey(ref) === refKey),
    );
  if (group !== undefined) assignProjectGroupToSpace(group.key, spaceId);
}
