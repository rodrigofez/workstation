// Lets switches started outside the sidebar (switcher buttons, shortcuts)
// scroll the pages strip instead of jumping it. Registered by
// SpaceSidebarPages; false while no strip is mounted.
let handler: ((spaceId: string) => boolean) | null = null;

export function registerSpaceScroll(next: ((spaceId: string) => boolean) | null): void {
  handler = next;
}

export function scrollSidebarToSpace(spaceId: string): boolean {
  return handler?.(spaceId) ?? false;
}
