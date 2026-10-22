import { useEffect, useRef } from "react";

import { mountTintLayers, setRestingTint } from "./spaceTintLayers";
import { useSpacesStore } from "./spacesStore";

// The layers sit under the sidebar's content (z-index -1 inside an isolated
// sidebar), so accents, buttons and focus rings keep the theme's colors.
const SIDEBAR_RULE = `[data-app-sidebar] [data-sidebar="sidebar"], [data-app-sidebar][data-sidebar="sidebar"] {
  position: relative;
  isolation: isolate;
}`;

export function SpaceTint() {
  const color = useSpacesStore(
    (store) =>
      store.view?.switcher.find((entry) => entry.id === store.view?.activeSpaceId)?.color ?? null,
  );
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sidebar = markerRef.current?.closest<HTMLElement>('[data-sidebar="sidebar"]');
    return sidebar ? mountTintLayers(sidebar) : undefined;
  }, []);
  useEffect(() => setRestingTint(color), [color]);
  return (
    <>
      <style>{SIDEBAR_RULE}</style>
      <span hidden ref={markerRef} />
    </>
  );
}
