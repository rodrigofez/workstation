import { useEffect } from "react";
import { createPortal } from "react-dom";

import { SpaceIcon } from "./SpaceIcon";
import { useSpacesStore } from "./spacesStore";
import { useSpaceHudStore } from "./useSwitchSpace";

const HUD_VISIBLE_MS = 1000;

// Shown only for keyboard switches while the sidebar is hidden, like the
// macOS volume HUD. It appears and disappears without animating.
export function SpaceSwitchHud() {
  const spaceId = useSpaceHudStore((store) => store.spaceId);
  const token = useSpaceHudStore((store) => store.token);
  const entry = useSpacesStore((store) =>
    store.view?.switcher.find((candidate) => candidate.id === spaceId),
  );
  // oxlint-disable-next-line t3code/react-effect-budget -- Hides the HUD after a fixed delay; the timer is cleared on change or unmount.
  useEffect(() => {
    if (spaceId === null) return;
    const timeout = window.setTimeout(
      () => useSpaceHudStore.getState().hide(token),
      HUD_VISIBLE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [spaceId, token]);
  if (spaceId === null || entry === undefined) return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="flex min-w-40 flex-col items-center gap-2 rounded-2xl bg-popover/90 px-6 py-5 text-popover-foreground shadow-lg ring-1 ring-border backdrop-blur-md">
        <SpaceIcon space={entry} className="size-10 text-4xl" />
        <span className="text-sm font-medium">{entry.name}</span>
      </div>
    </div>,
    document.body,
  );
}
