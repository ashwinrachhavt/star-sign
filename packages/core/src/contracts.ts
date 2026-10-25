/**
 * Shared transport schemas (ASH-233 / 0.3b).
 *
 * Single definition per contract: route handlers parse with these, domain
 * types derive via z.infer. camelCase JSON; validation at the boundary.
 */
import { z } from "zod";

export const birthTimePrecisionSchema = z.enum(["exact", "approximate", "unknown"]);

export const birthProfileInputSchema = z
  .object({
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
    birthTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "must be HH:mm")
      .nullish(),
    birthTimePrecision: birthTimePrecisionSchema,
    birthTimeZone: z.string().min(1).max(64),
    ianaTimeZone: z.string().min(1).max(64).nullish(),
    birthPlace: z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      label: z.string().max(200).nullish(),
    }),
  })
  .strict();

export type BirthProfileInput = z.infer<typeof birthProfileInputSchema>;

export const personInputSchema = z
  .object({
    displayName: z.string().min(1).max(120),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    birthTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullish(),
    birthTimePrecision: birthTimePrecisionSchema.default("unknown"),
    birthTimeZone: z.string().max(64).nullish(),
    birthLat: z.number().min(-90).max(90).nullish(),
    birthLon: z.number().min(-180).max(180).nullish(),
    relation: z
      .enum(["friend", "family", "partner", "coworker", "other"])
      .default("friend"),
  })
  .strict();

export type PersonInput = z.infer<typeof personInputSchema>;

export const reflectionInputSchema = z
  .object({
    forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    body: z.string().min(1).max(10_000),
  })
  .strict();

export const reflectionPatchSchema = z
  .object({
    body: z.string().min(1).max(10_000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field required");

export type ReflectionInput = z.infer<typeof reflectionInputSchema>;

export const dailyReadingRequestSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export const uuidSchema = z.string().uuid();

/* ---- Connections (ASH-256 / 5.1) — additive; existing schemas untouched ---- */

export const connectionStateSchema = z.enum([
  "requested",
  "accepted",
  "revoked",
  "disconnected",
]);

export type ConnectionState = z.infer<typeof connectionStateSchema>;

/** POST /api/connections — request a connection with someone by user id. */
export const connectionRequestSchema = z
  .object({
    addresseeId: uuidSchema,
  })
  .strict();

export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;

/** Serialized connection row as returned by all connection routes. */
export const connectionViewSchema = z.object({
  id: uuidSchema,
  requesterId: uuidSchema,
  addresseeId: uuidSchema,
  state: connectionStateSchema,
  requestedAt: z.string(),
  respondedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});

export type ConnectionView = z.infer<typeof connectionViewSchema>;
