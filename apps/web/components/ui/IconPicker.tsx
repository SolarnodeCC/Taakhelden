"use client";

import { useTranslations } from "next-intl";
import { displayIcon } from "../../lib/icons";

/**
 * Replaces the free-text icon field. Asking a parent to type "star" required
 * them to know a vocabulary documented nowhere in the UI, and whatever they
 * typed was rendered verbatim into the child's task list. Same interaction as
 * the avatar picker on /gezin: a wrapped grid of `aria-pressed` toggles.
 */
export function IconPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (icon: string) => void;
}) {
  const t = useTranslations("common");
  // A stored legacy slug is shown as its glyph so the current choice is visible
  // even when it isn't literally one of the options.
  const current = displayIcon(value);

  return (
    <fieldset>
      <legend className="text-sm font-medium text-text">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((icon) => {
          const selected = current === icon;
          return (
            <button
              key={icon}
              type="button"
              aria-pressed={selected}
              aria-label={t("iconOption", { icon })}
              onClick={() => onChange(icon)}
              className={
                "inline-flex h-11 w-11 items-center justify-center rounded border text-xl transition-colors " +
                (selected
                  ? "border-accent bg-accent/10"
                  : "border-border-interactive hover:bg-surface")
              }
            >
              <span aria-hidden>{icon}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
