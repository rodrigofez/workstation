import { useEffect } from "react";
import { create } from "zustand";

import { CommandFooterAction } from "../components/ui/command";
import type { SpacesProjectRef } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";
import {
  useSpaceScopedProjectGroups,
  useSpaceScopedThreads,
  type SpaceScopedThread,
} from "./useSpaceScope";

// The palette searches the active space unless explicitly widened; the
// toggle resets whenever the palette closes.
const usePaletteAllSpacesStore = create<{
  readonly allSpaces: boolean;
  readonly setAllSpaces: (allSpaces: boolean) => void;
}>((set) => ({
  allSpaces: false,
  setAllSpaces: (allSpaces) => set({ allSpaces }),
}));

export function usePaletteScopedThreads<T extends SpaceScopedThread>(threads: readonly T[]) {
  const allSpaces = usePaletteAllSpacesStore((store) => store.allSpaces);
  const scoped = useSpaceScopedThreads(threads);
  return allSpaces ? threads : scoped;
}

export function usePaletteScopedProjectGroups<
  T extends { readonly memberProjectRefs: readonly SpacesProjectRef[] },
>(groups: readonly T[]) {
  const allSpaces = usePaletteAllSpacesStore((store) => store.allSpaces);
  const scoped = useSpaceScopedProjectGroups(groups);
  return allSpaces ? groups : scoped;
}

export function usePaletteSpacesToggle() {
  const allSpaces = usePaletteAllSpacesStore((store) => store.allSpaces);
  const setAllSpaces = usePaletteAllSpacesStore((store) => store.setAllSpaces);
  const activeName = useSpacesStore(
    (store) =>
      store.view?.switcher.find((entry) => entry.id === store.view?.activeSpaceId)?.name ?? null,
  );
  // oxlint-disable-next-line t3code/react-effect-budget -- The palette closes without a handler here, so only unmount can reset the all-spaces toggle.
  useEffect(() => () => usePaletteAllSpacesStore.getState().setAllSpaces(false), []);
  if (activeName === null) return null;
  return (
    <CommandFooterAction
      aria-pressed={allSpaces}
      // Keep focus in the search field so typing continues after toggling.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setAllSpaces(!allSpaces)}
    >
      {allSpaces ? "Searching all spaces" : `Searching ${activeName} · Search all spaces`}
    </CommandFooterAction>
  );
}
