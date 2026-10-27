import { useState, type CSSProperties, type FormEvent } from "react";

import { cn } from "~/lib/utils";
import { firstEmoji } from "../projectIconOptions";
import { Button } from "../components/ui/button";
import { ColorHueSlider } from "../components/ui/color-picker";
import { Input } from "../components/ui/input";
import { SpaceIcon, spaceColorCss } from "./SpaceIcon";
import {
  presetSpaceColor,
  SPACE_HUE_PRESETS,
  type SpaceColor,
  type SpaceDraft,
} from "./spacesModel";
import { spaceTintBackground } from "./spaceTintLayers";

const QUICK_EMOJIS = ["💼", "🏠", "🧪", "🚀", "🎨", "📚", "🎮", "🌱"] as const;

function sliderStyle(ratio: number): CSSProperties {
  return {
    "--settings-slider-progress": `${ratio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - ratio}rem`,
  } as CSSProperties;
}

export function SpaceEditorForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: SpaceDraft;
  submitLabel: string;
  onSubmit: (draft: SpaceDraft) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emojiText, setEmojiText] = useState(initial?.emoji ?? "");
  const [color, setColor] = useState<SpaceColor>(initial?.color ?? presetSpaceColor("blue"));
  const emoji = firstEmoji(emojiText);
  const canSubmit = name.trim().length > 0 && (emojiText.trim() === "" || emoji !== null);
  const tintPercent = Math.round(color.tint * 100);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit({ name: name.trim(), emoji, color });
  };

  return (
    <form className="flex w-72 flex-col gap-4" onSubmit={submit}>
      <div
        aria-hidden
        className="flex h-11 items-center gap-2.5 rounded-lg border border-border bg-sidebar px-3"
        style={{ backgroundImage: spaceTintBackground(color) }}
      >
        <SpaceIcon space={{ name: name || "Space", emoji, color }} />
        <span className="truncate text-sm font-medium text-sidebar-foreground">
          {name.trim() || "New space"}
        </span>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        Name
        <Input
          autoFocus
          value={name}
          maxLength={40}
          placeholder="Side projects"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Emoji</span>
        <div className="flex items-center gap-1">
          <Input
            aria-label="Emoji"
            className="w-14"
            value={emojiText}
            placeholder="-"
            onChange={(event) => setEmojiText(event.target.value)}
          />
          {QUICK_EMOJIS.map((candidate) => (
            <Button
              key={candidate}
              type="button"
              size="icon-xs"
              variant={emoji === candidate ? "secondary" : "ghost"}
              aria-label={`Use ${candidate}`}
              onClick={() => setEmojiText(candidate)}
            >
              {candidate}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Color</span>
        <div role="radiogroup" aria-label="Color presets" className="flex justify-between">
          {SPACE_HUE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              role="radio"
              aria-checked={color.hue === preset.hue}
              aria-label={preset.label}
              onClick={() => setColor({ ...color, hue: preset.hue })}
              style={{ backgroundColor: spaceColorCss({ hue: preset.hue, tint: color.tint }) }}
              className={cn(
                "size-5 cursor-pointer rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                color.hue === preset.hue && "ring-2 ring-foreground/70 ring-inset",
              )}
            />
          ))}
        </div>
        <ColorHueSlider
          label="Hue"
          value={color.hue}
          onChange={(hue) => setColor({ ...color, hue: Math.round(hue) % 360 })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
          Sidebar tint
          <span className="tabular-nums">{tintPercent === 0 ? "Off" : `${tintPercent}%`}</span>
        </span>
        <input
          aria-label="Sidebar tint"
          className="settings-slider w-full"
          type="range"
          min={0}
          max={100}
          step={5}
          value={tintPercent}
          style={sliderStyle(color.tint)}
          onChange={(event) =>
            setColor({ ...color, tint: Number(event.currentTarget.value) / 100 })
          }
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
