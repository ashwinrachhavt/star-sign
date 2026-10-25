import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ConsentActions from "./consent-actions";
import { ScreenHeader } from "@/components/ui";
import { fontSerif } from "@/app/fonts";

/**
 * Consent screen (ASH-258 / 5.3, criterion 2): states exactly what will
 * be shared before acceptance. No buried scope — the summary is the
 * whole scope (visibility matrix from 5.2).
 */
export default async function ConnectionConsentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const userId = userData.user.id;

  const { data: connection } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, state, requested_at")
    .eq("id", id)
    .maybeSingle();

  if (
    !connection ||
    (connection.requester_id !== userId && connection.addressee_id !== userId)
  ) {
    notFound();
  }

  const outgoing = connection.requester_id === userId;
  const otherId = outgoing ? connection.addressee_id : connection.requester_id;
  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", otherId)
    .single();
  const otherName = otherProfile?.display_name ?? "This person";

  return (
    <main className="container">
      <ScreenHeader
        title="Connection"
        tabs={[
          { id: "day", label: "My Day", href: "/day" },
          { id: "week", label: "Week", href: "/week" },
          { id: "people", label: "People", href: "/people" },
        ]}
        activeTab="people"
      />

      <section style={{ marginTop: "var(--space-6)" }}>
        <h2 className={`type-display t-28 ${fontSerif.className}`}>
          {otherName}
        </h2>

        {connection.state === "requested" && !outgoing ? (
          <>
            <p
              className="type-prose t-17"
              style={{ marginTop: "var(--space-4)" }}
            >
              wants to connect with you. Here is exactly what accepting
              means:
            </p>
            <div className="card" style={{ marginTop: "var(--space-4)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <p className="type-prose t-15">
                  ☉ <strong>You share chart placements</strong> — the signs
                  (and houses, since your birth time is exact) of your Sun,
                  Moon, and planets. Not your birth date, time, or place.
                </p>
                <p className="type-prose t-15">
                  ☉ <strong>You both share, or neither does.</strong>{" "}
                  Accepting opens the same view of their chart to you.
                </p>
                <p className="type-prose t-15">
                  ☉ <strong>They can't see anything else</strong> — no
                  readings, no notes, no private people list.
                </p>
                <p className="type-prose t-15">
                  ☉ <strong>Either of you can end it at any time,</strong>{" "}
                  and it ends immediately — no grace period where your chart
                  stays visible.
                </p>
              </div>
            </div>
            <p
              className="type-micro-label t-11"
              style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-4)" }}
            >
              ONLY {otherName.toUpperCase().slice(0, 40)} CAN SEE THIS, AND
              THEY CAN TURN IT OFF AT ANY TIME.
            </p>
            <ConsentActions
              connectionId={connection.id}
              isRecipient={!outgoing}
              state={connection.state}
            />
          </>
        ) : (
          <>
            <p className="type-prose t-17" style={{ marginTop: "var(--space-4)" }}>
              Connection status: {connection.state}.
            </p>
            <ConsentActions
              connectionId={connection.id}
              isRecipient={!outgoing}
              state={connection.state}
            />
          </>
        )}
      </section>
    </main>
  );
}
