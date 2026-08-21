import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SpotlightResultsDesk,
  type ResultDeskDataset,
} from "@/app/admin/results/results-desk";

const {
  createResultOnly,
  createStandalone,
  finalize,
  publish,
  saveAlias,
  saveDraft,
  undo,
} = vi.hoisted(() => ({
  createResultOnly: vi.fn(),
  createStandalone: vi.fn(),
  finalize: vi.fn(),
  publish: vi.fn(),
  saveAlias: vi.fn(),
  saveDraft: vi.fn(),
  undo: vi.fn(),
}));

vi.mock("@/app/admin/results/actions", () => ({
  createStandaloneSpotlightResultOnlyPlayer: createStandalone,
  createSpotlightResultOnlyPlayer: createResultOnly,
  finalizeSpotlightResult: finalize,
  publishSpotlightResult: publish,
  saveSpotlightResultAlias: saveAlias,
  saveSpotlightResultDraft: saveDraft,
  undoFinalSpotlightResult: undo,
}));

const playerA = "00000000-0000-4000-8000-00000000000a";
const playerB = "00000000-0000-4000-8000-00000000000b";
const playerC = "00000000-0000-4000-8000-00000000000c";
const teamA = "00000000-0000-4000-8000-00000000000d";
const teamB = "00000000-0000-4000-8000-00000000000e";
const snapshotIds = {
  clean_sheets: "00000000-0000-4000-8000-000000000011",
  goals: "00000000-0000-4000-8000-000000000014",
  assists: "00000000-0000-4000-8000-000000000013",
  player_ratings: "00000000-0000-4000-8000-000000000012",
} as const;

const pickedSubjects = {
  assists: [],
  clean_sheets: [],
  goals: [playerC],
  player_ratings: [playerC],
} as const;

const datasets: ResultDeskDataset[] = [
  {
    activeSnapshot: null,
    capturedAt: "2027-05-24T18:00:00.000Z",
    coveredThroughRank: 2,
    dataset: "goals" as const,
    pinnedAliases: [],
    publishedRows: [],
    pointers: {
      activeSnapshotId: null,
      finalSnapshotId: null,
      workingSnapshotId: snapshotIds.goals,
    },
    rows: [
      { metricValue: 20, subjectId: playerA },
      { metricValue: 18, subjectId: playerB },
    ],
    source: "Owner review",
    sourceReference: null,
  },
  {
    activeSnapshot: null,
    capturedAt: "2027-05-24T18:00:00.000Z",
    coveredThroughRank: 2,
    dataset: "assists" as const,
    pinnedAliases: [],
    publishedRows: [],
    pointers: {
      activeSnapshotId: null,
      finalSnapshotId: null,
      workingSnapshotId: snapshotIds.assists,
    },
    rows: [
      { metricValue: 15, subjectId: playerA },
      { metricValue: 13, subjectId: playerB },
    ],
    source: "Owner review",
    sourceReference: null,
  },
  {
    activeSnapshot: null,
    capturedAt: "2027-05-24T18:00:00.000Z",
    coveredThroughRank: 2,
    dataset: "clean_sheets" as const,
    pinnedAliases: [],
    publishedRows: [],
    pointers: {
      activeSnapshotId: null,
      finalSnapshotId: null,
      workingSnapshotId: snapshotIds.clean_sheets,
    },
    rows: [
      { metricValue: 16, subjectId: teamA },
      { metricValue: 14, subjectId: teamB },
    ],
    source: "Owner review",
    sourceReference: null,
  },
  {
    activeSnapshot: null,
    capturedAt: "2027-05-24T18:00:00.000Z",
    coveredThroughRank: 2,
    dataset: "player_ratings" as const,
    pinnedAliases: [],
    publishedRows: [],
    pointers: {
      activeSnapshotId: null,
      finalSnapshotId: null,
      workingSnapshotId: snapshotIds.player_ratings,
    },
    rows: [
      { metricValue: 9, subjectId: playerA },
      { metricValue: 5, subjectId: playerB },
    ],
    source: "Owner review",
    sourceReference: null,
  },
];

function renderDesk(datasetInput = datasets) {
  return render(
    <SpotlightResultsDesk
      aliases={[
        {
          categories: ["top_scorer"],
          customPlayerName: "New Striker",
          normalizedCustomPlayerName: "new striker",
          playerId: null,
        },
      ]}
      bracketCount={2}
      datasets={datasetInput}
      pickedSubjects={pickedSubjects}
      players={[
        {
          active: true,
          id: playerA,
          label: "Alice — ARS",
          names: ["Alice"],
        },
        {
          active: true,
          id: playerB,
          label: "Bea — LIV",
          names: ["Bea"],
        },
        {
          active: false,
          id: playerC,
          label: "Casey — CHE",
          names: ["Casey"],
        },
      ]}
      publishReady
      seasonName="2026/27 Premier League"
      teams={[
        { id: teamA, label: "Arsenal", names: ["Arsenal"] },
        { id: teamB, label: "Liverpool", names: ["Liverpool"] },
      ]}
    />,
  );
}

