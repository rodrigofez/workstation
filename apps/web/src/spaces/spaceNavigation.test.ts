import { describe, expect, it, vi } from "vite-plus/test";

import { scheduleSpaceNavigation, SPACE_NAVIGATION_SETTLE_MS } from "./spaceNavigation";

function setup() {
  vi.useFakeTimers();
  const location = { activeSpaceId: "work" as string | null, href: "/a" };
  const navigated: string[] = [];
  const request = (spaceId: string) => {
    location.activeSpaceId = spaceId;
    scheduleSpaceNavigation({
      spaceId,
      href: location.href,
      current: () => ({ ...location }),
      navigate: () => navigated.push(spaceId),
    });
  };
  return {
    location,
    navigated,
    request,
    [Symbol.dispose]: () => vi.useRealTimers(),
  };
}

describe("scheduleSpaceNavigation", () => {
  it("opens only the last space when switching through several", () => {
    using env = setup();
    env.request("personal");
    vi.advanceTimersByTime(SPACE_NAVIGATION_SETTLE_MS / 2);
    env.request("side");
    vi.advanceTimersByTime(SPACE_NAVIGATION_SETTLE_MS);

    expect(env.navigated).toEqual(["side"]);
  });

  it("skips when a thread was opened by hand before it fires", () => {
    using env = setup();
    env.request("personal");
    env.location.href = "/picked-by-hand";
    vi.advanceTimersByTime(SPACE_NAVIGATION_SETTLE_MS);

    expect(env.navigated).toEqual([]);
  });

  it("skips when the user already left the space", () => {
    using env = setup();
    env.request("personal");
    env.location.activeSpaceId = "work";
    vi.advanceTimersByTime(SPACE_NAVIGATION_SETTLE_MS);

    expect(env.navigated).toEqual([]);
  });
});
