import { useSpacesStore } from "./spacesStore";
import { UNASSIGNED_SPACE_ID } from "./spacesModel";

// The space an add-project or clone flow started in. A flow that never
// produces a project must not claim one that appears later from another
// client, so the origin is short-lived unless the palette is still open
// (a blocking clone finishes there).
const ORIGIN_TTL_MS = 2 * 60_000;

let origin: { readonly spaceId: string; readonly startedAt: number } | null = null;

export function markAddProjectStarted(): void {
  const spaceId = useSpacesStore.getState().view?.activeSpaceId;
  origin =
    spaceId === undefined || spaceId === UNASSIGNED_SPACE_ID
      ? null
      : { spaceId, startedAt: Date.now() };
}

export function takeAddProjectOrigin(paletteOpen: boolean): string | null {
  const current = origin;
  origin = null;
  if (current === null) return null;
  return paletteOpen || Date.now() - current.startedAt <= ORIGIN_TTL_MS ? current.spaceId : null;
}
