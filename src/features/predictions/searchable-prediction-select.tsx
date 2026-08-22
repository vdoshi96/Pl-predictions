"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/components/ui/cn";

export type SearchablePredictionOption = Readonly<{
  assetPath?: string | null;
  displayName: string;
  id: string;
  searchText: string;
}>;

type SelectValue = string | "other" | null;

export interface SearchablePredictionSelectProps {
  allowOther?: boolean;
  description: string;
  disabled?: boolean;
  emptyMessage: string;
  expanded?: boolean;
  invalid?: boolean;
  invalidMessage?: string;
  label: string;
  maximumResults?: number;
  minimumQueryLength?: number;
  minimumQueryMessage?: string;
  onChange: (value: SelectValue) => void;
  onExpandedChange?: (expanded: boolean) => void;
  onOtherValueChange?: (value: string) => void;
  options: readonly SearchablePredictionOption[];
  otherValue?: string;
  renderLeading?: (option: SearchablePredictionOption) => ReactNode;
  selectedOption?: SearchablePredictionOption | null;
  value: SelectValue;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-GB")
    .trim()
    .replace(/\s+/gu, " ");
}

export function SearchablePredictionSelect({
  allowOther = false,
  description,
  disabled = false,
  emptyMessage,
  expanded: controlledExpanded,
  invalid = false,
  invalidMessage = "Choose a valid option.",
  label,
  maximumResults,
  minimumQueryLength = 0,
  minimumQueryMessage,
  onChange,
  onExpandedChange,
  onOtherValueChange,
  options,
  otherValue = "",
  renderLeading,
  selectedOption: selectedOptionFallback = null,
  value,
}: SearchablePredictionSelectProps) {
  const generatedId = useId().replaceAll(":", "");
  const inputId = `spotlight-select-${generatedId}`;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const listboxId = `${inputId}-listbox`;
  const otherInputId = `${inputId}-other`;
  const containerRef = useRef<HTMLDivElement>(null);
  const otherInputRef = useRef<HTMLInputElement>(null);
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const expanded = controlledExpanded ?? uncontrolledExpanded;
  const selectedOption =
    options.find((option) => option.id === value) ??
    (selectedOptionFallback?.id === value ? selectedOptionFallback : null);
  const inputValue = expanded
    ? query
    : value === "other"
      ? "Other player"
      : (selectedOption?.displayName ?? "");
  const normalizedQuery = normalizeSearch(query);
  const queryReady = normalizedQuery.length >= minimumQueryLength;
  const matchingOptions = useMemo(
    () =>
      queryReady
        ? normalizedQuery
          ? options.filter((option) =>
              normalizeSearch(option.searchText).includes(normalizedQuery),
            )
          : [...options]
        : [],
    [normalizedQuery, options, queryReady],
  );
  const filteredOptions =
    maximumResults === undefined
      ? matchingOptions
      : matchingOptions.slice(0, Math.max(0, maximumResults));
  const queryPrompt =
    minimumQueryMessage ??
    `Type at least ${minimumQueryLength} character${minimumQueryLength === 1 ? "" : "s"} to search.`;
  const visibleChoiceCount = filteredOptions.length + (allowOther ? 1 : 0);
  const activeChoiceIndex = Math.min(
    Math.max(0, activeIndex),
    Math.max(0, visibleChoiceCount - 1),
  );
  const activeDescendant = expanded
    ? activeChoiceIndex < filteredOptions.length
      ? `${listboxId}-${filteredOptions[activeChoiceIndex]?.id}`
      : allowOther
        ? `${listboxId}-other`
        : undefined
    : undefined;

  function choiceId(index: number): string | undefined {
    if (index < filteredOptions.length) {
      const option = filteredOptions[index];
      return option ? `${listboxId}-${option.id}` : undefined;
    }
    return allowOther ? `${listboxId}-other` : undefined;
  }

  function moveActiveChoice(nextIndex: number) {
    const boundedIndex = Math.min(
      Math.max(0, nextIndex),
      Math.max(0, visibleChoiceCount - 1),
    );
    setActiveIndex(boundedIndex);
    window.requestAnimationFrame(() => {
      const id = choiceId(boundedIndex);
      if (id) {
        document.getElementById(id)?.scrollIntoView?.({ block: "nearest" });
      }
    });
  }

  function openPicker() {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    if (!expanded) onExpandedChange?.(true);
    if (controlledExpanded === undefined) setUncontrolledExpanded(true);
  }

  function closePicker() {
    if (expanded) onExpandedChange?.(false);
    if (controlledExpanded === undefined) setUncontrolledExpanded(false);
    setQuery("");
  }

  function selectValue(nextValue: Exclude<SelectValue, null>) {
    onChange(nextValue);
    closePicker();
    if (nextValue === "other") {
      window.setTimeout(() => otherInputRef.current?.focus(), 0);
    }
  }

  function selectValueFromPointer(nextValue: Exclude<SelectValue, null>) {
    onChange(nextValue);
    window.setTimeout(() => {
      closePicker();
      if (nextValue === "other") otherInputRef.current?.focus();
    }, 100);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (!expanded && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      event.preventDefault();
      openPicker();
      return;
    }

    if (!expanded) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveChoice(activeChoiceIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveChoice(activeChoiceIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveActiveChoice(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveActiveChoice(visibleChoiceCount - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
    } else if (event.key === "Enter" && visibleChoiceCount > 0) {
      event.preventDefault();
      const option = filteredOptions[activeChoiceIndex];
      selectValue(option ? option.id : "other");
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) closePicker();
      }}
    >
      <label
        htmlFor={inputId}
        className="text-brand-ink-strong text-sm font-black"
      >
        {label}
      </label>
      <p id={descriptionId} className="text-muted mt-1 text-xs leading-5">
        {description}
      </p>
      <p className="sr-only" aria-live="polite">
        {expanded
          ? !queryReady
            ? `${queryPrompt}${allowOther ? " Other player is available." : ""}`
            : `${matchingOptions.length} matching option${matchingOptions.length === 1 ? "" : "s"}${matchingOptions.length > filteredOptions.length ? `. Showing the first ${filteredOptions.length}` : ""}${allowOther ? ", plus Other player" : ""}.`
          : value === null
            ? "No option selected."
            : "Option selected."}
      </p>

      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          id={inputId}
          role="combobox"
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={`${descriptionId}${invalid ? ` ${errorId}` : ""}`}
          aria-expanded={expanded}
          aria-haspopup="listbox"
          aria-invalid={invalid}
          autoComplete="off"
          className={cn(
            "text-brand-ink-strong focus:ring-accent-blue/30 bg-surface placeholder:text-muted disabled:bg-surface-subtle min-h-12 w-full rounded-xl border pr-11 pl-10 text-base outline-none focus:ring-2 disabled:cursor-not-allowed",
            invalid
              ? "border-danger/35"
              : "border-border focus:border-accent-lilac",
          )}
          disabled={disabled}
          onChange={(event) => {
            if (!expanded) {
              onExpandedChange?.(true);
              if (controlledExpanded === undefined) {
                setUncontrolledExpanded(true);
              }
            }
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={(event) => {
            const input = event.currentTarget;
            input.scrollIntoView?.({ block: "center" });
            openPicker();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by name…"
          type="text"
          value={inputValue}
        />
        <button
          type="button"
          aria-label={`${expanded ? "Close" : "Open"} ${label} options`}
          className="text-brand-ink focus-visible:ring-accent-blue absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg outline-none focus-visible:ring-2 disabled:opacity-50"
          disabled={disabled}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (expanded ? closePicker() : openPicker())}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {expanded ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${label} options`}
          className="border-border bg-surface fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 max-h-[min(22rem,52dvh)] overflow-y-auto overscroll-contain rounded-2xl border p-1.5 shadow-2xl sm:absolute sm:inset-x-0 sm:top-[calc(100%+0.35rem)] sm:bottom-auto sm:z-30 sm:max-h-72 sm:rounded-xl"
        >
          {queryReady && matchingOptions.length > filteredOptions.length ? (
            <p className="text-muted px-3 py-2 text-xs font-bold">
              {filteredOptions.length} of {matchingOptions.length} matches
            </p>
          ) : null}
          {filteredOptions.length === 0 ? (
            <p className="text-muted px-3 py-3 text-sm leading-5">
              {queryReady ? emptyMessage : queryPrompt}
            </p>
          ) : null}
          {filteredOptions.map((option, index) => (
            <button
              id={`${listboxId}-${option.id}`}
              key={option.id}
              type="button"
              role="option"
              aria-selected={value === option.id}
              tabIndex={-1}
              className={cn(
                "text-foreground flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-bold outline-none",
                index === activeChoiceIndex
                  ? "bg-brand-soft text-brand-ink-strong"
                  : "hover:bg-surface-subtle",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                selectValueFromPointer(option.id);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectValue(option.id)}
            >
              {renderLeading?.(option)}
              <span className="min-w-0 grow break-words">
                {option.displayName}
              </span>
              {value === option.id ? (
                <Check
                  aria-hidden="true"
                  className="text-mint-ink size-4 shrink-0"
                />
              ) : null}
            </button>
          ))}
          {allowOther ? (
            <button
              id={`${listboxId}-other`}
              type="button"
              role="option"
              aria-selected={value === "other"}
              tabIndex={-1}
              className={cn(
                "border-border mt-1 flex min-h-12 w-full items-center gap-3 rounded-lg border-t px-2.5 py-2 text-left text-sm font-black outline-none",
                activeChoiceIndex === filteredOptions.length
                  ? "bg-brand-soft text-brand-ink-strong"
                  : "text-brand-ink hover:bg-surface-subtle",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                selectValueFromPointer("other");
              }}
              onMouseEnter={() => setActiveIndex(filteredOptions.length)}
              onClick={() => selectValue("other")}
            >
              Other player
              {value === "other" ? (
                <Check
                  aria-hidden="true"
                  className="text-mint-ink ml-auto size-4"
                />
              ) : null}
            </button>
          ) : null}
        </div>
      ) : null}

      {invalid ? (
        <p id={errorId} className="text-danger mt-2 text-xs font-semibold">
          {invalidMessage}
        </p>
      ) : null}

      {selectedOption && !expanded ? (
        <div className="text-muted mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold">
          {renderLeading?.(selectedOption)}
          <span className="min-w-0 break-words">
            Selected: {selectedOption.displayName}
          </span>
        </div>
      ) : null}

      {value === "other" ? (
        <div className="bg-surface-lilac ring-surface-lilac-border mt-3 rounded-xl p-3 ring-1">
          <label
            htmlFor={otherInputId}
            className="text-brand-ink-strong text-xs font-black"
          >
            Player’s full name
          </label>
          <input
            ref={otherInputRef}
            id={otherInputId}
            className={cn(
              "text-brand-ink-strong focus:ring-accent-blue/30 bg-surface placeholder:text-muted mt-1.5 min-h-12 w-full rounded-xl border px-3.5 text-base outline-none focus:ring-2",
              invalid
                ? "border-danger/35"
                : "border-border focus:border-accent-lilac",
            )}
            disabled={disabled}
            aria-describedby={`${descriptionId}${invalid ? ` ${errorId}` : ""}`}
            aria-invalid={invalid}
            data-other-player-input="true"
            maxLength={120}
            minLength={2}
            onChange={(event) => onOtherValueChange?.(event.target.value)}
            placeholder="Enter first and last name"
            required
            type="text"
            value={otherValue}
          />
        </div>
      ) : null}
    </div>
  );
}
