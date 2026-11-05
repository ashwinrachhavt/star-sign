/**
 * Mercury narrative adapter (SERVER-ONLY — launch wave 1).
 *
 * OpenAI-compatible chat completions against the validated Mercury
 * endpoint, model mercury-3. The MERCURY_API_KEY is read here, inside a
 * module imported only by route handlers — it never reaches the client
 * bundle. Port pattern (engineering.md rule 6, push-adapter precedent):
 * the route depends on NarrativeAdapter; swapping providers or stubbing
 * in tests means implementing the interface — nothing else changes.
 */

export const MERCURY_BASE_URL =
  process.env.MERCURY_BASE_URL ?? "https://api.inceptionlabs.ai/v1";
export const MERCURY_MODEL = process.env.MERCURY_MODEL ?? "mercury-3";

// The grounding contract lives in @star-sign/core so it is testable and
// client-safe; the server modules import it through this re-export so
// every server call site reads as one narrative surface.
export {
  buildNarrativePrompt,
  parseNarrativeOutput,
  buildDailyNarrativeFacts,
  buildWeekNarrativeFacts,
  buildAskNarrativeFacts,
  NARRATIVE_REFUSAL_SENTINEL,
  NARRATIVE_MODEL_NAME,
  NARRATIVE_PROMPT_VERSION,
  type NarrativeFacts,
  type NarrativeScope,
} from "@star-sign/core";

export interface NarrativePrompt {
  system: string;
  user: string;
}

export type NarrativeAdapterResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export interface NarrativeAdapter {
  generate(prompt: NarrativePrompt): Promise<NarrativeAdapterResult>;
}

/** Request timeout for a narrative generation (ms). */
const MERCURY_TIMEOUT_MS = 20_000;

/**
 * Live Mercury adapter. Uses fetch directly — no SDK dependency; the
 * adapter stays server-side only.
 */
export class MercuryNarrativeAdapter implements NarrativeAdapter {
  async generate(prompt: NarrativePrompt): Promise<NarrativeAdapterResult> {
    const key = process.env.MERCURY_API_KEY;
    if (!key) {
      // Not a crash: narratives degrade honestly when unconfigured.
      return { ok: false, reason: "mercury_not_configured" };
    }
    try {
      const res = await fetch(`${MERCURY_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MERCURY_MODEL,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          // Grounded restatement, not free generation: a lowish
          // temperature keeps the narrator near the supplied facts.
          temperature: 0.6,
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(MERCURY_TIMEOUT_MS),
      });
      if (!res.ok) {
        return { ok: false, reason: `mercury_http_${res.status}` };
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) return { ok: false, reason: "mercury_empty_response" };
      return { ok: true, text };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "mercury_network",
      };
    }
  }
}

/** No-op adapter for tests and dry runs (push-adapter precedent). */
export class NullNarrativeAdapter implements NarrativeAdapter {
  readonly sent: NarrativePrompt[] = [];
  constructor(private readonly reply = "The sky is quiet; so is this stub.") {}
  async generate(prompt: NarrativePrompt): Promise<NarrativeAdapterResult> {
    this.sent.push(prompt);
    return { ok: true, text: this.reply };
  }
}
