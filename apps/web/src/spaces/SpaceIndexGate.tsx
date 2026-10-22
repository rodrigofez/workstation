import { useNavigate } from "@tanstack/react-router";
import { MessageSquareDashedIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { openCommandPalette } from "../commandPaletteBus";
import { isElectron } from "../env";
import { useScratchProject } from "../hooks/useScratchProject";
import { useLegacySidebarEnabled } from "../hooks/useSettings";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { usePrimaryEnvironmentId } from "../state/environments";
import { SpaceIcon } from "./SpaceIcon";
import { resolveSwitchTarget, UNASSIGNED_SPACE_ID } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";
import { spaceTargetLookup, useNavigateToSpaceTarget } from "./useSwitchSpace";

function EmptySpaceHero() {
  const navigate = useNavigate();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { scratchEnvironmentId, startScratchThread } = useScratchProject();
  const scratchTargetEnvironmentId = scratchEnvironmentId(primaryEnvironmentId);
  const entry = useSpacesStore((store) =>
    store.view?.switcher.find((candidate) => candidate.id === store.view?.activeSpaceId),
  );
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        {isElectron ? <WorkspacePageHeader electron /> : null}
        <Empty size="hero" className="flex-1">
          <div className="w-full max-w-lg px-8 py-12">
            <EmptyHeader className="max-w-none">
              {entry ? <SpaceIcon space={entry} className="mb-2 size-8 text-3xl" /> : null}
              <EmptyTitle>{entry ? `${entry.name} is empty` : "This space is empty"}</EmptyTitle>
              <EmptyDescription>
                Add a project here, move existing projects in, or start a thread without a project.
              </EmptyDescription>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => openCommandPalette({ open: "add-project" })}>
                  <PlusIcon className="size-4" />
                  Add project
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigate({ to: "/settings/spaces" })}
                >
                  Move projects here
                </Button>
                {scratchTargetEnvironmentId === null ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void startScratchThread(scratchTargetEnvironmentId)}
                  >
                    <MessageSquareDashedIcon className="size-4" />
                    Start without a project
                  </Button>
                )}
              </div>
            </EmptyHeader>
          </div>
        </Empty>
      </div>
    </SidebarInset>
  );
}

// "/" is where a space lands: its remembered thread when there is one, the
// empty state when it has no projects, otherwise upstream's new draft (fed
// space-scoped projects by the route).
export function SpaceIndexGate({ children }: { children: ReactNode }) {
  const view = useSpacesStore((store) => store.view);
  const state = useSpacesStore((store) => store.state);
  const ready = useSpacesStore((store) => store.catalog?.ready === true);
  const legacySidebarEnabled = useLegacySidebarEnabled();
  const navigateToTarget = useNavigateToSpaceTarget();
  const restoredSpaceRef = useRef<string | null>(null);
  const spaceId = view?.activeSpaceId ?? null;
  const target =
    view === null || spaceId === null || !ready
      ? null
      : resolveSwitchTarget(view, state, spaceId, spaceTargetLookup);
  const restore = target !== null && target.kind !== "landing";
  useEffect(() => {
    if (!restore || target === null || restoredSpaceRef.current === spaceId) return;
    restoredSpaceRef.current = spaceId;
    void navigateToTarget(target, { replace: true });
  }, [navigateToTarget, restore, spaceId, target]);

  if (legacySidebarEnabled) return children;
  // Until the first catalog lands, upstream's landing would open a draft in
  // the globally most recent project, which may belong to another space.
  if (view === null || !ready || restore) return null;
  if (spaceId !== UNASSIGNED_SPACE_ID && !view.firstProjectRefBySpace.has(spaceId ?? "")) {
    return <EmptySpaceHero />;
  }
  return children;
}
