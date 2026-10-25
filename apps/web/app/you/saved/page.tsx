import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScreenHeader, PlacementCard } from "@/components/ui";
import { fontMono } from "@/app/fonts";

export const dynamic = "force-dynamic";

/**
 * You → Saved (ASH-267): the user's own content — daily readings they've
 * received (today's at top) and private reflections. Private by
 * definition: both tables are RLS-scoped to the actor.
 */
export default async function YouSavedPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const userId = userData.user.id;

  const [{ data: readings }, { data: reflections }] = await Promise.all([
    supabase
      .from("daily_readings")
      .select("id, for_date, headline, explanation")
      .eq("user_id", userId)
      .order("for_date", { ascending: false })
      .limit(10),
    supabase
      .from("reflections")
      .select("id, for_date, body")
      .eq("user_id", userId)
      .order("for_date", { ascending: false })
      .limit(20),
  ]);

  const hasContent = (readings?.length ?? 0) + (reflections?.length ?? 0) > 0;

  return (
    <main className="container">
      <ScreenHeader
        title="You"
        tabs={[
          { id: "chart", label: "Chart", href: "/you" },
          { id: "saved", label: "Saved", href: "/you/saved" },
          { id: "settings", label: "Settings", href: "/you/settings" },
        ]}
        activeTab="saved"
      />

      <section style={{ marginTop: "var(--space-6)" }} aria-label="Saved readings">
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}
        >
          READINGS
        </p>
        {(readings?.length ?? 0) === 0 ? (
          <p className="type-prose t-15" style={{ color: "var(--ink-secondary)" }}>
            Your readings will collect here as you receive them. Today&apos;s is on the
            My Day page.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {readings!.map((r) => (
              <PlacementCard key={r.id} title={r.headline}>
                <p
                  className={`type-micro-label t-11 ${fontMono.className}`}
                  style={{ color: "var(--ink-tertiary)" }}
                >
                  {r.for_date}
                </p>
                <p className="type-prose t-15">{r.explanation}</p>
              </PlacementCard>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: "var(--space-7)" }} aria-label="Private reflections">
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}
        >
          PRIVATE REFLECTIONS
        </p>
        {(reflections?.length ?? 0) === 0 ? (
          <p className="type-prose t-15" style={{ color: "var(--ink-secondary)" }}>
            Nothing saved yet. Reflections you write are private — only you can read
            them, ever.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {reflections!.map((r) => (
              <article key={r.id} className="card">
                <p
                  className={`type-micro-label t-11 ${fontMono.className}`}
                  style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}
                >
                  {r.for_date}
                </p>
                <p className="type-prose t-15" style={{ whiteSpace: "pre-wrap" }}>
                  {r.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {!hasContent && (
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-7)", textAlign: "center" }}
        >
          SAVED CONTENT STAYS ON YOUR ACCOUNT — EXPORT ANY TIME FROM SETTINGS
        </p>
      )}
    </main>
  );
}
