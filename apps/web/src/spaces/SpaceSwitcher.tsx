import { useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState, type MouseEvent as ReactMouseEvent } from "react";

import { cn } from "~/lib/utils";
import { readLocalApi } from "../localApi";
import { Button } from "../components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../components/ui/popover";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { SpaceEditorForm } from "./SpaceEditorForm";
import { SpaceIcon, spaceSoftCss } from "./SpaceIcon";
import { useSpacePageId } from "./spacePage";
import { SpaceTint } from "./SpaceTint";
import { UNASSIGNED_SPACE_ID, type SpaceSwitcherEntry } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";
import { confirmAndDeleteSpace, createSpaceFromDraft, moveSpaceBy } from "./spaceActions";
import { useSpacesNeedingAttention } from "./useSpaceSignals";
import { useSwitchSpace } from "./useSwitchSpace";

type SpaceMenuAction = "edit" | "move-left" | "move-right" | "delete";

function SpaceButton({
  entry,
  active,
  needsAttention,
  onSelect,
  onContextMenu,
}: {
  entry: SpaceSwitcherEntry;
  active: boolean;
  needsAttention: boolean;
  onSelect: (spaceId: string) => void;
  onContextMenu: (entry: SpaceSwitcherEntry, event: ReactMouseEvent) => void;
}) {
  const label = needsAttention ? `${entry.name} (needs attention)` : entry.name;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onSelect(entry.id)}
            onContextMenu={(event) => onContextMenu(entry, event)}
            style={
              active && entry.color ? { backgroundColor: spaceSoftCss(entry.color) } : undefined
            }
            className={cn(
              "relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md outline-hidden transition-[background-color,opacity,scale] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:scale-90",
              active
                ? entry.color === null && "bg-sidebar-row-active"
                : "opacity-60 hover:bg-sidebar-row-hover hover:opacity-100",
            )}
          >
            <SpaceIcon space={entry} />
            {needsAttention ? (
              <span
                aria-hidden
                className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-warning ring-2 ring-sidebar"
              />
            ) : null}
          </button>
        }
      />
      <TooltipPopup side="top">{entry.name}</TooltipPopup>
    </Tooltip>
  );
}

export function SpaceSwitcher() {
  const view = useSpacesStore((store) => store.view);
  const switchSpace = useSwitchSpace();
  const navigate = useNavigate();
  const attention = useSpacesNeedingAttention();
  const [creating, setCreating] = useState(false);
  if (view === null) return null;

  const openMenu = (entry: SpaceSwitcherEntry, event: ReactMouseEvent) => {
    event.preventDefault();
    if (entry.id === UNASSIGNED_SPACE_ID) return;
    const index = view.switcher.findIndex((candidate) => candidate.id === entry.id);
    const lastSpaceIndex =
      view.switcher.filter((candidate) => candidate.id !== UNASSIGNED_SPACE_ID).length - 1;
    void readLocalApi()
      ?.contextMenu.show<SpaceMenuAction>(
        [
          { id: "edit", label: "Edit…" },
          { id: "move-left", label: "Move left", disabled: index <= 0 },
          { id: "move-right", label: "Move right", disabled: index >= lastSpaceIndex },
          { id: "delete", label: "Delete…", destructive: true, separatorBefore: true },
        ],
        { x: event.clientX, y: event.clientY },
      )
      .then((action) => {
        if (action === "edit") {
          void navigate({ to: "/settings/spaces", search: { edit: entry.id } });
        } else if (action === "move-left") {
          moveSpaceBy(entry.id, -1);
        } else if (action === "move-right") {
          moveSpaceBy(entry.id, 1);
        } else if (action === "delete") {
          void confirmAndDeleteSpace(entry.id);
        }
      });
  };

  return (
    <div
      role="toolbar"
      aria-label="Spaces"
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto px-2 pt-1 [scrollbar-width:none]"
    >
      <SpaceTint />
      {view.switcher.map((entry) => (
        <SpaceButton
          key={entry.id}
          entry={entry}
          active={entry.id === view.activeSpaceId}
          needsAttention={entry.id !== view.activeSpaceId && attention.has(entry.id)}
          onSelect={(spaceId) => switchSpace(spaceId, { animate: true })}
          onContextMenu={openMenu}
        />
      ))}
      <Popover open={creating} onOpenChange={setCreating}>
        <PopoverTrigger
          render={<Button size="icon-sm" variant="ghost-muted" aria-label="New space" />}
        >
          <PlusIcon />
        </PopoverTrigger>
        <PopoverPopup side="top" align="start">
          <SpaceEditorForm
            submitLabel="Create space"
            onCancel={() => setCreating(false)}
            onSubmit={(draft) => {
              setCreating(false);
              switchSpace(createSpaceFromDraft(draft), { animate: true });
            }}
          />
        </PopoverPopup>
      </Popover>
    </div>
  );
}

export function SpaceLabel() {
  const pageId = useSpacePageId();
  const activeEntry = useSpacesStore((store) =>
    store.view?.switcher.find((entry) => entry.id === (pageId ?? store.view?.activeSpaceId)),
  );
  if (activeEntry === undefined) return null;
  return (
    <div className="flex h-5 items-center gap-1.5 px-2 text-2xs font-medium tracking-wide text-sidebar-muted-foreground uppercase">
      <SpaceIcon space={activeEntry} className="size-3.5 text-xs" />
      <span className="truncate">{activeEntry.name}</span>
    </div>
  );
}
