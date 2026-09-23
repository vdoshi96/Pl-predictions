import { EyeOff, Search, Sparkles, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { HowToPlay } from "@/components/how-to-play";
import { PageHeading } from "@/components/page-heading";
import { ScoringExample } from "@/components/scoring-example";
import { Card, CardContent } from "@/components/ui/card";
import { RULES_PENDING_RESULTS_MESSAGE } from "@/content/public-copy";
import { RoundOutcomeChips } from "@/features/win-streak/round-outcomes";

import { RulesTabs } from "./rules-tabs";

export const metadata: Metadata = { title: "How to play & scoring" };

const tableRules = [
  { label: "Exact finishing position", points: 5 },
  { label: "Within three places", points: 3 },
  { label: "Correct top or bottom half", points: 1 },
  { label: "Everything else", points: 0 },
] as const;

const spotlightCategories = [
  ["Top scorer", "The player who finishes highest in the league goals list."],
  [
    "Top assister",
    "The player who finishes highest in the league assists list.",
  ],
  ["Most clean sheets", "The club that keeps the most clean sheets."],
  [
    "Underdog team",
    "The club that beats the group’s average prediction by the most. Only clubs picked for this category are ranked.",
  ],
  [
    "Overrated team",
    "The club that falls furthest below the group’s average prediction. Only clubs picked for this category are ranked.",
  ],
  [
    "Underdog player",
    "Picked players ranked by reviewed average season rating, highest first. A player without a rating shows N/A and scores nothing.",
  ],
  [
    "Overrated player",
    "Picked players ranked by reviewed average season rating, lowest first. A player without a rating shows N/A and scores nothing.",
  ],
] as const;

function TableRules() {
  return (
    <>
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <span className="bg-brand-soft text-brand-ink grid size-11 shrink-0 place-items-center rounded-xl">
              <Trophy aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-brand-ink-strong text-xl font-black">
                League-table points
              </h2>
              <p className="text-muted mt-1 text-sm leading-6">
                Each club earns only its highest matching tier. Your champion is
                the club placed first in your table; it uses the same scoring,
                with no separate bonus. The most anyone can score is 100.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tableRules.map((rule) => (
              <div
                className="bg-brand-soft ring-border rounded-xl p-3 text-center ring-1"
                key={rule.label}
              >
                <dt className="text-muted text-xs leading-4 font-semibold">
                  {rule.label}
                </dt>
                <dd className="text-brand-ink mt-1 text-2xl font-black">
                  {rule.points}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <ScoringExample />
      <details className="border-border border-y py-4">
        <summary className="min-h-11 cursor-pointer font-bold">
          How you enter
        </summary>
        <div className="mt-4">
          <HowToPlay />
        </div>
      </details>
      <Card>
        <CardContent className="flex items-start gap-3">
          <EyeOff
            aria-hidden="true"
            className="text-brand-ink size-6 shrink-0"
          />
          <div>
            <h2 className="text-brand-ink-strong text-lg font-black">
              Privacy and reveal
            </h2>
            <p className="text-muted mt-1 text-sm leading-6">
              Before the reveal, everyone sees only each entry’s name, 0 points,
              and champion. The other 19 positions and all seven spotlight picks
              stay private until the season opens.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SpotlightRules() {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="bg-rose-soft text-rose-ink grid size-11 shrink-0 place-items-center rounded-xl">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-brand-ink-strong text-xl font-black">
            Pick seven outcomes. Closer calls score more.
          </h2>
          <p className="text-muted mt-1 text-sm leading-6">
            Each category is ranked once its result list is published. The
            best-placed pick earns one point per entry, the next earns one
            fewer, and so on. With 14 entries, 1st earns 14 points, 2nd earns
            13, and so on down to 0. Ties share the higher place. Spotlight
            points never change your 100-point table score.
          </p>
        </div>
      </div>
      <Card>
        <CardContent>
          <h3 className="text-brand-ink-strong text-sm font-black">
            Worked example · Top scorer
          </h3>
          <ul className="mt-2 grid gap-1.5 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span>Your pick finished 1st</span>
              <span className="score-pill" data-tier="exact">
                +14
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Your pick finished 13th</span>
              <span className="score-pill" data-tier="miss">
                +2
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        {spotlightCategories.map(([label, description]) => (
          <div
            className="border-border bg-surface-lilac rounded-xl border p-3"
            key={label}
          >
            <h3 className="text-brand-ink-strong text-sm font-black">
              {label}
            </h3>
            <p className="text-muted mt-1 text-xs leading-5">{description}</p>
          </div>
        ))}
      </div>
      <p className="text-muted text-sm leading-6">
        Example: if the group expected Manchester United to finish 2.4th on
        average and they finish 10th, they are 7.6 places below expectations.
        That is a strong overrated pick and a poor underdog pick.
      </p>
      <p className="text-muted text-sm leading-6">
        {RULES_PENDING_RESULTS_MESSAGE}
      </p>
      <Card>
        <CardContent className="flex items-start gap-3">
          <Search
            aria-hidden="true"
            className="text-brand-ink size-6 shrink-0"
          />
          <div>
            <h3 className="text-brand-ink-strong text-lg font-black">
              Can’t find a player?
            </h3>
            <p className="text-muted mt-1 text-sm leading-6">
              Search by first or last name. If someone is missing, choose Other
              player and type their name. The owner matches it to the right
              player before results count.
            </p>
          </div>
        </CardContent>
      </Card>
      <Link
        className="bg-brand text-accent focus-visible:ring-accent-blue hover:bg-brand-hover inline-flex min-h-11 items-center justify-self-start rounded-xl px-4 text-sm font-black outline-none focus-visible:ring-2"
        href="/spotlight"
      >
        Open spotlight accuracy
      </Link>
    </>
  );
}

function WinStreakRules() {
  return (
    <>
      <div>
        <h2 className="text-brand-ink-strong text-xl font-black">
          One club per matchweek. Keep winning.
        </h2>
        <p className="text-muted mt-1 text-sm leading-6">
          Matchweeks 2–38. Pick one club to win before the round’s first
          kickoff. Picks are final and everyone can see them.
        </p>
      </div>
      <RoundOutcomeChips />
      <p className="text-muted text-sm leading-6">
        A club that wins for you can’t be picked again until your streak resets.
        Your best streak decides your rank, and equal bests share a place. Lost
        your cookie? Enter the same display name to pick up where you left off.
      </p>
      <Link
        className="text-brand-ink inline-flex min-h-11 items-center justify-self-start text-sm font-semibold underline"
        href="/win-streak"
      >
        Play Win Streak
      </Link>
    </>
  );
}

export default function RulesPage() {
  return (
    <main id="main-content" className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-4xl gap-5 sm:gap-7">
        <PageHeading
          title="The rules, without the guesswork."
          description="The season game and Win Streak run independently."
        />
        <RulesTabs
          tabs={[
            {
              content: <TableRules />,
              label: "Table",
              panelId: "table-rules",
              value: "table",
            },
            {
              content: <SpotlightRules />,
              label: "Spotlight",
              panelId: "spotlight-scoring",
              value: "spotlight",
            },
            {
              content: <WinStreakRules />,
              label: "Win Streak",
              panelId: "win-streak-rules",
              value: "win-streak",
            },
          ]}
        />
      </div>
    </main>
  );
}
