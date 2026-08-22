import { Smartphone } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const walkthroughSteps = [
  {
    alt: "Mobile prediction screen showing the ordered Premier League table and large reorder handles.",
    callouts: [
      {
        label:
          "Enter your display name first, then drag the handles or use Arrow, Page Up, Page Down, Home, and End.",
        marker: "1",
        position: { left: "96%", top: "84%" },
      },
      {
        label:
          "A–Z is only a blank slate. Reorder it, or explicitly confirm A–Z if that is your real prediction.",
        marker: "2",
        position: { left: "96%", top: "53%" },
      },
    ],
    description:
      "Enter the display name that will appear on the leaderboard, then put every club in your predicted finishing order.",
    image: "/how-to-play/step-1-table-mobile.png",
    step: 1,
    title: "Build your 1–20 table",
  },
  {
    alt: "Mobile spotlight-picks screen showing selected players, a selected club, and the review action.",
    callouts: [
      {
        label:
          "Type at least two letters to search up to 20 player matches; Other player always remains available.",
        marker: "1",
        position: { left: "96%", top: "37%" },
      },
      {
        label:
          "Complete all seven categories, then use Review all predictions.",
        marker: "2",
        position: { left: "96%", top: "91%" },
      },
    ],
    description:
      "Choose all seven required player and club predictions. Other player remains available when the catalogue does not have your pick.",
    image: "/how-to-play/step-2-spotlight-mobile.png",
    step: 2,
    title: "Make seven spotlight picks",
  },
  {
    alt: "Mobile final-review screen showing a compact club summary, seven spotlight picks, and the submit button.",
    callouts: [
      {
        label:
          "Confirm the champion, seven spotlight picks, and table summary; expand the middle positions if needed.",
        marker: "1",
        position: { left: "96%", top: "51%" },
      },
      {
        label:
          "Submit only when everything is right; a completed entry cannot be edited.",
        marker: "2",
        position: { left: "96%", top: "94%" },
      },
    ],
    description:
      "Check the complete package before the one atomic submission saves your table and spotlight choices together.",
    image: "/how-to-play/step-3-review-mobile.png",
    step: 3,
    title: "Review once, then submit",
  },
] as const;

export function HowToPlay() {
  return (
    <section
      aria-labelledby="how-to-play-heading"
      className="grid gap-4"
      id="how-to-play"
    >
      <div className="flex items-start gap-3">
        <span className="bg-brand text-accent grid size-11 shrink-0 place-items-center rounded-xl">
          <Smartphone aria-hidden="true" className="size-5" />
        </span>
        <div>
          <Badge variant="accent">Live mobile walkthrough</Badge>
          <h2
            className="text-brand-ink-strong mt-2 text-2xl font-black tracking-tight sm:text-3xl"
            id="how-to-play-heading"
          >
            How to play in three steps
          </h2>
          <p className="text-muted mt-1 max-w-3xl text-sm leading-6">
            These annotated 390 × 844 screenshots were captured from the current
            mobile flow. Swipe the cards on a phone, then follow the numbered
            notes below each screen.
          </p>
        </div>
      </div>

      <ol className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
        {walkthroughSteps.map((walkthrough) => (
          <li
            className="w-[min(82vw,20rem)] shrink-0 snap-center lg:w-auto"
            key={walkthrough.step}
          >
            <Card className="h-full overflow-hidden">
              <figure className="grid h-full grid-rows-[auto_1fr]">
                <div className="light-preview border-border bg-brand-soft relative overflow-hidden border-b">
                  <Image
                    alt={walkthrough.alt}
                    className="h-auto w-full"
                    height={844}
                    loading={walkthrough.step === 1 ? "eager" : "lazy"}
                    sizes="(max-width: 1023px) 82vw, 29vw"
                    src={walkthrough.image}
                    width={390}
                  />
                  {walkthrough.callouts.map((callout) => (
                    <span
                      aria-hidden="true"
                      className="bg-accent text-accent-ink absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-black shadow-[0_6px_16px_rgba(38,0,45,0.35)] ring-2 ring-white/90"
                      key={callout.marker}
                      style={callout.position}
                    >
                      {callout.marker}
                    </span>
                  ))}
                </div>
                <CardContent className="flex flex-col">
                  <p className="text-rose-ink text-xs font-black tracking-[0.12em] uppercase">
                    Step {walkthrough.step} of 3
                  </p>
                  <h3 className="text-brand-ink-strong mt-1 text-xl font-black tracking-tight">
                    {walkthrough.title}
                  </h3>
                  <p className="text-muted mt-2 text-sm leading-6">
                    {walkthrough.description}
                  </p>
                  <ol className="mt-4 grid gap-2">
                    {walkthrough.callouts.map((callout) => (
                      <li
                        className="text-muted flex items-start gap-2 text-xs leading-5 font-semibold"
                        key={callout.marker}
                      >
                        <span className="bg-accent text-accent-ink mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-black">
                          {callout.marker}
                        </span>
                        <span>{callout.label}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </figure>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
