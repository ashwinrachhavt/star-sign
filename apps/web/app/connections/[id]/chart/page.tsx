import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ui";
import { fontMono, fontSerif } from "@/app/fonts";

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

interface Projection {
  connectionId: string;
  state: "requested" | "accepted" | "revoked" | "disconnected";
  placements?: Array<{ planet: string; sign: string; house?: number }>;
  consentNote: string;
}

/**
 * Partner chart view (ASH-258 / 5.3): consumes the 5.2 projection
 * (GET /api/connections/{id}/chart). Renders exactly what the visibility
 * matrix permits — placements + the consent note; nothing else exists on
 * this surface by construction (raw birth data never leaves the server).
 */
export default async function PartnerChartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Server-side projection via the same visibility module the API route
  // uses — one implementation, two surfaces (route = client API, page =
  // SSR). Cross-user ids → 404 (hidden).
  let projection: Projection | null = null;
  {
    const { data: connection } = await supabase
      .from("connections")
      .select("id, requester_id, addressee_id, state, share_scope")
      .eq("id", id)
      .maybeSingle();
    if (
      !connection ||
      (connection.requester_id !== userData.user.id &&
        connection.addressee_id !== userData.user.id)
    ) {
      notFound();
    }
    const partnerId =
      connection.requester_id === userData.user.id
        ? connection.addressee_id
        : connection.requester_id;
    const { data: partnerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", partnerId)
      .single();
    const { projectPartnerChart } = await import(
      "@/server/connections/visibility"
    );
    const { rowToBirthProfile } = await import("@/lib/readings");
    const { adminClient } = await import("@/lib/auth/admin");
    // Partner rows are invisible to the actor's RLS client (owner-only
    // policies); the service role lifts the storage read. The visibility
    // projection remains the security boundary.
    const admin = adminClient();
    let chart = null;
    if (
      connection.state === "accepted" &&
      connection.share_scope === "chart_placements"
    ) {
      const { data: partnerBirth } = await admin
        .from("birth_profiles")
        .select("*")
        .eq("user_id", partnerId)
        .maybeSingle();
      if (partnerBirth) {
        const { computeNatalChart } = await import("@star-sign/core");
        chart = computeNatalChart(rowToBirthProfile(partnerBirth));
      }
    }
    const { data: partnerNameRow } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", partnerId)
      .single();
    projection = projectPartnerChart(
      connection.state as Projection["state"],
      connection.share_scope as "none" | "chart_placements",
      chart,
      connection.id,
      partnerNameRow?.display_name ?? "your partner",
    );
  }

  if (!projection) notFound();

  return (
    <main className="container">
      <ScreenHeader
        title="Partner Chart"
        tabs={[
          { id: "day", label: "My Day", href: "/day" },
          { id: "week", label: "Week", href: "/week" },
          { id: "people", label: "People", href: "/people" },
        ]}
        activeTab="people"
      />

      {projection.state === "accepted" && projection.placements?.length ? (
        <>
          <section className="card" style={{ marginTop: "var(--space-5)" }}>
            <p
              className={`type-micro-label t-11 ${fontMono.className}`}
              style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}
            >
              CHART PLACEMENTS — SHARED BY CHOICE
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {projection.placements.map((p) => (
                <div
                  key={p.planet}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "var(--space-4)",
                    alignItems: "center",
                    minHeight: "44px",
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <span aria-hidden="true">{PLANET_GLYPHS[p.planet] ?? "•"}</span>
                  <span className={`type-mono t-13 ${fontMono.className}`}>
                    {p.planet.toUpperCase()}
                  </span>
                  <span className="type-prose t-15">
                    {p.sign.charAt(0).toUpperCase() + p.sign.slice(1)}
                    {p.house !== undefined && (
                      <span
                        className={`type-display t-22 ${fontSerif.className}`}
                        style={{ marginLeft: "var(--space-3)" }}
                      >
                        {p.house}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <p
            className={`type-micro-label t-11 ${fontMono.className}`}
            style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-4)" }}
          >
            {projection.consentNote.toUpperCase()}
          </p>
          <div style={{ marginTop: "var(--space-5)" }}>
            <a
              href="/people"
              className="ui-button-link ui-focusable type-micro-label t-13"
            >
              Back to people
            </a>
          </div>
        </>
      ) : (
        <>
          <p
            className="type-prose t-17"
            style={{ color: "var(--ink-secondary)", marginTop: "var(--space-6)" }}
          >
            {projection.state === "requested"
              ? "Chart sharing starts once you're both connected. Nothing is visible yet."
              : "This connection has ended. Nothing is visible — immediately."}
          </p>
          <div style={{ marginTop: "var(--space-5)" }}>
            <a
              href="/people"
              className="ui-button-link ui-focusable type-micro-label t-13"
            >
              Back to people
            </a>
          </div>
        </>
      )}
    </main>
  );
}
