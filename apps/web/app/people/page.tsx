import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddPersonForm from "./add-person-form";
import PersonCard from "./person-card";
import ConnectionsSection from "./connections-section";
import { ScreenHeader } from "@/components/ui";
import { fontMono } from "@/app/fonts";

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const userId = userData.user.id;

  const { data: people } = await supabase
    .from("people")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  // Connections in any state involving the actor (RLS: participants only).
  const { data: connections } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, state, requested_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("requested_at", { ascending: false });

  // Display names for the other party of each connection (projection-safe
  // field; never birth data).
  const otherIds = (connections ?? []).map((c) =>
    c.requester_id === userId ? c.addressee_id : c.requester_id,
  );
  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", otherIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const connectionViews = (connections ?? []).map((c) => ({
    id: c.id,
    state: c.state as "requested" | "accepted" | "revoked" | "disconnected",
    outgoing: c.requester_id === userId,
    otherName:
      nameById.get(c.requester_id === userId ? c.addressee_id : c.requester_id) ??
      "Someone",
    otherId: c.requester_id === userId ? c.addressee_id : c.requester_id,
  }));

  return (
    <main className="container">
      <ScreenHeader
        title="People"
        tabs={[
          { id: "day", label: "My Day", href: "/day" },
          { id: "week", label: "Week", href: "/week" },
          { id: "people", label: "People", href: "/people" },
          { id: "you", label: "You", href: "/you" },
        ]}
        activeTab="people"
      />

      <ConnectionsSection connections={connectionViews} viewerId={userId} />

      <section style={{ marginTop: "var(--space-6)" }}>
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}
        >
          PRIVATE NOTES
        </p>
        <p
          className="type-prose t-15"
          style={{ color: "var(--ink-secondary)", marginBottom: "var(--space-4)" }}
        >
          Privately add people you care about. Their data is visible only to
          you — this list is never shared.
        </p>
        <AddPersonForm />
        <div
          style={{
            marginTop: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          {(people ?? []).map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      </section>

      <p
        className={`type-micro-label t-11 ${fontMono.className}`}
        style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-6)", textAlign: "center" }}
      >
        CONNECTIONS ARE ALWAYS MUTUAL. EITHER OF YOU CAN END ONE AT ANY TIME.
      </p>
    </main>
  );
}
