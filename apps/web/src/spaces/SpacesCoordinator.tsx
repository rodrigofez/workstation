import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { derivePhysicalProjectKey } from "@t3tools/client-runtime/state/project-grouping";
import { useEffect, useRef } from "react";

import { onOpenCommandPalette, isCommandPaletteOpen } from "../commandPaletteBus";
import { useComposerDraftStore } from "../composerDraftStore";
import { filterSidebarV2VisibleThreads } from "../components/Sidebar.logic";
import { useSidebarVisibility } from "../components/ui/sidebar";
import { useSidebarProjectGroups } from "../hooks/useSidebarProjectGroups";
import { useThreadRouteTarget } from "../hooks/useThreadRouteTarget";
import { useProjects, useQuietThreadShells } from "../state/entities";
import { allReachableShellsLiveAtom } from "../state/shell";
import { useUiStateStore } from "../uiStateStore";
import { markAddProjectStarted, takeAddProjectOrigin } from "./addProjectOrigin";
import { SpaceSwitchHud } from "./SpaceSwitchHud";
import {
  isKnownProjectRef,
  recordProjectCreatedInSpace,
  recordScratchThread,
  recordSpaceVisit,
  rememberSpacePicker,
  resolveSpaceShortcut,
  spaceOfThread,
  spacePicker,
  spacesProjectRefKey,
  type SpaceRouteTarget,
  type SpacesCatalog,
} from "./spacesModel";
import { setSpacesCoordinatorMounted, useSpacesStore } from "./spacesStore";
import {
  resolveSpaceShortcutCommand,
  spaceShortcutFromCommand,
  useSpaceShortcutStore,
} from "./spaceShortcuts";
import { spaceTargetLookup, useSwitchSpace } from "./useSwitchSpace";

function parseTimestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function useSpacesCatalog(): SpacesCatalog {
  const groups = useSidebarProjectGroups();
  const threads = useQuietThreadShells();
  // Settled-offline environments count as ready: they keep their cached
  // projects, and waiting for them would stall sorting while the VPS is down.
  const shellsReady = useAtomValue(allReachableShellsLiveAtom);
  const lastUsedByProjectRef = new Map<string, number>();
  for (const thread of threads) {
    const key = spacesProjectRefKey({
      environmentId: thread.environmentId,
      projectId: thread.projectId,
    });
    const usedAt = parseTimestamp(thread.updatedAt);
    if (usedAt > (lastUsedByProjectRef.get(key) ?? 0)) lastUsedByProjectRef.set(key, usedAt);
  }
  const scratchRefKeys = new Set(
    groups
      .filter((group) => group.isScratch)
      .flatMap((group) => group.memberProjectRefs.map(spacesProjectRefKey)),
  );
  return {
    ready: shellsReady,
    groups: groups.map((group) => ({
      key: group.projectKey,
      isScratch: group.isScratch === true,
      members: group.memberProjects.map((member) => ({
        physicalKey: member.physicalProjectKey,
        environmentId: member.environmentId,
        lastUsedAt: Math.max(
          parseTimestamp(member.updatedAt),
          lastUsedByProjectRef.get(
            spacesProjectRefKey({ environmentId: member.environmentId, projectId: member.id }),
          ) ?? 0,
        ),
      })),
      projectRefs: group.memberProjectRefs,
    })),
    scratchThreadKeys: filterSidebarV2VisibleThreads(threads, scratchRefKeys).map((thread) =>
      scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
    ),
  };
}

function routeTargetKey(target: SpaceRouteTarget | null): string | null {
  if (target === null) return null;
  return target.kind === "thread"
    ? `thread:${target.environmentId}:${target.threadId}`
    : `draft:${target.draftId}`;
}

// The route is the one place every thread opening passes through (sidebar,
// palette, notifications, deep links), so it records where each space was
// and switches first when the thread belongs to another space.
function useSpaceRouteTracking(switchSpace: ReturnType<typeof useSwitchSpace>) {
  const routeTarget = useThreadRouteTarget();
  const view = useSpacesStore((store) => store.view);
  const target: SpaceRouteTarget | null =
    routeTarget === null
      ? null
      : routeTarget.kind === "server"
        ? {
            kind: "thread",
            environmentId: routeTarget.threadRef.environmentId,
            threadId: routeTarget.threadRef.threadId,
          }
        : { kind: "draft", draftId: routeTarget.draftId };
  const targetKey = routeTargetKey(target);
  const handledKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (target === null || view === null || handledKeyRef.current === targetKey) return;
    const ref =
      target.kind === "thread"
        ? spaceTargetLookup.thread(target)
        : spaceTargetLookup.draft(target.draftId);
    // Retried on the next catalog update until the thread and its project load.
    if (ref === null || !isKnownProjectRef(view, ref.projectRef)) return;
    handledKeyRef.current = targetKey;
    const { state, update } = useSpacesStore.getState();
    const threadSpaceId = spaceOfThread(view, state, ref);
    if (threadSpaceId !== view.activeSpaceId) {
      switchSpace(threadSpaceId, { navigate: false });
    }
    const activeSpaceId = useSpacesStore.getState().view?.activeSpaceId;
    if (activeSpaceId === threadSpaceId) {
      update((current) => recordSpaceVisit(current, threadSpaceId, target));
    }
  }, [switchSpace, target, targetKey, view]);
}

