// Opening a space's thread renders the whole chat view, which blocks input
// for a moment. The sidebar switches at once; the thread opens once the user
// pauses, so swiping or clicking through several spaces only loads the last.
export const SPACE_NAVIGATION_SETTLE_MS = 220;

let pending: ReturnType<typeof setTimeout> | null = null;

export interface SpaceNavigationRequest {
  readonly spaceId: string;
  // The location when the switch happened.
  readonly href: string;
  readonly current: () => { readonly activeSpaceId: string | null; readonly href: string };
  readonly navigate: () => void;
}

export function scheduleSpaceNavigation(request: SpaceNavigationRequest): void {
  if (pending !== null) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    const current = request.current();
    // Left the space again, or opened a thread by hand meanwhile.
    if (current.activeSpaceId !== request.spaceId || current.href !== request.href) return;
    request.navigate();
  }, SPACE_NAVIGATION_SETTLE_MS);
}
