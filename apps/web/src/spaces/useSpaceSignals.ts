import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";

import { resolveThreadStatusPill } from "../components/Sidebar.logic";
import { useQuietThreadShells } from "../state/entities";
import { useEnvironments } from "../state/environments";
import { spacesNeedingAttention, unavailableProjects } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";

// Approvals, questions and unseen failures need the user; finished or running
// work never flags a space.
export function useSpacesNeedingAttention(): ReadonlySet<string> {
  const view = useSpacesStore((store) => store.view);
  const state = useSpacesStore((store) => store.state);
  const threads = useQuietThreadShells();
  if (view === null) return new Set();
  return spacesNeedingAttention(
    view,
    state,
    threads.flatMap((thread) => {
      if (thread.archivedAt !== null) return [];
      const pill = resolveThreadStatusPill({ thread })?.label;
      return [
        {
          threadKey: scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
          projectRef: { environmentId: thread.environmentId, projectId: thread.projectId },
          needsAttention:
            pill === "Pending Approval" || pill === "Awaiting Input" || pill === "Failed",
        },
      ];
    }),
  );
}

export function useUnavailableSpaceProjects(spaceId: string | null) {
  const state = useSpacesStore((store) => store.state);
  const { environments } = useEnvironments();
  if (spaceId === null) return [];
  return unavailableProjects(
    state,
    spaceId,
    environments.map((environment) => ({
      environmentId: environment.environmentId,
      label: environment.label,
      connected: environment.connection.phase === "connected",
    })),
  );
}
