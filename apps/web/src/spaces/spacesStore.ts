import { Debouncer } from "@tanstack/react-pacer";
import { create } from "zustand";

import {
  deriveSpacesView,
  initialSpacesState,
  parseSpacesState,
  serializeSpacesState,
  type SpacesCatalog,
  type SpacesState,
  type SpacesView,
} from "./spacesModel";

const SPACES_STORAGE_KEY = "workstation:spaces";

interface SpacesStore {
  readonly state: SpacesState;
  readonly catalog: SpacesCatalog | null;
  // Null while spaces are off (legacy sidebar) or before the coordinator has
  // published a catalog; every consumer then behaves exactly like upstream.
  // Derived in the same update as state so the active space never lags.
  readonly view: SpacesView | null;
  readonly update: (transition: (state: SpacesState) => SpacesState) => void;
  readonly setCatalog: (catalog: SpacesCatalog | null) => void;
}

function readPersistedSpacesState(): SpacesState {
  if (typeof window === "undefined") return initialSpacesState();
  try {
    const raw = window.localStorage.getItem(SPACES_STORAGE_KEY);
    return raw ? parseSpacesState(JSON.parse(raw)) : initialSpacesState();
  } catch {
    return initialSpacesState();
  }
}

function persistSpacesState(state: SpacesState): void {
  try {
    window.localStorage.setItem(SPACES_STORAGE_KEY, serializeSpacesState(state));
  } catch {}
}

const debouncedPersist = new Debouncer(persistSpacesState, { wait: 300 });

export const useSpacesStore = create<SpacesStore>((set) => ({
  state: readPersistedSpacesState(),
  catalog: null,
  view: null,
  update: (transition) =>
    set((store) => {
      const state = transition(store.state);
      if (state === store.state) return store;
      return {
        state,
        view: store.catalog === null ? null : deriveSpacesView(state, store.catalog),
      };
    }),
  setCatalog: (catalog) =>
    set((store) =>
      catalog === store.catalog
        ? store
        : { catalog, view: catalog === null ? null : deriveSpacesView(store.state, catalog) },
    ),
}));

let persistedState = useSpacesStore.getState().state;
useSpacesStore.subscribe((store) => {
  if (store.state === persistedState) return;
  persistedState = store.state;
  debouncedPersist.maybeExecute(store.state);
});

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => debouncedPersist.flush());
}
