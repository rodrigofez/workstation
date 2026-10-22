import { InboxIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import type { SpaceColor, SpaceSwitcherEntry } from "./spacesModel";

// One lightness and chroma for every hue, so custom hues sit as calmly as the
// presets in both themes. The hue comes in as HSL degrees (the slider's unit)
// and is converted by the browser.
export function spaceColorCss(color: SpaceColor, alpha = 1): string {
  return `oklch(from hsl(${color.hue} 100% 50%) 0.64 0.17 h${alpha < 1 ? ` / ${alpha}` : ""})`;
}

// Background behind the active space's icon and its empty-state tile.
export function spaceSoftCss(color: SpaceColor): string {
  return spaceColorCss(color, 0.18);
}

export function SpaceIcon({
  space,
  className,
}: {
  space: Pick<SpaceSwitcherEntry, "name" | "emoji" | "color">;
  className?: string;
}) {
  if (space.color === null) {
    return <InboxIcon aria-hidden className={cn("size-4", className)} />;
  }
  if (space.emoji !== null) {
    return (
      <span
        aria-hidden
        className={cn("flex items-center justify-center text-base leading-none", className)}
      >
        {space.emoji}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{ backgroundColor: spaceColorCss(space.color) }}
      className={cn(
        "flex size-4 items-center justify-center rounded-sm text-3xs leading-none font-semibold text-white",
        className,
      )}
    >
      {Array.from(space.name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
