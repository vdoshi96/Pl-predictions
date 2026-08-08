"use client";

import { move } from "@dnd-kit/helpers";
import { Accessibility } from "@dnd-kit/dom";
import {
  DragDropProvider,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, RotateCcw } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { TeamMark } from "@/components/team-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export interface PredictionTeam {
  id: string;
  displayName: string;
  shortName: string;
  sortName: string;
  assetPath?: string | null;
}

export interface PredictionSorterProps {
  teams: PredictionTeam[];
  onChange: (teams: PredictionTeam[]) => void;
  disabled?: boolean;
  mode?: "prediction" | "standings";
  className?: string;
}

function compareTeams(left: PredictionTeam, right: PredictionTeam) {
  const bySortName = left.sortName.localeCompare(right.sortName, "en", {
    sensitivity: "base",
  });

  return bySortName || left.id.localeCompare(right.id);
}

export function sortTeamsAlphabetically(teams: readonly PredictionTeam[]) {
  return [...teams].sort(compareTeams);
}

function ordersMatch(
  left: readonly PredictionTeam[],
  right: readonly PredictionTeam[],
) {
  return (
    left.length === right.length &&
    left.every((team, index) => team.id === right[index]?.id)
  );
}

function teamForId(
  teams: readonly PredictionTeam[],
  id: string | number | undefined,
) {
  return id === undefined
    ? undefined
    : teams.find((team) => team.id === String(id));
}

interface SortableTeamRowProps {
  team: PredictionTeam;
  index: number;
  count: number;
  disabled: boolean;
  positionKind: "predicted" | "actual";
  onKeyboardMove: (teamId: string, direction: -1 | 1) => void;
}

function SortableTeamRow({
  team,
  index,
  count,
  disabled,
  positionKind,
  onKeyboardMove,
}: SortableTeamRowProps) {
  const position = index + 1;
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: team.id,
    index,
    disabled,
    data: {
      teamName: team.displayName,
      position,
    },
  });

  return (
    <li
      ref={ref}
      value={position}
      aria-label={`${team.displayName}, ${positionKind} position ${position} of ${count}`}
      aria-posinset={position}
      aria-setsize={count}
      data-team-id={team.id}
      data-position={position}
      className={cn(
        "group relative flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl border bg-white py-2 pr-2 pl-3 shadow-[0_10px_26px_-24px_rgba(55,0,60,0.65)] transition-[border-color,box-shadow,opacity,transform] duration-150 motion-reduce:transition-none",
        position === 11
          ? "border-border border-t-accent-blue mt-2 border-t-4"
          : "border-border",
        isDropTarget && "border-accent ring-2 ring-[#d8ffeb]",
        isDragging && "border-accent z-10 scale-[1.01] opacity-85 shadow-xl",
      )}
    >
      <span
        aria-label={`${positionKind === "predicted" ? "Predicted" : "Actual"} position ${position}`}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl font-mono text-sm font-black tabular-nums",
          position <= 10 ? "bg-brand text-white" : "bg-brand-soft text-brand",
        )}
      >
        {position}
      </span>

      <TeamMark
        name={team.displayName}
        initials={team.shortName}
        src={team.assetPath}
        size="md"
      />

      <span className="text-brand-strong min-w-0 grow text-sm leading-4 font-bold break-words sm:truncate sm:text-base sm:leading-5">
        {team.displayName}
      </span>

      <button
        ref={handleRef}
        type="button"
        disabled={disabled}
        aria-label={`Move ${team.displayName}, currently ${positionKind} position ${position} of ${count}. Use Arrow Up or Arrow Down to move one place, or drag this handle.`}
        onKeyDown={(event) => {
          const direction =
            event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : null;
          if (direction === null || disabled) return;

          event.preventDefault();
          event.stopPropagation();
          onKeyboardMove(team.id, direction);
        }}
        className="border-border bg-brand-soft text-brand hover:border-accent-lilac hover:text-brand-strong focus-visible:ring-accent-blue inline-flex size-14 shrink-0 touch-none items-center justify-center rounded-xl border outline-none select-none hover:bg-white focus-visible:ring-2 focus-visible:ring-offset-2 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none sm:cursor-grab"
      >
        <GripVertical
          aria-hidden="true"
          className="size-6"
          strokeWidth={2.25}
        />
      </button>
    </li>
  );
}

