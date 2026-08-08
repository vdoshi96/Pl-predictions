import type { z } from "zod";

import type {
  canonicalStandingsFailureCodeSchema,
  canonicalStandingsFailureSchema,
  canonicalStandingsImportPayloadSchema,
  canonicalStandingsItemSchema,
  canonicalStandingsSnapshotSchema,
} from "./validation";

export type CanonicalStandingsItem = z.infer<
  typeof canonicalStandingsItemSchema
>;
export type CanonicalStandingsSnapshot = z.infer<
  typeof canonicalStandingsSnapshotSchema
>;
export type CanonicalStandingsFailureCode = z.infer<
  typeof canonicalStandingsFailureCodeSchema
>;
export type CanonicalStandingsFailure = z.infer<
  typeof canonicalStandingsFailureSchema
>;
export type CanonicalStandingsImportPayload = z.infer<
  typeof canonicalStandingsImportPayloadSchema
>;
