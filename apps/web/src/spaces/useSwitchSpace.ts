import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";
import { create } from "zustand";

import { DraftId, useComposerDraftStore } from "../composerDraftStore";
import { readThreadShell } from "../state/entities";
import { buildThreadRouteParams } from "../threadRoutes";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { useUiStateStore } from "../uiStateStore";
import {
  rememberSpacePicker,
  resolveSwitchTarget,
  spacePicker,
  switchSpace,
  type SpaceSwitchTarget,
  type SpaceTargetLookup,
} from "./spacesModel";
import { useSpacesStore } from "./spacesStore";

export const spaceTargetLookup: SpaceTargetLookup = {
  thread: (ref) => {
    const threadRef = scopeThreadRef(
      EnvironmentId.make(ref.environmentId),
      ThreadId.make(ref.threadId),
    );
    const shell = readThreadShell(threadRef);
    if (shell === null || shell.archivedAt !== null) return null;
    return {
      threadKey: scopedThreadKey(threadRef),
      projectRef: { environmentId: shell.environmentId, projectId: shell.projectId },
    };
  },
  draft: (draftId) => {
    const session = useComposerDraftStore.getState().getDraftSession(DraftId.make(draftId));
    if (session === null || session.promotedTo != null) return null;
    return {
      threadKey: scopedThreadKey(scopeThreadRef(session.environmentId, session.threadId)),
      projectRef: { environmentId: session.environmentId, projectId: session.projectId },
    };
  },
};

interface SpaceHudStore {
  readonly spaceId: string | null;
  readonly token: number;
  readonly show: (spaceId: string) => void;
  readonly hide: (token: number) => void;
}

export const useSpaceHudStore = create<SpaceHudStore>((set) => ({
  spaceId: null,
  token: 0,
  show: (spaceId) => set((store) => ({ spaceId, token: store.token + 1 })),
  hide: (token) => set((store) => (store.token === token ? { spaceId: null } : store)),
}));

export function useNavigateToSpaceTarget() {
  const router = useRouter();
  return (target: SpaceSwitchTarget, options?: { readonly replace?: boolean }) => {
    const replace = options?.replace ?? false;
    if (target.kind === "thread") {
      return router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(
          scopeThreadRef(EnvironmentId.make(target.environmentId), ThreadId.make(target.threadId)),
        ),
        replace,
      });
    }
    if (target.kind === "draft") {
      return router.navigate({
        to: "/draft/$draftId",
        params: { draftId: target.draftId },
        replace,
      });
    }
    // Landing goes through "/" so a space's new draft or empty state is
    // decided in one place, SpaceIndexGate.
    return router.navigate({ to: "/", replace });
  };
}

export interface SwitchSpaceOptions {
  // False when a route already shows the space's thread (cross-space links).
  readonly navigate?: boolean;
  readonly hud?: boolean;
}

// Switching only changes what the client shows: running turns, sessions and
// providers are never touched.
export function useSwitchSpace() {
  const navigateToTarget = useNavigateToSpaceTarget();
  const clearSelection = useThreadSelectionStore((store) => store.clearSelection);
  return (spaceId: string, options?: SwitchSpaceOptions) => {
    const before = useSpacesStore.getState();
    if (before.view === null || before.state.activeSpaceId === spaceId) return;
    const fromSpaceId = before.state.activeSpaceId;
    const picker = useUiStateStore.getState().sidebarProjectScopeKey;
    before.update((state) => switchSpace(rememberSpacePicker(state, fromSpaceId, picker), spaceId));
    const after = useSpacesStore.getState();
    if (after.view === null || after.view.activeSpaceId !== spaceId) return;
    clearSelection();
    useUiStateStore.getState().setSidebarProjectScopeKey(spacePicker(after.state, spaceId));
    if (options?.hud) useSpaceHudStore.getState().show(spaceId);
    if (options?.navigate === false) return;
    void navigateToTarget(resolveSwitchTarget(after.view, after.state, spaceId, spaceTargetLookup));
  };
}