function useSpacePickerTracking() {
  const pickerKey = useUiStateStore((store) => store.sidebarProjectScopeKey);
  const activeSpaceId = useSpacesStore((store) => store.view?.activeSpaceId ?? null);
  const appliedRef = useRef(false);
  useEffect(() => {
    if (activeSpaceId === null) return;
    const { state, update } = useSpacesStore.getState();
    if (!appliedRef.current) {
      // The upstream picker key is global; the space's own selection wins.
      appliedRef.current = true;
      const remembered = spacePicker(state, activeSpaceId);
      if (remembered !== pickerKey) {
        useUiStateStore.getState().setSidebarProjectScopeKey(remembered);
        return;
      }
    }
    update((current) => rememberSpacePicker(current, activeSpaceId, pickerKey));
  }, [activeSpaceId, pickerKey]);
}

// No-project drafts created in this session belong to the space that was
// active when they appeared. Drafts that predate the session stay unrecorded.
function useScratchDraftRecording() {
  const sessions = useComposerDraftStore((store) => store.draftThreadsByThreadKey);
  const view = useSpacesStore((store) => store.view);
  const seenRef = useRef<ReadonlySet<string> | null>(null);
  const pendingRef = useRef(new Map<string, string>());
  useEffect(() => {
    if (view === null) return;
    if (seenRef.current === null) {
      seenRef.current = new Set(Object.keys(sessions));
      return;
    }
    const seen = new Set(seenRef.current);
    for (const draftId of Object.keys(sessions)) {
      if (seen.has(draftId)) continue;
      seen.add(draftId);
      pendingRef.current.set(draftId, view.activeSpaceId);
    }
    seenRef.current = seen;
    for (const [draftId, spaceId] of pendingRef.current) {
      const session = sessions[draftId];
      if (session === undefined) {
        pendingRef.current.delete(draftId);
        continue;
      }
      const projectRef = { environmentId: session.environmentId, projectId: session.projectId };
      // A brand-new scratch project may not be in the catalog yet.
      if (!isKnownProjectRef(view, projectRef)) continue;
      pendingRef.current.delete(draftId);
      if (!view.scratchProjectRefKeys.has(spacesProjectRefKey(projectRef))) continue;
      const threadKey = scopedThreadKey(scopeThreadRef(session.environmentId, session.threadId));
      useSpacesStore.getState().update((state) => recordScratchThread(state, threadKey, spaceId));
    }
  }, [sessions, view]);
}

function useAddProjectCapture() {
  const projects = useProjects();
  const ready = useSpacesStore((store) => store.catalog?.ready === true);
  const seenRef = useRef<ReadonlySet<string> | null>(null);
  useEffect(
    () =>
      onOpenCommandPalette((detail) => {
        if (detail.open === "add-project") markAddProjectStarted();
      }),
    [],
  );
  useEffect(() => {
    if (!ready) return;
    const physicalKeys = new Map(
      projects
        .filter((project) => !project.isScratch)
        .map((project) => [derivePhysicalProjectKey(project), project.environmentId] as const),
    );
    const seen = seenRef.current;
    seenRef.current = new Set(physicalKeys.keys());
    if (seen === null) return;
    const created = [...physicalKeys].filter(([physicalKey]) => !seen.has(physicalKey));
    if (created.length === 0) return;
    const spaceId = takeAddProjectOrigin(isCommandPaletteOpen());
    if (spaceId === null) return;
    useSpacesStore
      .getState()
      .update((state) =>
        created.reduce(
          (current, [physicalKey, environmentId]) =>
            recordProjectCreatedInSpace(current, { physicalKey, environmentId }, spaceId),
          state,
        ),
      );
  }, [projects, ready]);
}

// When Unassigned empties or the active space is deleted, the view resolves
// to another space; follow it so the route matches.
function useSpaceAutoSwitch(switchSpace: ReturnType<typeof useSwitchSpace>) {
  const view = useSpacesStore((store) => store.view);
  const storedActiveSpaceId = useSpacesStore((store) => store.state.activeSpaceId);
  useEffect(() => {
    if (view === null || useSpacesStore.getState().catalog?.ready !== true) return;
    if (view.activeSpaceId !== storedActiveSpaceId) switchSpace(view.activeSpaceId);
  }, [storedActiveSpaceId, switchSpace, view]);
}

function useSpaceKeyboardShortcuts(switchSpace: ReturnType<typeof useSwitchSpace>) {
  const overrides = useSpaceShortcutStore((store) => store.overrides);
  const sidebarVisible = useSidebarVisibility();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen()) return;
      const command = resolveSpaceShortcutCommand(event, overrides);
      if (command === null) return;
      const view = useSpacesStore.getState().view;
      if (view === null) return;
      event.preventDefault();
      event.stopPropagation();
      const spaceId = resolveSpaceShortcut(view, spaceShortcutFromCommand(command));
      if (spaceId !== null) {
        switchSpace(spaceId, { hud: !sidebarVisible, animate: sidebarVisible });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overrides, sidebarVisible, switchSpace]);
}

export function SpacesCoordinator() {
  const catalog = useSpacesCatalog();
  const setCatalog = useSpacesStore((store) => store.setCatalog);
  useEffect(() => setCatalog(catalog), [catalog, setCatalog]);
  useEffect(() => {
    setSpacesCoordinatorMounted(true);
    return () => {
      setSpacesCoordinatorMounted(false);
      setCatalog(null);
    };
  }, [setCatalog]);
  const switchSpace = useSwitchSpace();
  useSpaceRouteTracking(switchSpace);
  useSpacePickerTracking();
  useScratchDraftRecording();
  useAddProjectCapture();
  useSpaceAutoSwitch(switchSpace);
  useSpaceKeyboardShortcuts(switchSpace);
  return <SpaceSwitchHud />;
}
