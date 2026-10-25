/**
 * Push adapter port + Expo implementation (ASH-263 / 7.1).
 *
 * Narrow, provider-swappable boundary per engineering.md rule 6: the
 * dispatch job records delivery intent; adapters translate that to a
 * provider call. Swapping Expo push for another provider means
 * implementing this interface — nothing else changes.
 */
export interface PushMessage {
  userId: string;
  token: string;
  title: string;
  body: string;
}

export interface PushResult {
  delivered: boolean;
  providerId?: string;
  error?: string;
}

export interface PushAdapter {
  send(message: PushMessage): Promise<PushResult>;
}

/**
 * Expo push adapter. Uses fetch directly against Expo's HTTPS API — no
 * SDK dependency in core; the adapter lives server-side only.
 */
export class ExpoPushAdapter implements PushAdapter {
  constructor(private readonly endpoint = "https://exp.host/--/api/v2/push/send") {}

  async send(message: PushMessage): Promise<PushResult> {
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Expo expects an array body; single-message shorthand is fine too.
        },
        body: JSON.stringify({
          to: message.token,
          title: message.title,
          body: message.body,
          sound: "default",
        }),
      });
      if (!res.ok) {
        return { delivered: false, error: `expo push ${res.status}` };
      }
      const body = (await res.json()) as {
        data?: { id?: string };
        errors?: unknown[];
      };
      if (body.errors && body.errors.length > 0) {
        return { delivered: false, error: "expo push error" };
      }
      return { delivered: true, providerId: body.data?.id };
    } catch (e) {
      return { delivered: false, error: e instanceof Error ? e.message : "network" };
    }
  }
}

/** No-op adapter for tests and dry-run dispatch. */
export class NullPushAdapter implements PushAdapter {
  readonly sent: PushMessage[] = [];
  async send(message: PushMessage): Promise<PushResult> {
    this.sent.push(message);
    return { delivered: true, providerId: `null-${this.sent.length}` };
  }
}
