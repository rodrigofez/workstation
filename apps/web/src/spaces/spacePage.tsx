import { createContext, use, type ReactNode } from "react";

import { spacePicker } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";

// Each space renders its own copy of the thread sidebar (SpaceSidebarPages);
// this tells the scoping hooks inside which space that copy shows. Outside a
// page (palette, chat view) they follow the active space.
const SpacePageContext = createContext<string | null>(null);

export function SpacePage({ spaceId, children }: { spaceId: string; children: ReactNode }) {
  return <SpacePageContext value={spaceId}>{children}</SpacePageContext>;
}

export function useSpacePageId(): string | null {
  return use(SpacePageContext);
}

// Pages next to the active one stay mounted and visible so they can scroll
// in; window-level listeners and global registrations belong to the active
// page alone.
export function useIsActiveSpacePage(): boolean {
  const pageId = useSpacePageId();
  return useSpacesStore(
    (store) =>
      pageId === null || (store.view?.activeSpaceId ?? store.state.activeSpaceId) === pageId,
  );
}

// Window chrome (brand header, footer) is drawn once around the pages, so the
// copies inside them skip it.
export function OutsideSpacePage({ children }: { children: ReactNode }) {
  return useSpacePageId() === null ? children : null;
}

// The project picker is one global value that follows the active space. A
// background page shows the picker its space will restore, so it already
// matches what the page looks like once switched to.
export function useSpacePageProjectScopeKey(globalKey: string | null): string | null {
  const pageId = useSpacePageId();
  const pageKey = useSpacesStore((store) =>
    pageId === null || store.state.activeSpaceId === pageId
      ? undefined
      : spacePicker(store.state, pageId),
  );
  return pageKey === undefined ? globalKey : pageKey;
}
