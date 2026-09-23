import { cn } from "@/components/ui/cn";

import { PREDICTION_CATEGORY_DEFINITIONS } from "./categories";
import { spotlightIncompleteCategories } from "./spotlight-completeness";
import type { SpotlightPicksDraft } from "./spotlight-predictions-form";

export function SpotlightProgress({ picks }: { picks: SpotlightPicksDraft }) {
  const incomplete = new Set(spotlightIncompleteCategories(picks));
  const done = PREDICTION_CATEGORY_DEFINITIONS.length - incomplete.size;
  const next =
    PREDICTION_CATEGORY_DEFINITIONS.find((definition) =>
      incomplete.has(definition.category),
    )?.category ?? null;

  return (
    <div
      aria-label="Spotlight progress"
      className="flex items-center gap-1.5"
      role="group"
    >
      {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
        const state = !incomplete.has(definition.category)
          ? "done"
          : definition.category === next
            ? "next"
            : "todo";
        return (
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 rounded-full",
              state === "done"
                ? "bg-mint-ink w-2.5"
                : state === "next"
                  ? "bg-brand w-6"
                  : "bg-border w-2.5",
            )}
            data-state={state}
            key={definition.category}
          />
        );
      })}
      <span className="text-muted ml-1.5 text-xs font-bold">
        {done} of 7 picked
      </span>
    </div>
  );
}
