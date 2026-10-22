// A two-finger horizontal swipe over the sidebar, as a pure state machine:
// wheel deltas in, drag progress and a release decision out. The caller
// decides when a gesture ends (wheel events carry no end signal).

export interface SwipeContext {
  readonly width: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly reducedMotion: boolean;
}

export interface SwipeState {
  // "ignored" holds a gesture that started vertically so it never turns into
  // a swipe midway through a scroll.
  readonly phase: "idle" | "dragging" | "ignored";
  // Positive pulls the previous space in from the left.
  readonly offset: number;
  readonly lastDelta: number;
}

export type SwipeDecision = "previous" | "next" | "stay";

export const IDLE_SWIPE: SwipeState = { phase: "idle", offset: 0, lastDelta: 0 };

const START_THRESHOLD_PX = 2;
const FLICK_DELTA_PX = 20;
const RUBBER_BAND_RESISTANCE = 0.15;
const RUBBER_BAND_MAX_FRACTION = 0.1;

export function wheelSwipe(
  state: SwipeState,
  event: { readonly deltaX: number; readonly deltaY: number; readonly context: SwipeContext },
): SwipeState {
  if (event.context.reducedMotion || state.phase === "ignored") return state;
  if (state.phase === "idle") {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      return Math.abs(event.deltaY) > 0 ? { ...IDLE_SWIPE, phase: "ignored" } : state;
    }
    if (Math.abs(event.deltaX) < START_THRESHOLD_PX) return state;
  }
  const delta = -event.deltaX;
  return { phase: "dragging", offset: state.offset + delta, lastDelta: delta };
}

function hasNeighbour(offset: number, context: SwipeContext): boolean {
  return offset > 0 ? context.hasPrevious : context.hasNext;
}

// How far the sidebar has moved, as a fraction of its width; at an edge the
// pull is damped and capped.
export function swipeProgress(state: SwipeState, context: SwipeContext): number {
  if (state.phase !== "dragging" || context.width <= 0) return 0;
  const raw = state.offset / context.width;
  if (hasNeighbour(state.offset, context)) return Math.max(-1, Math.min(1, raw));
  const damped = Math.min(Math.abs(raw) * RUBBER_BAND_RESISTANCE, RUBBER_BAND_MAX_FRACTION);
  return Math.sign(raw) * damped;
}

export function releaseSwipe(state: SwipeState, context: SwipeContext): SwipeDecision {
  if (state.phase !== "dragging" || state.offset === 0) return "stay";
  if (!hasNeighbour(state.offset, context)) return "stay";
  const flicked = Math.abs(state.lastDelta) >= FLICK_DELTA_PX;
  const towardSide = Math.sign(state.lastDelta) === Math.sign(state.offset);
  // A flick back toward the current space cancels even past halfway.
  if (flicked && !towardSide) return "stay";
  if (!flicked && Math.abs(state.offset) < context.width / 2) return "stay";
  return state.offset > 0 ? "previous" : "next";
}
