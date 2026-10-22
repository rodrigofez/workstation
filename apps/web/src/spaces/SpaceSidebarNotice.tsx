import { useNavigate } from "@tanstack/react-router";
import { CloudOffIcon, PlusIcon } from "lucide-react";

import { openCommandPalette } from "../commandPaletteBus";
import { ProjectFavicon } from "../components/ProjectFavicon";
import { Button } from "../components/ui/button";
import { useSidebarProjectGroups } from "../hooks/useSidebarProjectGroups";
import { SpaceIcon } from "./SpaceIcon";
import { UNASSIGNED_SPACE_ID, type SpaceSwitcherEntry } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";
import { assignProjectGroupToSpace, moveScratchThreadsToSpace } from "./spaceActions";
import { useUnavailableSpaceProjects } from "./useSpaceSignals";

function SpaceChips({
  spaces,
  onPick,
}: {
  spaces: readonly SpaceSwitcherEntry[];
  onPick: (spaceId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {spaces.map((space) => (
        <Button key={space.id} size="xs" variant="outline" onClick={() => onPick(space.id)}>
          <SpaceIcon space={space} className="size-3 text-xs" />
          {space.name}
        </Button>
      ))}
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
  if (unassignedGroups.length === 0 && scratchCount === 0) return null;
  return (
    <section
      aria-label="Sort unassigned projects"
      className="mx-2 mb-2 flex flex-col gap-2 rounded-md border border-sidebar-border p-2 text-xs"
    >
      <p className="text-sidebar-muted-foreground">
        {spaces.length === 0
          ? "Create a space with + below, then sort these projects into it."
          : "Pick a space for each project. Its threads move with it."}
      </p>
      {unassignedGroups.map((group) => (
        <div key={group.projectKey} className="flex flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1.5 font-medium text-sidebar-foreground">
            <ProjectFavicon project={group} className="size-3.5 shrink-0" />
            <span className="truncate">{group.displayName}</span>
          </div>
          <SpaceChips
            spaces={spaces}
            onPick={(spaceId) => assignProjectGroupToSpace(group.projectKey, spaceId)}
          />
        </div>
      ))}
      {scratchCount > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-sidebar-foreground">
            {scratchCount} no-project thread{scratchCount === 1 ? "" : "s"}
          </span>
          <SpaceChips
            spaces={spaces}
            onPick={(spaceId) =>
              moveScratchThreadsToSpace(view.unassignedScratchThreadKeys, spaceId)
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function EmptySpaceState() {
  const navigate = useNavigate();
  return (
    <section className="mx-2 mb-2 flex flex-col items-center gap-2 rounded-md border border-dashed border-sidebar-border px-2 py-4 text-center text-xs text-sidebar-muted-foreground">
      <span>This space has no projects yet.</span>
      <div className="flex flex-wrap justify-center gap-1">
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
          variant="outline"
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
    <div className="mx-2 mb-2 flex flex-col gap-0.5">
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

export function SpaceSidebarNotice() {
  const activeSpaceId = useSpacesStore((store) => store.view?.activeSpaceId ?? null);
  const isEmpty = useSpacesStore(
    (store) =>
      store.view !== null &&
      store.catalog?.ready === true &&
      store.view.activeSpaceId !== UNASSIGNED_SPACE_ID &&
      !store.view.firstProjectRefBySpace.has(store.view.activeSpaceId),
  );
  if (activeSpaceId === null) return null;
  if (activeSpaceId === UNASSIGNED_SPACE_ID) return <UnassignedSorter />;
  return (
    <>
      <OfflineNotice spaceId={activeSpaceId} />
      {isEmpty ? <EmptySpaceState /> : null}
    </>
  );
}
