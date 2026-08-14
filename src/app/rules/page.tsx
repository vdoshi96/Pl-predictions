import {
  Calculator,
  EyeOff,
  ListChecks,
  Medal,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RULES_PENDING_RESULTS_MESSAGE } from "@/content/public-copy";
import { HowToPlay } from "@/components/how-to-play";

export const metadata: Metadata = { title: "How to play & scoring" };

const tableRules = [
  { label: "Exact finishing position", points: 5 },
  { label: "Within three places", points: 3 },
  { label: "Correct top or bottom half", points: 1 },
  { label: "Everything else", points: 0 },
] as const;

const spotlightRules = [
  ["Top scorer", "Ranked by the chosen player’s final goals-list position."],
  [
    "Top assister",
    "Ranked by the chosen player’s final assists-list position.",
  ],
  ["Most clean sheets", "A club pick, ranked by the club clean-sheets list."],
  [
    "Underdog team",
    "Average predicted finish minus actual finish; the largest positive index ranks first.",
  ],
  [
    "Overrated team",
    "Actual finish minus average predicted finish; the largest positive index ranks first.",
  ],
  [
    "Underdog player",
    "FotMob average season ratings ranked from highest to lowest.",
  ],
  [
    "Overrated player",
    "FotMob average season ratings ranked from lowest to highest.",
  ],
] as const;

export default function RulesPage() {
  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-4xl gap-5 sm:gap-7">
        <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-accent text-brand ring-accent">
              2026/27 competition
            </Badge>
            <Badge variant="warning">Five manual results pending</Badge>
          </div>
          <div className="mt-5 flex items-start gap-3">
            <ListChecks
              aria-hidden="true"
              className="text-accent-blue mt-1 size-7 shrink-0"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                How to play & scoring
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                Follow the three mobile steps to submit one immutable entry:
                your full 1–20 table, all seven spotlight picks, and a final
                review. Table and spotlight scoring stay separate.
              </p>
            </div>
          </div>
        </section>

        <HowToPlay />

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <span className="bg-brand-soft text-brand grid size-11 shrink-0 place-items-center rounded-xl">
                <Trophy aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-brand-strong text-xl font-black">
                  League-table points
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Each club earns only its highest matching tier. Your champion
                  is the club placed first in your table; it is highlighted on
                  the leaderboard and uses the same table scoring, with no
                  separate champion bonus.
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 sm:grid-cols-4">
              {tableRules.map((rule) => (
                <div
                  className="bg-brand-soft ring-border rounded-xl p-3 text-center ring-1"
                  key={rule.label}
                >
                  <dt className="text-xs leading-4 font-semibold text-slate-600">
                    {rule.label}
                  </dt>
                  <dd className="text-brand mt-1 text-2xl font-black">
                    {rule.points}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card id="spotlight-scoring">
          <CardContent>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ffe3ef] text-[#8f0033]">
                <Sparkles aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-brand-strong text-xl font-black">
                  Spotlight accuracy
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  This score never joins the table leaderboard. With N active
                  brackets, an occupied result rank earns max(0, N + 1 − rank)
                  accuracy points. Rank 1 earns N, rank 2 earns N − 1, and ranks
                  after N earn 0. Equal outcomes share the same result rank and
                  accuracy points.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {spotlightRules.map(([label, description]) => (
                <div
                  className="border-border rounded-xl border bg-[#fcf9fd] p-3"
                  key={label}
                >
                  <h3 className="text-brand-strong text-sm font-black">
                    {label}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {description}
                  </p>
                </div>
              ))}
            </div>
            <Link
              className="bg-brand text-accent focus-visible:ring-accent-blue mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black outline-none hover:bg-[#4b0b50] focus-visible:ring-2"
              href="/spotlight"
            >
              Open spotlight accuracy
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <span className="text-brand grid size-11 place-items-center rounded-xl bg-[#dffcff]">
              <Calculator aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-brand-strong text-xl font-black">
                Team expectation example
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                If Manchester United’s average predicted finish is 2.4 and its
                actual position is 10th, its underdog index is 2.4 − 10 = −7.6,
                while its overrated index is 10 − 2.4 = +7.6. Indexes keep full
                precision for ranking and are rounded only for display.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent>
              <Search aria-hidden="true" className="text-brand size-6" />
              <h2 className="text-brand-strong mt-3 text-lg font-black">
                Player list and Other
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                The 2026-08-13 snapshot covers 582 players across all 20 clubs.
                It is the owner-selected, internally reconciled roster for this
                game, not an independently verified official league list. Player
                selectors search first, last, or full name after two letters and
                show up to 20 matches; 582 supplied portraits appear locally.
                Choose Other player for anyone unavailable or new. A silhouette
                appears only if a portrait is missing or fails to load. Each
                custom name must be matched to a canonical season player before
                its reviewed result dataset can be published and scored.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <EyeOff aria-hidden="true" className="text-brand size-6" />
              <h2 className="text-brand-strong mt-3 text-lg font-black">
                Privacy and reveal
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Before reveal, the public leaderboard shows only the
                participant, 0 points, and champion pick. The other 19 table
                positions and all seven spotlight picks stay private. A receipt
                browser and the administrator may view the full entry.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3">
            <Medal
              aria-hidden="true"
              className="mt-0.5 size-5 text-amber-800"
            />
            <div>
              <h2 className="font-black text-amber-950">Current data status</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                The app now stores and displays all seven picks. Underdog-team
                and overrated-team accuracy can recalculate from the group
                tables and active standings. The player roster and available
                portraits are loaded. {RULES_PENDING_RESULTS_MESSAGE} Only
                complete submitted entries appear in the active bracket count.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Table scores are derived on read and remain capped at 100. Spotlight
          accuracy is separate; manually entered outcome lists supply results,
          not editable participant totals. Deleting an entry removes its table
          and spotlight picks and recalculates the active bracket count and any
          group averages from the remaining submissions.
        </p>
      </div>
    </main>
  );
}
