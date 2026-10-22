import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon, CloudOffIcon, MessagesSquareIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { openCommandPalette } from "../commandPaletteBus";
import { ProjectFavicon } from "../components/ProjectFavicon";
import { Button } from "../components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../components/ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { useSidebarProjectGroups } from "../hooks/useSidebarProjectGroups";
import { SpaceIcon, spaceSoftCss } from "./SpaceIcon";
import { useSpacePageId } from "./spacePage";
import { UNASSIGNED_SPACE_ID, type SpaceSwitcherEntry } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";
import { assignProjectGroupToSpace, moveScratchThreadsToSpace } from "./spaceActions";
import { useUnavailableSpaceProjects } from "./useSpaceSignals";

const INLINE_SPACE_PICKER_LIMIT = 4;

// One click per project: with a handful of spaces their icons sit inline,
// beyond that they collapse into a menu so rows never wrap.
function SpacePicker({
  spaces,
  subject,
  onPick,
}: {
  spaces: readonly SpaceSwitcherEntry[];
  subject: string;
  onPick: (spaceId: string) => void;
}) {
  if (spaces.length > INLINE_SPACE_PICKER_LIMIT) {
    return (
      <Menu>
        <MenuTrigger
          render={<Button size="xs" variant="ghost-muted" aria-label={`Move ${subject} to…`} />}
        >
          Move
          <ChevronDownIcon className="size-3 opacity-60" />
        </MenuTrigger>
        <MenuPopup align="end" side="bottom">
          {spaces.map((space) => (
            <MenuItem key={space.id} onClick={() => onPick(space.id)}>
              <SpaceIcon space={space} />
              {space.name}
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {spaces.map((space) => (
        <Tooltip key={space.id}>
          <TooltipTrigger
            render={
              <Button
                size="icon-xs"
                variant="ghost-muted"
                aria-label={`Move ${subject} to ${space.name}`}
                onClick={() => onPick(space.id)}
              />
            }
          >
            <SpaceIcon space={space} className="size-3.5 text-sm" />
          </TooltipTrigger>
          <TooltipPopup side="top">Move to {space.name}</TooltipPopup>
        </Tooltip>
      ))}
    </div>
  );
}

function SorterRow({ icon, label, picker }: { icon: ReactNode; label: string; picker: ReactNode }) {
  return (
    <div className="flex h-8 min-w-0 items-center gap-2.5 rounded-md pr-1 pl-2.5">
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground">{label}</span>
      {picker}
    </div>
  );
}

function UnassignedSorter() {
  const view = useSpacesStore((store) => store.view);
  const groups = useSidebarProjectGroups();
  if (view === null) return null;
  const spaces = view.switcher.filter((entry) => entry.id !== UNASSIGNED_SPACE_ID);
  const unassigned = new Set(view.unassignedGroupKeys);
  const unassignedGroups = groups.filter((group) => unassigned.has(group.projectKey));
  const scratchCount = view.unassignedScratchThreadKeys.length;
  const total = unassignedGroups.length + (scratchCount > 0 ? 1 : 0);
  if (total === 0) return null;
  const scratchLabel = `${scratchCount} loose thread${scratchCount === 1 ? "" : "s"}`;
  return (
    <section
      aria-label="Sort unassigned projects"
      className="mb-2 flex flex-col gap-0.5 rounded-lg bg-sidebar-row-hover/50 p-1"
    >
      <header className="flex flex-col gap-0.5 px-2.5 pt-1.5 pb-1">
        <span className="flex items-baseline gap-1.5 text-xs font-medium text-sidebar-foreground">
          Unsorted
          <span className="text-sidebar-muted-foreground tabular-nums">{total}</span>
        </span>
        <span className="text-xs text-pretty text-sidebar-muted-foreground">
          {spaces.length === 0
            ? "Create a space with + below to start sorting."
            : "Give each one a space. Its threads move along."}
        </span>
      </header>
      {unassignedGroups.map((group) => (
        <SorterRow
          key={group.projectKey}
          icon={<ProjectFavicon project={group} className="size-4 shrink-0" />}
          label={group.displayName}
          picker={
            <SpacePicker
              spaces={spaces}
              subject={group.displayName}
              onPick={(spaceId) => assignProjectGroupToSpace(group.projectKey, spaceId)}
            />
          }
        />
      ))}
      {scratchCount > 0 ? (
        <SorterRow
          icon={<MessagesSquareIcon aria-hidden className="size-4 shrink-0 opacity-60" />}
          label={scratchLabel}
          picker={
            <SpacePicker
              spaces={spaces}
              subject={scratchLabel}
              onPick={(spaceId) =>
                moveScratchThreadsToSpace(view.unassignedScratchThreadKeys, spaceId)
              }
            />
          }
        />
      ) : null}
    </section>
  );
}

function EmptySpaceState({ space }: { space: SpaceSwitcherEntry }) {
  const navigate = useNavigate();
  return (
    <section className="flex flex-col items-center px-4 pt-10 pb-6 text-center">
      <span
        style={space.color ? { backgroundColor: spaceSoftCss(space.color) } : undefined}
        className={cn(
          "mb-3 flex size-11 items-center justify-center rounded-xl",
          space.color === null && "bg-sidebar-row-hover",
        )}
      >
        <SpaceIcon space={space} className="size-6 text-2xl" />
      </span>
      <span className="text-sm font-medium text-sidebar-foreground">{space.name} is empty</span>
      <span className="mt-1 text-xs text-pretty text-sidebar-muted-foreground">
        Add a project, or move one in from another space.
      </span>
      <div className="mt-4 flex flex-col items-stretch gap-1 self-stretch px-4">
        <Button
          size="xs"
          variant="outline"
          onClick={() => openCommandPalette({ open: "add-project" })}
        >
          <PlusIcon />
          Add project
        </Button>
        <Button
          size="xs"
          variant="ghost-muted"
          onClick={() => void navigate({ to: "/settings/spaces" })}
        >
          Move projects here
        </Button>
      </div>
    </section>
  );
}

function OfflineNotice({ spaceId }: { spaceId: string }) {
  const unavailable = useUnavailableSpaceProjects(spaceId);
  if (unavailable.length === 0) return null;
  return (
    <div className="mb-2 flex flex-col gap-0.5 px-2.5">
      {unavailable.map((entry) => (
        <p
          key={entry.environmentId}
          role="status"
          className="flex items-center gap-1.5 text-xs text-sidebar-muted-foreground"
        >
          <CloudOffIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">
            {entry.label} is offline, {entry.count} project{entry.count === 1 ? "" : "s"}{" "}
            unavailable
          </span>
        </p>
      ))}
    </div>
  );
}

// Inside a space page this describes the page's space, not the active one.
export function SpaceSidebarNotice() {
  const pageId = useSpacePageId();
  const spaceId = useSpacesStore((store) => pageId ?? store.view?.activeSpaceId ?? null);
  const entry = useSpacesStore((store) =>
    store.view?.switcher.find((candidate) => candidate.id === spaceId),
  );
  const isEmpty = useSpacesStore(
    (store) =>
      store.view !== null &&
      store.catalog?.ready === true &&
      spaceId !== UNASSIGNED_SPACE_ID &&
      spaceId !== null &&
      !store.view.firstProjectRefBySpace.has(spaceId),
  );
  if (spaceId === null) return null;
  if (spaceId === UNASSIGNED_SPACE_ID) return <UnassignedSorter />;
  return (
    <>
      <OfflineNotice spaceId={spaceId} />
      {isEmpty && entry ? <EmptySpaceState space={entry} /> : null}
    </>
  );
}
