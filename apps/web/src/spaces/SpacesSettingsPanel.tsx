import { parseKeybindingShortcut } from "@t3tools/shared/keybindings";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ProjectFavicon } from "../components/ProjectFavicon";
import {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "../components/settings/settingsLayout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useSidebarProjectGroups } from "../hooks/useSidebarProjectGroups";
import { SpaceEditorForm } from "./SpaceEditorForm";
import { SpaceIcon } from "./SpaceIcon";
import { UNASSIGNED_ENTRY, UNASSIGNED_SPACE_ID, type Space } from "./spacesModel";
import { useSpacesStore } from "./spacesStore";
import {
  effectiveSpaceShortcut,
  formatSpaceShortcut,
  SPACE_SHORTCUT_COMMANDS,
  spaceShortcutLabel,
  useSpaceShortcutStore,
  type SpaceShortcutCommand,
} from "./spaceShortcuts";
import {
  assignProjectGroupToSpace,
  confirmAndDeleteSpace,
  createSpaceFromDraft,
  editSpaceFromDraft,
  moveSpaceBy,
} from "./useSpaceActions";

function SpaceRow({
  space,
  index,
  count,
  editing,
  onEditingChange,
}: {
  space: Space;
  index: number;
  count: number;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  return (
    <SettingsRow
      title={
        <span className="flex items-center gap-2">
          <SpaceIcon space={space} />
          {space.name}
        </span>
      }
      control={
        <div className="flex items-center gap-1">
          <Popover open={editing} onOpenChange={onEditingChange}>
            <PopoverTrigger
              render={<Button size="icon-sm" variant="ghost" aria-label={`Edit ${space.name}`} />}
            >
              <PencilIcon />
            </PopoverTrigger>
            <PopoverPopup align="end">
              <SpaceEditorForm
                initial={space}
                submitLabel="Save"
                onCancel={() => onEditingChange(false)}
                onSubmit={(draft) => {
                  editSpaceFromDraft(space.id, draft);
                  onEditingChange(false);
                }}
              />
            </PopoverPopup>
          </Popover>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${space.name} left`}
            disabled={index === 0}
            onClick={() => moveSpaceBy(space.id, -1)}
          >
            <ArrowLeftIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${space.name} right`}
            disabled={index === count - 1}
            onClick={() => moveSpaceBy(space.id, 1)}
          >
            <ArrowRightIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost-destructive"
            aria-label={`Delete ${space.name}`}
            onClick={() => void confirmAndDeleteSpace(space.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      }
    />
  );
}

function ShortcutRow({ command }: { command: SpaceShortcutCommand }) {
  const overrides = useSpaceShortcutStore((store) => store.overrides);
  const setShortcut = useSpaceShortcutStore((store) => store.setShortcut);
  const value = effectiveSpaceShortcut(overrides, command);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value ?? "";
  const valid = text.trim() === "" || parseKeybindingShortcut(text) !== null;
  const commit = () => {
    if (draft === null || !valid) return;
    setShortcut(command, draft.trim() === "" ? null : draft.trim().toLowerCase());
    setDraft(null);
  };
  return (
    <SettingsRow
      title={spaceShortcutLabel(command)}
      description={formatSpaceShortcut(value) ?? "Not bound"}
      control={
        <div className="flex items-center gap-1">
          <Input
            aria-label={`${spaceShortcutLabel(command)} shortcut`}
            aria-invalid={!valid}
            className="w-44"
            value={text}
            placeholder="e.g. mod+alt+arrowleft"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setDraft(null);
            }}
          />
          {command in overrides ? (
            <Button size="xs" variant="ghost" onClick={() => setShortcut(command, undefined)}>
              Reset
            </Button>
          ) : null}
        </div>
      }
    />
  );
}

export function SpacesSettingsPanel({ editSpaceId }: { editSpaceId?: string | undefined }) {
  const navigate = useNavigate();
  const spaces = useSpacesStore((store) => store.state.spaces);
  const view = useSpacesStore((store) => store.view);
  const groups = useSidebarProjectGroups().filter((group) => !group.isScratch);
  const [creating, setCreating] = useState(false);
  const conflicts = new Set(view?.conflictGroupKeys ?? []);
  const spaceById = new Map(spaces.map((space) => [space.id, space] as const));
  const setEditing = (spaceId: string, editing: boolean) =>
    void navigate({
      to: "/settings/spaces",
      search: editing ? { edit: spaceId } : {},
      replace: true,
    });

  return (
    <SettingsPageContainer>
      <SettingsSection
        title="Spaces"
        headerAction={
          <Popover open={creating} onOpenChange={setCreating}>
            <PopoverTrigger render={<Button size="xs" variant="outline" />}>
              <PlusIcon />
              New space
            </PopoverTrigger>
            <PopoverPopup align="end">
              <SpaceEditorForm
                submitLabel="Create space"
                onCancel={() => setCreating(false)}
                onSubmit={(draft) => {
                  createSpaceFromDraft(draft);
                  setCreating(false);
                }}
              />
            </PopoverPopup>
          </Popover>
        }
      >
        {spaces.length === 0 ? (
          <SettingsRow title="No spaces" description="Every project is in Unassigned." />
        ) : (
          spaces.map((space, index) => (
            <SpaceRow
              key={space.id}
              space={space}
              index={index}
              count={spaces.length}
              editing={editSpaceId === space.id}
              onEditingChange={(editing) => setEditing(space.id, editing)}
            />
          ))
        )}
      </SettingsSection>

      <SettingsSection title="Projects">
        {groups.length === 0 ? (
          <SettingsRow title="No projects" />
        ) : (
          groups.map((group) => {
            const spaceId = view?.groupSpaceByKey.get(group.projectKey) ?? UNASSIGNED_SPACE_ID;
            const space = spaceById.get(spaceId) ?? UNASSIGNED_ENTRY;
            return (
              <SettingsRow
                key={group.projectKey}
                title={
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectFavicon project={group} className="size-4 shrink-0" />
                    <span className="truncate">{group.displayName}</span>
                    {conflicts.has(group.projectKey) ? (
                      <Badge size="sm" variant="warning">
                        Mixed spaces
                      </Badge>
                    ) : null}
                  </span>
                }
                description={
                  conflicts.has(group.projectKey)
                    ? `Its copies were in different spaces before they were grouped; it shows in ${space.name}, where it was used most recently. Pick a space to move every copy.`
                    : group.groupedProjectCount > 1
                      ? `${group.groupedProjectCount} copies move together.`
                      : undefined
                }
                control={
                  <Select
                    value={spaceId}
                    onValueChange={(value) => {
                      if (typeof value === "string")
                        assignProjectGroupToSpace(group.projectKey, value);
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-40"
                      aria-label={`Space for ${group.displayName}`}
                    >
                      <SelectValue>
                        <span className="flex items-center gap-1.5">
                          <SpaceIcon space={space} className="size-3.5 text-sm" />
                          {space.name}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      {[...spaces, UNASSIGNED_ENTRY].map((option) => (
                        <SelectItem hideIndicator key={option.id} value={option.id}>
                          <span className="flex items-center gap-1.5">
                            <SpaceIcon space={option} className="size-3.5 text-sm" />
                            {option.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                }
              />
            );
          })
        )}
      </SettingsSection>

      <SettingsSection title="Shortcuts">
        {SPACE_SHORTCUT_COMMANDS.map((command) => (
          <ShortcutRow key={command} command={command} />
        ))}
      </SettingsSection>
    </SettingsPageContainer>
  );
}