export function PredictionSorter({
  teams,
  onChange,
  disabled = false,
  mode = "prediction",
  className,
}: PredictionSorterProps) {
  const headingId = useId();
  const positionKind = mode === "standings" ? "actual" : "predicted";
  const [announcement, setAnnouncement] = useState(
    mode === "standings"
      ? "Current table order ready. Use each team's move button to set its actual position."
      : "Prediction order ready. Use each team's move button to reorder the table.",
  );
  const startOrderRef = useRef<PredictionTeam[] | null>(null);
  const dragOrderRef = useRef<PredictionTeam[] | null>(null);
  const lastAnnouncedPositionRef = useRef<number | null>(null);
  const alphabeticalTeams = useMemo(
    () => sortTeamsAlphabetically(teams),
    [teams],
  );
  const isAlphabetical = ordersMatch(teams, alphabeticalTeams);

  function handleKeyboardMove(teamId: string, direction: -1 | 1) {
    const currentIndex = teams.findIndex((team) => team.id === teamId);
    if (currentIndex < 0) return;

    const nextIndex = Math.min(
      teams.length - 1,
      Math.max(0, currentIndex + direction),
    );
    const source = teams[currentIndex];
    if (!source) return;

    if (nextIndex === currentIndex) {
      setAnnouncement(
        `${source.displayName} is already at position ${currentIndex + 1} of ${teams.length}.`,
      );
      return;
    }

    const nextTeams = [...teams];
    nextTeams.splice(currentIndex, 1);
    nextTeams.splice(nextIndex, 0, source);
    onChange(nextTeams);
    setAnnouncement(
      `${source.displayName} moved to position ${nextIndex + 1} of ${teams.length}.`,
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const source = teamForId(teams, event.operation.source?.id);
    if (!source) return;

    const position = teams.findIndex((team) => team.id === source.id) + 1;
    startOrderRef.current = [...teams];
    dragOrderRef.current = [...teams];
    lastAnnouncedPositionRef.current = position;
    setAnnouncement(
      `Dragging ${source.displayName}, position ${position} of ${teams.length}. Move the pointer to choose a new position.`,
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const sourceId = event.operation.source?.id;
    if (sourceId === undefined) return;

    const currentDragOrder = dragOrderRef.current ?? teams;
    const nextTeams = move([...currentDragOrder], event) as PredictionTeam[];
    const nextPosition =
      nextTeams.findIndex((team) => team.id === String(sourceId)) + 1;
    const source = teamForId(nextTeams, sourceId);

    if (!ordersMatch(currentDragOrder, nextTeams)) {
      dragOrderRef.current = nextTeams;
      onChange(nextTeams);
    }

    if (
      source &&
      nextPosition > 0 &&
      nextPosition !== lastAnnouncedPositionRef.current
    ) {
      lastAnnouncedPositionRef.current = nextPosition;
      setAnnouncement(
        `${source.displayName} moved to position ${nextPosition} of ${teams.length}.`,
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const sourceId = event.operation.source?.id;
    const originalOrder = startOrderRef.current;

    if (event.canceled) {
      if (originalOrder && !ordersMatch(teams, originalOrder)) {
        onChange(originalOrder);
      }

      const source = teamForId(originalOrder ?? teams, sourceId);
      setAnnouncement(
        source
          ? `Reordering cancelled. ${source.displayName} returned to its original position.`
          : "Reordering cancelled. The original table has been restored.",
      );
    } else {
      const nextTeams = dragOrderRef.current ?? teams;
      if (!ordersMatch(teams, nextTeams)) {
        onChange(nextTeams);
      }

      const source = teamForId(nextTeams, sourceId);
      const finalPosition = source
        ? nextTeams.findIndex((team) => team.id === source.id) + 1
        : 0;
      setAnnouncement(
        source && finalPosition > 0
          ? `${source.displayName} placed at position ${finalPosition} of ${nextTeams.length}.`
          : "Team placed in its new position.",
      );
    }

    startOrderRef.current = null;
    dragOrderRef.current = null;
    lastAnnouncedPositionRef.current = null;
  }

  function resetToAlphabetical() {
    if (!isAlphabetical) {
      onChange(alphabeticalTeams);
      setAnnouncement(
        `${mode === "standings" ? "Current" : "Prediction"} table reset to alphabetical order.`,
      );
    }
  }

  return (
    <section className={cn("min-w-0", className)} aria-labelledby={headingId}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-brand-strong text-lg font-black">
            {mode === "standings"
              ? "Current league table"
              : "Your predicted table"}
          </h2>
          <p className="text-muted mt-1 text-sm leading-5">
            Drag the large handle, or focus it and press Arrow Up or Arrow Down.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToAlphabetical}
          disabled={disabled || isAlphabetical}
          aria-label={`Reset ${mode === "standings" ? "current" : "prediction"} table to alphabetical order`}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Reset A–Z
        </Button>
      </div>

      <p
        className="sr-only"
        role="status"
        aria-live="assertive"
        aria-atomic="true"
      >
        {announcement}
      </p>

      <DragDropProvider
        plugins={(defaultPlugins) =>
          defaultPlugins.filter((plugin) => plugin !== Accessibility)
        }
        sensors={[PointerSensor]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ol
          className="grid min-w-0 gap-2"
          aria-label={`Premier League ${positionKind} positions`}
        >
          {teams.map((team, index) => (
            <SortableTeamRow
              key={team.id}
              team={team}
              index={index}
              count={teams.length}
              disabled={disabled}
              positionKind={positionKind}
              onKeyboardMove={handleKeyboardMove}
            />
          ))}
        </ol>
      </DragDropProvider>
    </section>
  );
}
