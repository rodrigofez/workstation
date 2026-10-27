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
  // oxlint-disable-next-line t3code/react-effect-budget -- Mounts the tint layers on the sidebar element, which this component does not render.
  useEffect(() => {
    const sidebar = markerRef.current?.closest<HTMLElement>('[data-sidebar="sidebar"]');
    return sidebar ? mountTintLayers(sidebar) : undefined;
  }, []);
  // oxlint-disable-next-line t3code/react-effect-budget -- Pushes the active space's color into the tint layers outside React.
  useEffect(() => setRestingTint(color), [color]);
  return (
    <>
      <style>{SIDEBAR_RULE}</style>
      <span hidden ref={markerRef} />
    </>
  );
}
