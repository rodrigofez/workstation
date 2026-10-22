import { SPACE_COLOR_CLASSES } from "./SpaceIcon";
import { useSpacesStore } from "./spacesStore";

const SIDEBAR_SELECTOR =
  '[data-app-sidebar] [data-sidebar="sidebar"], [data-app-sidebar][data-sidebar="sidebar"]';

// Layered over the sidebar's own background and grain, under its content,
// so accents, buttons and focus rings keep the theme's colors.
export function SpaceTint() {
  const color = useSpacesStore(
    (store) =>
      store.view?.switcher.find((entry) => entry.id === store.view?.activeSpaceId)?.color ?? null,
  );
  if (color === null) return null;
  const tint = `oklch(${SPACE_COLOR_CLASSES[color].tint} / 0.06)`;
  return (
    <style>{`${SIDEBAR_SELECTOR} {
  background-image: linear-gradient(${tint}, ${tint}), var(--surface-grain);
  background-size: auto, var(--surface-grain-size);
  background-repeat: no-repeat, repeat;
}`}</style>
  );
}
