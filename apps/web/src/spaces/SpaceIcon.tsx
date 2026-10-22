import { InboxIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import type { SpaceColor, SpaceSwitcherEntry } from "./spacesModel";

// Static class names so Tailwind keeps them. The tint is Tailwind's 500 shade
// as raw OKLCH because SpaceTint paints it from a scoped style rule.
export const SPACE_COLOR_CLASSES: Record<
  SpaceColor,
  { readonly label: string; readonly fill: string; readonly soft: string; readonly tint: string }
> = {
  blue: { label: "Blue", fill: "bg-blue-500", soft: "bg-blue-500/18", tint: "62.3% 0.214 259.815" },
  violet: {
    label: "Violet",
    fill: "bg-violet-500",
    soft: "bg-violet-500/18",
    tint: "60.6% 0.25 292.717",
  },
  pink: { label: "Pink", fill: "bg-pink-500", soft: "bg-pink-500/18", tint: "65.6% 0.241 354.308" },
  red: { label: "Red", fill: "bg-red-500", soft: "bg-red-500/18", tint: "63.7% 0.237 25.331" },
  orange: {
    label: "Orange",
    fill: "bg-orange-500",
    soft: "bg-orange-500/18",
    tint: "70.5% 0.213 47.604",
  },
  amber: {
    label: "Amber",
    fill: "bg-amber-500",
    soft: "bg-amber-500/18",
    tint: "76.9% 0.188 70.08",
  },
  green: {
    label: "Green",
    fill: "bg-green-500",
    soft: "bg-green-500/18",
    tint: "72.3% 0.219 149.579",
  },
  teal: { label: "Teal", fill: "bg-teal-500", soft: "bg-teal-500/18", tint: "70.4% 0.14 182.503" },
};

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
      <span aria-hidden className={cn("text-base leading-none", className)}>
        {space.emoji}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 items-center justify-center rounded-sm text-3xs leading-none font-semibold text-white",
        SPACE_COLOR_CLASSES[space.color].fill,
        className,
      )}
    >
      {Array.from(space.name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
