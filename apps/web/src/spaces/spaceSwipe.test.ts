import { describe, expect, it } from "vite-plus/test";

import {
  IDLE_SWIPE,
  releaseSwipe,
  swipeProgress,
  wheelSwipe,
  type SwipeContext,
} from "./spaceSwipe";

const middle: SwipeContext = { width: 300, hasPrevious: true, hasNext: true, reducedMotion: false };

function drag(deltas: ReadonlyArray<number | [number, number]>, context: SwipeContext = middle) {
  return deltas.reduce(
    (state, delta) =>
      wheelSwipe(state, {
        deltaX: Array.isArray(delta) ? delta[0] : delta,
        deltaY: Array.isArray(delta) ? delta[1] : 0,
        context,
      }),
    IDLE_SWIPE,
  );
}

describe("space swipe", () => {
  it("follows the fingers: swiping left drags toward the next space", () => {
    const state = drag([10, 20, 30]);

    expect(swipeProgress(state, middle)).toBeCloseTo(-0.2);
  });

  it("commits to the neighbour once past halfway", () => {
    expect(releaseSwipe(drag([60, 60, 40]), middle)).toBe("next");
    expect(releaseSwipe(drag([-60, -60, -40]), middle)).toBe("previous");
  });

  it("snaps back after a short, slow swipe", () => {
    expect(releaseSwipe(drag([4, 4, 4, 4, 3]), middle)).toBe("stay");
  });

  it("commits a short swipe that ends in a flick toward the side", () => {
    expect(releaseSwipe(drag([4, 8, 30]), middle)).toBe("next");
  });

  it("does not commit when the flick reverses direction", () => {
    expect(releaseSwipe(drag([60, 60, -30]), middle)).toBe("stay");
  });

  it("rubber-bands at the first and last space without wrapping", () => {
    const atFirst: SwipeContext = { ...middle, hasPrevious: false };
    const pulled = drag([-100, -100, -100], atFirst);

    expect(swipeProgress(pulled, atFirst)).toBeGreaterThan(0);
    expect(swipeProgress(pulled, atFirst)).toBeLessThan(0.15);
    expect(releaseSwipe(pulled, atFirst)).toBe("stay");

    const atLast: SwipeContext = { ...middle, hasNext: false };
    expect(releaseSwipe(drag([200, 200], atLast), atLast)).toBe("stay");
  });

  it("leaves vertical scrolling alone", () => {
    const state = drag([
      [2, 30],
      [40, 30],
      [80, 10],
    ]);

    expect(swipeProgress(state, middle)).toBe(0);
    expect(releaseSwipe(state, middle)).toBe("stay");
  });

  it("does nothing under reduced motion", () => {
    const reduced = { ...middle, reducedMotion: true };
    const state = drag([100, 100, 100], reduced);

    expect(swipeProgress(state, reduced)).toBe(0);
    expect(releaseSwipe(state, reduced)).toBe("stay");
  });
});
