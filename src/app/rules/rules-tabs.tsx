"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type RulesTab = Readonly<{
  content: ReactNode;
  label: string;
  panelId: string;
  value: string;
}>;

export function RulesTabs({ tabs }: { tabs: readonly RulesTab[] }) {
  const [selected, setSelected] = useState(tabs[0]!.value);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  useEffect(() => {
    const match = tabs.find(
      (tab) => tab.panelId === window.location.hash.slice(1),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL hash is browser-only state that is read after hydration.
    if (match) setSelected(match.value);
  }, [tabs]);

  function focusTab(index: number) {
    const wrapped = (index + tabs.length) % tabs.length;
    setSelected(tabs[wrapped]!.value);
    tabRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const next =
      event.key === "ArrowRight"
        ? index + 1
        : event.key === "ArrowLeft"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    focusTab(next);
  }

  return (
    <div className="grid gap-5">
      <div
        aria-label="Rules sections"
        className="bg-surface-subtle grid grid-cols-3 gap-1 rounded-xl p-1"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const active = tab.value === selected;
          return (
            <button
              aria-controls={tab.panelId}
              aria-selected={active}
              className={`focus-visible:ring-accent-blue min-h-11 rounded-lg px-2 text-sm font-black outline-none focus-visible:ring-2 ${
                active
                  ? "bg-surface text-brand-ink dark:ring-accent-blue shadow-sm dark:ring-1"
                  : "text-muted"
              }`}
              id={`${baseId}-${tab.value}-tab`}
              key={tab.value}
              onClick={() => setSelected(tab.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={active ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <section
          aria-labelledby={`${baseId}-${tab.value}-tab`}
          className="grid gap-5"
          hidden={tab.value !== selected}
          id={tab.panelId}
          key={tab.value}
          role="tabpanel"
          tabIndex={0}
        >
          {tab.content}
        </section>
      ))}
    </div>
  );
}
