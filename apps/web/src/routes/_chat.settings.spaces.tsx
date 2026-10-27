import { createFileRoute } from "@tanstack/react-router";

import { SpacesSettingsPanel } from "../spaces/SpacesSettingsPanel";

function SpacesSettingsRoute() {
  const { edit } = Route.useSearch();
  return <SpacesSettingsPanel editSpaceId={edit} />;
}

export const Route = createFileRoute("/_chat/settings/spaces")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search.edit === "string" ? { edit: search.edit } : {},
  component: SpacesSettingsRoute,
});
