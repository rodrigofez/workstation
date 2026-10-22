import {
  isMacPlatform,
  matchesKeybindingShortcut,
  parseKeybindingShortcut,
  type ShortcutEventLike,
} from "@t3tools/shared/keybindings";
import { create } from "zustand";

import { formatShortcutLabel } from "../keybindings";
import type { SpaceShortcut } from "./spacesModel";

// Space shortcuts live outside the server-backed keybinding config: its
// command list is a contracts schema the stock VPS server validates, and the
// fork must not change contracts. They are rebound in Settings → Spaces.

export const SPACE_SHORTCUT_COMMANDS = [
  "space.previous",
  "space.next",
  ...Array.from({ length: 9 }, (_, index) => `space.jump.${index + 1}` as const),
] as const;
export type SpaceShortcutCommand = (typeof SPACE_SHORTCUT_COMMANDS)[number];

const STORAGE_KEY = "workstation:space-shortcuts";

function defaultSpaceShortcut(
  command: SpaceShortcutCommand,
  platform = navigator.platform,
): string | null {
  if (command === "space.previous") return "mod+alt+arrowleft";
  if (command === "space.next") return "mod+alt+arrowright";
  // ctrl+N is free on macOS only; elsewhere mod+N already jumps to threads.
  return isMacPlatform(platform) ? `ctrl+${command.slice("space.jump.".length)}` : null;
}

export function spaceShortcutLabel(command: SpaceShortcutCommand): string {
  if (command === "space.previous") return "Previous space";
  if (command === "space.next") return "Next space";
  return `Go to space ${command.slice("space.jump.".length)}`;
}

export function spaceShortcutFromCommand(command: SpaceShortcutCommand): SpaceShortcut {
  if (command === "space.previous") return { kind: "previous" };
  if (command === "space.next") return { kind: "next" };
  return { kind: "index", index: Number(command.slice("space.jump.".length)) - 1 };
}

type SpaceShortcutOverrides = Partial<Record<SpaceShortcutCommand, string | null>>;

function readOverrides(): SpaceShortcutOverrides {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    const overrides: SpaceShortcutOverrides = {};
    for (const command of SPACE_SHORTCUT_COMMANDS) {
      const value = (parsed as Record<string, unknown>)[command];
      if (value === null || (typeof value === "string" && parseKeybindingShortcut(value))) {
        overrides[command] = value;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

interface SpaceShortcutStore {
  readonly overrides: SpaceShortcutOverrides;
  readonly setShortcut: (command: SpaceShortcutCommand, value: string | null | undefined) => void;
}

export const useSpaceShortcutStore = create<SpaceShortcutStore>((set) => ({
  overrides: typeof window === "undefined" ? {} : readOverrides(),
  setShortcut: (command, value) =>
    set((store) => {
      const overrides = { ...store.overrides };
      if (value === undefined) delete overrides[command];
      else overrides[command] = value;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch {}
      return { overrides };
    }),
}));

export function effectiveSpaceShortcut(
  overrides: SpaceShortcutOverrides,
  command: SpaceShortcutCommand,
): string | null {
  const override = overrides[command];
  return override === undefined ? defaultSpaceShortcut(command) : override;
}

export function formatSpaceShortcut(value: string | null): string | null {
  const shortcut = value === null ? null : parseKeybindingShortcut(value);
  return shortcut ? formatShortcutLabel(shortcut) : null;
}

export function resolveSpaceShortcutCommand(
  event: ShortcutEventLike,
  overrides: SpaceShortcutOverrides,
  platform = navigator.platform,
): SpaceShortcutCommand | null {
  for (const command of SPACE_SHORTCUT_COMMANDS) {
    const value = effectiveSpaceShortcut(overrides, command);
    const shortcut = value === null ? null : parseKeybindingShortcut(value);
    if (shortcut && matchesKeybindingShortcut(event, shortcut, platform)) return command;
  }
  return null;
}
