import { spaceColorCss } from "./SpaceIcon";
import type { SpaceColor } from "./spacesModel";

// The sidebar tint as three stacked layers under the sidebar's content: the
// resting tint, plus an outgoing and incoming pair that crossfade during a
// switch, driven by the pages' scroll position. Only opacity changes, which
// is cheap to composite.
interface TintLayers {
  readonly base: HTMLElement;
  readonly from: HTMLElement;
  readonly to: HTMLElement;
}

let layers: TintLayers | null = null;

// At the default intensity (0.5) the wash is 9% at the top fading to 3%.
const MAX_TINT_ALPHA = 0.18;

export function spaceTintBackground(color: SpaceColor | null): string {
  if (color === null || color.tint <= 0) return "none";
  const top = spaceColorCss(color, MAX_TINT_ALPHA * color.tint);
  const bottom = spaceColorCss(color, (MAX_TINT_ALPHA / 3) * color.tint);
  return `linear-gradient(${top}, ${bottom})`;
}

function createLayer(): HTMLElement {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:0";
  return layer;
}

export function mountTintLayers(sidebar: HTMLElement): () => void {
  const mounted = { base: createLayer(), from: createLayer(), to: createLayer() };
  mounted.base.style.opacity = "1";
  sidebar.prepend(mounted.base, mounted.from, mounted.to);
  layers = mounted;
  return () => {
    mounted.base.remove();
    mounted.from.remove();
    mounted.to.remove();
    if (layers === mounted) layers = null;
  };
}

export function setRestingTint(color: SpaceColor | null): void {
  if (layers) layers.base.style.backgroundImage = spaceTintBackground(color);
}

export function beginTintBlend(from: SpaceColor | null, to: SpaceColor | null): void {
  if (!layers) return;
  layers.from.style.backgroundImage = spaceTintBackground(from);
  layers.to.style.backgroundImage = spaceTintBackground(to);
  layers.base.style.opacity = "0";
  setTintBlend(0);
}

export function setTintBlend(progress: number): void {
  if (!layers) return;
  layers.from.style.opacity = String(1 - progress);
  layers.to.style.opacity = String(progress);
}

export function endTintBlend(): void {
  if (!layers) return;
  layers.from.style.opacity = "0";
  layers.to.style.opacity = "0";
  layers.base.style.opacity = "1";
}
