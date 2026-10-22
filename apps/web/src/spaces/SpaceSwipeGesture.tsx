import { useRef, useState } from "react";

import { useMediaQuery } from "../hooks/useMediaQuery";
import { useStableCallback } from "../hooks/useStableCallback";
import { useQuietThreadShells } from "../state/entities";
import { SpaceIcon } from "./SpaceIcon";
import { useSpacesStore } from "./spacesStore";
import {
  IDLE_SWIPE,
  releaseSwipe,
  swipeProgress,
  wheelSwipe,
  type SwipeContext,
  type SwipeState,
} from "./spaceSwipe";
import { spaceOfThreadShell } from "./useSpaceScope";
import { useSwitchSpace } from "./useSwitchSpace";

// Wheel events carry no end; a short quiet gap (which also outlasts macOS
// momentum) ends the gesture.
const SWIPE_RELEASE_GAP_MS = 140;
const SNAP_BACK_TRANSITION = "transform 160ms ease-out";
const PREVIEW_THREAD_LIMIT = 8;

type PreviewSide = "previous" | "next";

function SpaceSwipePreview({ spaceId, side }: { spaceId: string; side: PreviewSide }) {
  const view = useSpacesStore((store) => store.view);
  const state = useSpacesStore((store) => store.state);
  const threads = useQuietThreadShells();
  const entry = view?.switcher.find((candidate) => candidate.id === spaceId);
  if (view === null || entry === undefined) return null;
  const titles = threads
    .filter(
      (thread) =>
        thread.archivedAt === null &&
        spaceOfThreadShell({ view, state, spaceId: view.activeSpaceId }, thread) === spaceId,
    )
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, PREVIEW_THREAD_LIMIT);
  return (
    <div
      aria-hidden
      className={
        side === "next"
          ? "pointer-events-none absolute top-0 left-full flex h-full w-full flex-col gap-1 px-3 py-2"
          : "pointer-events-none absolute top-0 right-full flex h-full w-full flex-col gap-1 px-3 py-2"
      }
    >
      <div className="flex items-center gap-1.5 pb-1 text-xs font-medium text-sidebar-muted-foreground">
        <SpaceIcon space={entry} className="size-3.5 text-sm" />
        {entry.name}
      </div>
      {titles.map((thread) => (
        <div
          key={thread.id}
          className="truncate rounded-md px-2 py-1.5 text-sm text-sidebar-foreground"
        >
          {thread.title}
        </div>
      ))}
    </div>
  );
}

// Two-finger horizontal swipes over the thread list drag it toward the
// neighbouring space. Only transform changes while dragging, written straight
// to the element so streaming-heavy lists never re-render per wheel event; the
// neighbour preview mounts for the gesture alone.
export function SpaceSwipe() {
  const switchSpace = useSwitchSpace();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [preview, setPreview] = useState<{ spaceId: string; side: PreviewSide } | null>(null);
  const swipeRef = useRef<SwipeState>(IDLE_SWIPE);
  const releaseTimerRef = useRef<number | null>(null);

  const readContext = (element: HTMLElement) => {
    const view = useSpacesStore.getState().view;
    if (view === null) return null;
    const index = view.switcher.findIndex((entry) => entry.id === view.activeSpaceId);
    const context: SwipeContext = {
      width: element.clientWidth,
      hasPrevious: index > 0,
      hasNext: index >= 0 && index < view.switcher.length - 1,
      reducedMotion,
    };
    return {
      context,
      neighbour: (side: PreviewSide) =>
        view.switcher[index + (side === "next" ? 1 : -1)]?.id ?? null,
    };
  };

  const release = useStableCallback((element: HTMLElement) => {
    releaseTimerRef.current = null;
    const state = swipeRef.current;
    swipeRef.current = IDLE_SWIPE;
    const resolved = readContext(element);
    if (state.phase !== "dragging" || resolved === null) return;
    const decision = releaseSwipe(state, resolved.context);
    const target = decision === "stay" ? null : resolved.neighbour(decision);
    if (target !== null) {
      element.style.transition = "";
      element.style.transform = "";
      setPreview(null);
      switchSpace(target);
      return;
    }
    element.style.transition = SNAP_BACK_TRANSITION;
    element.style.transform = "";
    element.addEventListener(
      "transitionend",
      () => {
        element.style.transition = "";
        if (swipeRef.current.phase !== "dragging") setPreview(null);
      },
      { once: true },
    );
  });

  const onWheel = useStableCallback((event: WheelEvent, element: HTMLElement) => {
    const resolved = readContext(element);
    if (resolved === null) return;
    const next = wheelSwipe(swipeRef.current, {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      context: resolved.context,
    });
    swipeRef.current = next;
    if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = window.setTimeout(() => release(element), SWIPE_RELEASE_GAP_MS);
    if (next.phase !== "dragging") return;
    event.preventDefault();
    const progress = swipeProgress(next, resolved.context);
    element.style.transition = "";
    element.style.transform = `translateX(${progress * resolved.context.width}px)`;
    const side: PreviewSide = next.offset > 0 ? "previous" : "next";
    const spaceId = resolved.neighbour(side);
    if (spaceId !== null && (preview?.spaceId !== spaceId || preview.side !== side)) {
      setPreview({ spaceId, side });
    }
  });

  // The marker binds to its parent, the thread list group, so the sidebar only
  // has to render <SpaceSwipe /> inside it.
  const attach = (marker: HTMLElement | null) => {
    const element = marker?.parentElement;
    if (!element) return;
    const listener = (event: WheelEvent) => onWheel(event, element);
    element.addEventListener("wheel", listener, { passive: false });
    return () => {
      element.removeEventListener("wheel", listener);
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    };
  };

  return (
    <>
      <span hidden ref={attach} />
      {preview ? <SpaceSwipePreview spaceId={preview.spaceId} side={preview.side} /> : null}
    </>
  );
}
