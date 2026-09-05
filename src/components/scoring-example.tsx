"use client";

import { useState } from "react";
import { scoreClub } from "@/features/scoring";

const explanations = {
  5: "Exact position.",
  3: "Within three places, even across the halfway line.",
  1: "The correct half, but more than three places away.",
  0: "Different halves and more than three places away.",
};

export function ScoringExample() {
  const [predicted, setPredicted] = useState("4");
  const [actual, setActual] = useState("6");
  const valid = [predicted, actual].every(
    (value) =>
      value.trim() !== "" &&
      Number.isInteger(Number(value)) &&
      Number(value) >= 1 &&
      Number(value) <= 20,
  );
  const points = valid ? scoreClub(Number(predicted), Number(actual)) : null;
  return (
    <section
      className="bg-brand-soft rounded-xl p-5"
      aria-labelledby="scoring-example-heading"
    >
      <h3 id="scoring-example-heading" className="font-bold">
        Try a scoring example
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Predicted position
          <input
            className="bg-surface border-border min-h-12 w-full rounded-lg border px-3"
            type="number"
            min={1}
            max={20}
            step={1}
            value={predicted}
            onChange={(event) => setPredicted(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Actual position
          <input
            className="bg-surface border-border min-h-12 w-full rounded-lg border px-3"
            type="number"
            min={1}
            max={20}
            step={1}
            value={actual}
            onChange={(event) => setActual(event.target.value)}
          />
        </label>
      </div>
      <p className="mt-4 text-sm leading-6" role="status">
        {points === null ? (
          "Enter whole positions from 1 to 20."
        ) : (
          <>
            <strong>
              {points} {points === 1 ? "point" : "points"}.
            </strong>{" "}
            {explanations[points]}
          </>
        )}
      </p>
    </section>
  );
}
