import { useState, type FormEvent } from "react";

import { cn } from "~/lib/utils";
import { firstEmoji } from "../projectIconOptions";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SPACE_COLOR_CLASSES } from "./SpaceIcon";
import { SPACE_COLORS, type SpaceColor, type SpaceDraft } from "./spacesModel";

const QUICK_EMOJIS = ["💼", "🏠", "🧪", "🚀", "🎨", "📚", "🎮", "🌱"] as const;

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
  const [color, setColor] = useState<SpaceColor>(initial?.color ?? SPACE_COLORS[0]);
  const emoji = firstEmoji(emojiText);
  const canSubmit = name.trim().length > 0 && (emojiText.trim() === "" || emoji !== null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit({ name: name.trim(), emoji, color });
  };

  return (
    <form className="flex w-64 flex-col gap-3" onSubmit={submit}>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Name
        <Input
          autoFocus
          value={name}
          maxLength={40}
          placeholder="Side projects"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Emoji</span>
        <div className="flex items-center gap-1">
          <Input
            aria-label="Emoji"
            className="w-14"
            value={emojiText}
            placeholder="—"
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
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Color</span>
        <div role="radiogroup" aria-label="Color" className="flex gap-1.5">
          {SPACE_COLORS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={color === candidate}
              aria-label={SPACE_COLOR_CLASSES[candidate].label}
              onClick={() => setColor(candidate)}
              className={cn(
                "size-5 cursor-pointer rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                SPACE_COLOR_CLASSES[candidate].fill,
                color === candidate && "ring-2 ring-foreground/70 ring-inset",
              )}
            />
          ))}
        </div>
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
