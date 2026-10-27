import { Activity, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { SidebarChromeFooter, SidebarChromeHeader } from "../components/sidebar/SidebarChrome";
import { isElectron } from "../env";
import { useStableCallback } from "../hooks/useStableCallback";
import { SpacePage } from "./spacePage";
import { registerSpaceScroll } from "./spaceScroll";
import { useSpacesStore } from "./spacesStore";
import { SpaceSwitcher } from "./SpaceSwitcher";
import { beginTintBlend, endTintBlend, setTintBlend } from "./spaceTintLayers";
import { useSwitchSpace } from "./useSwitchSpace";

// Without scrollend (older Safari), a quiet gap that outlasts momentum.
const SCROLL_SETTLE_FALLBACK_MS = 160;
const SNAP_EPSILON = 0.001;
// Scroll areas inside a page contain overscroll; horizontal swipes have to
// chain past them to reach the strip.
const CHAIN_HORIZONTAL_SCROLL = `[data-space-strip] [data-slot="scroll-area-viewport"] {
  overscroll-behavior-x: auto;
}`;

type PageRange = readonly [number, number];

function sameRange(left: PageRange | null, right: PageRange | null): boolean {
  return left === right || (left?.[0] === right?.[0] && left?.[1] === right?.[1]);
}

// One thread sidebar per space in a scroll-snapped strip. Swiping is native
// scrolling, so it never waits on React; the active space changes on settle.
// Neighbours stay mounted to scroll in; farther pages are hidden <Activity>
// trees revealed one page ahead of the scroll.
export function SpaceSidebarPages({ sidebar }: { sidebar: ReactNode }) {
  const switchSpace = useSwitchSpace();
  const activeSpaceId = useSpacesStore(
    (store) => store.view?.activeSpaceId ?? store.state.activeSpaceId,
  );
  const switcher = useSpacesStore((store) => store.view?.switcher);
  const spaceIds = switcher ? switcher.map((entry) => entry.id) : [activeSpaceId];
  const activeIndex = Math.max(0, spaceIds.indexOf(activeSpaceId));
  // Pages the scroll currently spans (plus one ahead), so they are revealed
  // before they come into view.
  const [scrollRange, setScrollRange] = useState<PageRange | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  // Set while a switcher click scrolls the strip, so the active space can
  // change right away without the strip jumping to it.
  const scrollTargetRef = useRef<number | null>(null);
  const blendFromRef = useRef<number | null>(null);

  const isShown = (index: number) =>
    Math.abs(index - activeIndex) <= 1 ||
    (scrollRange !== null && index >= scrollRange[0] && index <= scrollRange[1]);

  // Follows switches made anywhere else (palette, routes, deletes) instantly.
  // oxlint-disable-next-line t3code/react-effect-budget -- Scrolls the strip to a switch made elsewhere before paint, so it never jumps.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip || scrollTargetRef.current !== null) return;
    const left = activeIndex * strip.clientWidth;
    if (Math.abs(strip.scrollLeft - left) > 1) strip.scrollTo({ left, behavior: "instant" });
  }, [activeIndex]);

  const onScroll = useStableCallback((strip: HTMLElement) => {
    const width = strip.clientWidth;
    if (width <= 0) return;
    const position = strip.scrollLeft / width;
    const from = Math.floor(position + SNAP_EPSILON);
    const fraction = Math.max(0, position - from);
    if (scrollTargetRef.current === null) {
      const next: PageRange = [from - 1, Math.ceil(position - SNAP_EPSILON) + 1];
      setScrollRange((current) => (sameRange(current, next) ? current : next));
    }
    if (fraction < SNAP_EPSILON && from === activeIndex) {
      blendFromRef.current = null;
      endTintBlend();
      return;
    }
    if (blendFromRef.current !== from) {
      blendFromRef.current = from;
      const colors = useSpacesStore.getState().view?.switcher.map((entry) => entry.color) ?? [];
      // Unassigned's color is null, so only a missing page may fall back.
      const to = from + 1 < colors.length ? colors[from + 1] : colors[from];
      beginTintBlend(colors[from] ?? null, to ?? null);
    }
    setTintBlend(fraction);
  });

  const onScrollSettled = useStableCallback((strip: HTMLElement) => {
    scrollTargetRef.current = null;
    setScrollRange(null);
    const width = strip.clientWidth;
    if (width <= 0) return;
    const index = Math.round(strip.scrollLeft / width);
    const spaceId = spaceIds[index];
    if (spaceId !== undefined && spaceId !== activeSpaceId) switchSpace(spaceId);
    blendFromRef.current = null;
    endTintBlend();
  });

  // oxlint-disable-next-line t3code/react-effect-budget -- Owns the strip's scroll listeners and the space-scroll registration, released on unmount.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const hasScrollEnd = "onscrollend" in window;
    let fallbackTimer: number | null = null;
    const scroll = () => {
      onScroll(strip);
      if (hasScrollEnd) return;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(() => onScrollSettled(strip), SCROLL_SETTLE_FALLBACK_MS);
    };
    const settled = () => onScrollSettled(strip);
    strip.addEventListener("scroll", scroll, { passive: true });
    if (hasScrollEnd) strip.addEventListener("scrollend", settled);
    registerSpaceScroll((spaceId) => {
      const index = useSpacesStore
        .getState()
        .view?.switcher.findIndex((entry) => entry.id === spaceId);
      if (index === undefined || index < 0 || strip.clientWidth <= 0) return false;
      const current = Math.round(strip.scrollLeft / strip.clientWidth);
      // Reveal every page the scroll passes before it starts moving.
      flushSync(() => setScrollRange([Math.min(current, index), Math.max(current, index)]));
      scrollTargetRef.current = index;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      strip.scrollTo({
        left: index * strip.clientWidth,
        behavior: reducedMotion ? "instant" : "smooth",
      });
      return true;
    });
    return () => {
      registerSpaceScroll(null);
      strip.removeEventListener("scroll", scroll);
      strip.removeEventListener("scrollend", settled);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    };
  }, [onScroll, onScrollSettled]);

  return (
    <>
      <SidebarChromeHeader isElectron={isElectron} />
      <style>{CHAIN_HORIZONTAL_SCROLL}</style>
      <div
        ref={stripRef}
        data-space-strip=""
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none]"
      >
        {spaceIds.map((spaceId, index) => (
          <div key={spaceId} className="relative w-full shrink-0 snap-start snap-always">
            <SpacePage spaceId={spaceId}>
              <Activity mode={isShown(index) ? "visible" : "hidden"}>
                <div className="absolute inset-0 flex flex-col">{sidebar}</div>
              </Activity>
            </SpacePage>
          </div>
        ))}
      </div>
      <SpaceSwitcher />
      <SidebarChromeFooter />
    </>
  );
}
