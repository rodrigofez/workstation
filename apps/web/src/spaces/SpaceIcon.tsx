import { InboxIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import type { SpaceColor, SpaceSwitcherEntry } from "./spacesModel";

// Static class names so Tailwind keeps them. Each color reads in light and
// dark mode; the tint is deliberately faint and never touches app accents.
export const SPACE_COLOR_CLASSES: Record<
  SpaceColor,
  { readonly label: string; readonly fill: string; readonly soft: string; readonly tint: string }
> = {
  blue: { label: "Blue", fill: "bg-blue-500", soft: "bg-blue-500/18", tint: "bg-blue-500/[0.05]" },
  violet: {
    label: "Violet",
    fill: "bg-violet-500",
    soft: "bg-violet-500/18",
    tint: "bg-violet-500/[0.05]",
  },
  pink: { label: "Pink", fill: "bg-pink-500", soft: "bg-pink-500/18", tint: "bg-pink-500/[0.05]" },
  red: { label: "Red", fill: "bg-red-500", soft: "bg-red-500/18", tint: "bg-red-500/[0.05]" },
  orange: {
    label: "Orange",
    fill: "bg-orange-500",
    soft: "bg-orange-500/18",
    tint: "bg-orange-500/[0.05]",
  },
  amber: {
    label: "Amber",
    fill: "bg-amber-500",
    soft: "bg-amber-500/18",
    tint: "bg-amber-500/[0.05]",
  },
  green: {
    label: "Green",
    fill: "bg-green-500",
    soft: "bg-green-500/18",
    tint: "bg-green-500/[0.05]",
  },
  teal: { label: "Teal", fill: "bg-teal-500", soft: "bg-teal-500/18", tint: "bg-teal-500/[0.05]" },
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