describe("SpotlightResultsDesk", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    saveDraft.mockResolvedValue({
      message: "Draft saved.",
      ok: true,
      pinnedAliases: [
        {
          normalizedCustomPlayerName: "new striker",
          playerId: playerC,
        },
      ],
      snapshotId: snapshotIds.player_ratings,
    });
    publish.mockResolvedValue({ message: "Published.", ok: true });
    finalize.mockResolvedValue({ message: "Final.", ok: true });
    undo.mockResolvedValue({ message: "Undone.", ok: true });
    saveAlias.mockResolvedValue({
      message: "Other-player spelling matched.",
      ok: true,
    });
    createResultOnly.mockResolvedValue({
      message: "Inactive result-only player created and matched.",
      ok: true,
      playerId: "00000000-0000-4000-8000-000000000099",
    });
    createStandalone.mockResolvedValue({
      message: "Inactive result-only player created for factual result rows.",
      ok: true,
      playerId: "00000000-0000-4000-8000-000000000098",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders five row-by-row tables and keeps both ratings views synchronized", () => {
    renderDesk();

    const resultTables = screen.getAllByRole("table");
    expect(resultTables).toHaveLength(5);
    for (const table of resultTables) {
      expect(table.closest("section")).toHaveClass("min-w-0");
      expect(table.parentElement).toHaveClass("overflow-x-auto");
    }
    expect(
      screen.getByRole("combobox", { name: "Top scorer rank 1 subject" }),
    ).toHaveAttribute("aria-autocomplete", "list");
    const underdogRating = screen.getByRole("spinbutton", {
      name: /Underdog player ratings Season rating for Alice/,
    });
    const overratedRating = screen.getByRole("spinbutton", {
      name: /Overrated player ratings Season rating for Alice/,
    });

    fireEvent.change(underdogRating, { target: { value: "8.5" } });
    expect(overratedRating).toHaveValue(8.5);
  });

  it("saves the shared ratings rows once from either synchronized view", async () => {
    renderDesk();
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: /Overrated player ratings Season rating for Alice/,
      }),
      { target: { value: "8.25" } },
    );
    const ratingsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Player ratings",
    });
    const ratingsCard = ratingsHeading.closest(".rounded-2xl");
    expect(ratingsCard).not.toBeNull();
    fireEvent.click(
      within(ratingsCard as HTMLElement).getByRole("button", {
        name: "Save draft",
      }),
    );

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        coveredThroughRank: 2,
        dataset: "player_ratings",
        rows: expect.arrayContaining([
          { metricValue: 8.25, subjectId: playerA },
        ]),
      }),
    );
  });

  it("keeps review confirmation blocked until an Other spelling is saved", async () => {
    renderDesk();
    const goalsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Top scorer",
    });
    const goalsCard = goalsHeading.closest(".rounded-2xl");
    expect(goalsCard).not.toBeNull();
    const goals = within(goalsCard as HTMLElement);
    fireEvent.click(goals.getByRole("button", { name: "Review & publish" }));
    let dialog = screen.getByRole("dialog", {
      name: "Review and publish Top scorer",
    });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(
      within(dialog).getByRole("button", { name: "Publish provisional" }),
    ).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    const aliasSelect = screen.getByRole("combobox", {
      name: "Catalogue match",
    });
    fireEvent.focus(aliasSelect);
    fireEvent.change(aliasSelect, { target: { value: "Casey" } });
    fireEvent.click(
      screen.getByRole("option", { name: /Casey — CHE \(inactive\)/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save match" }));
    await waitFor(() => expect(saveAlias).toHaveBeenCalledTimes(1));
    fireEvent.click(goals.getByRole("button", { name: "Review & publish" }));
    dialog = screen.getByRole("dialog", {
      name: "Review and publish Top scorer",
    });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(
      within(dialog).getByRole("button", { name: "Publish provisional" }),
    ).toBeEnabled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publish provisional" }),
    );
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
  });

  it("binds finalization to the displayed active snapshot, not a newer working draft", () => {
    const activeId = "11111111-0000-4000-8000-000000000014";
    renderDesk(
      datasets.map((dataset) =>
        dataset.dataset === "goals"
          ? {
              ...dataset,
              activeSnapshot: {
                capturedAt: "2027-05-20T18:00:00.000Z",
                coveredThroughRank: 2,
                id: activeId,
                itemCount: 2,
                source: "Published review",
                sourceReference: null,
              },
              pointers: {
                ...dataset.pointers,
                activeSnapshotId: activeId,
              },
            }
          : dataset,
      ),
    );

    const published = screen.getByRole("region", {
      name: "Top scorer published snapshot",
    });
    expect(within(published).getByText(activeId)).toBeVisible();
    expect(
      within(published).getByRole("button", { name: "Finalize 11111111" }),
    ).toBeEnabled();
  });

  it("blocks a repeated publish after the working snapshot becomes active", async () => {
    renderDesk();
    const cleanSheetsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Most clean sheets",
    });
    const cleanSheetsCard = cleanSheetsHeading.closest(".rounded-2xl");
    expect(cleanSheetsCard).not.toBeNull();
    const controls = within(cleanSheetsCard as HTMLElement);
    fireEvent.click(controls.getByRole("button", { name: "Review & publish" }));
    const dialog = screen.getByRole("dialog", {
      name: "Review and publish Most clean sheets",
    });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publish provisional" }),
    );

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(
      controls.getByRole("button", { name: "Review & publish" }),
    ).toBeDisabled();
  });

  it("publishes the exact snapshot returned by the combined save", async () => {
    const returnedSnapshotId = "00000000-0000-4000-8000-000000000099";
    saveDraft.mockResolvedValueOnce({
      message: "Draft saved.",
      ok: true,
      pinnedAliases: [],
      snapshotId: returnedSnapshotId,
    });
    renderDesk();
    const cleanSheetsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Most clean sheets",
    });
    const cleanSheetsCard = cleanSheetsHeading.closest(".rounded-2xl");
    expect(cleanSheetsCard).not.toBeNull();
    fireEvent.click(
      within(cleanSheetsCard as HTMLElement).getByRole("button", {
        name: "Review & publish",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Review and publish Most clean sheets",
    });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publish provisional" }),
    );

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        coverageAttested: true,
        workingSnapshotId: returnedSnapshotId,
      }),
    );
  });

  it("seeds only missing submitted subjects and preserves existing rows", () => {
    renderDesk();
    const goalsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Top scorer",
    });
    const goalsCard = goalsHeading.closest(".rounded-2xl");
    expect(goalsCard).not.toBeNull();
    const goals = within(goalsCard as HTMLElement);

    fireEvent.click(
      goals.getByRole("button", { name: "Seed from submissions" }),
    );

    expect(
      goals.getByRole("spinbutton", {
        name: /Top scorer Goals for Casey/,
      }),
    ).toHaveValue(0);
    expect(
      goals.getByRole("spinbutton", {
        name: /Top scorer Goals for Alice/,
      }),
    ).toHaveValue(20);
  });

  it("keeps a saved draft recoverable when combined publishing fails", async () => {
    const returnedSnapshotId = "00000000-0000-4000-8000-000000000097";
    saveDraft.mockResolvedValueOnce({
      message: "Draft saved.",
      ok: true,
      pinnedAliases: [],
      snapshotId: returnedSnapshotId,
    });
    publish.mockResolvedValueOnce({
      message: "Coverage incomplete.",
      ok: false,
    });
    renderDesk();
    const cleanSheetsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Most clean sheets",
    });
    const cleanSheetsCard = cleanSheetsHeading.closest(".rounded-2xl");
    expect(cleanSheetsCard).not.toBeNull();
    const cleanSheets = within(cleanSheetsCard as HTMLElement);
    fireEvent.click(
      cleanSheets.getByRole("button", { name: "Review & publish" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Review and publish Most clean sheets",
    });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publish provisional" }),
    );

    expect(await screen.findByText("Coverage incomplete.")).toBeVisible();
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ workingSnapshotId: returnedSnapshotId }),
    );
    expect(
      cleanSheets.getByRole("button", { name: "Review & publish" }),
    ).toBeEnabled();
  });

  it("can create and match a genuinely new inactive result-only player", async () => {
    renderDesk();
    fireEvent.click(
      screen.getByRole("button", { name: "Create result-only player" }),
    );

    await waitFor(() => expect(createResultOnly).toHaveBeenCalledTimes(1));
    expect(createResultOnly).toHaveBeenCalledWith({
      customPlayerName: "New Striker",
    });
    expect(
      await screen.findByText(
        "Inactive result-only player created and matched.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create result-only player" }),
    ).toBeDisabled();
  });

  it("can add an unpredicted inactive player for factual result rows", async () => {
    renderDesk();
    fireEvent.change(
      screen.getByRole("textbox", { name: /New factual result subject/ }),
      { target: { value: "Late Breakthrough" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add result-only player" }),
    );

    await waitFor(() => expect(createStandalone).toHaveBeenCalledTimes(1));
    expect(createStandalone).toHaveBeenCalledWith({
      displayName: "Late Breakthrough",
    });
    expect(
      await screen.findByText(
        "Inactive result-only player created for factual result rows.",
      ),
    ).toBeVisible();
  });
});
