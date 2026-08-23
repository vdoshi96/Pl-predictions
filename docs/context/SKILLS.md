# Recurring workflows

Implemented project skill:

- `/update-results` — owner-run, reviewed standings, Spotlight facts, official Win Streak fixture-drift checks, and completed-round outcomes through `/admin/standings`, `/admin/results`, and `/admin/win-streak`. No source acquisition runs in the deployed application.

Potential additional project skills after their workflows stabilize:

- Validate and import a canonical standings snapshot without exposing source credentials.
- Roll the active season forward with an officially verified 20-club seed.
- Verify prediction reveal/deadline privacy and scoring across a deployed build.
- Generate and check same-content HTML peers for every tracked Markdown file.

Owner-run FotMob or Transfermarkt acquisition remains an offline, reviewed workflow. Do not add it to the deployed application, a public runtime route, or Vercel Cron.
