import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddPersonForm from "./add-person-form";
import PersonCard from "./person-card";
import { ScreenHeader } from "@/components/ui";

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: people } = await supabase
    .from("people")
    .select("*")
    .eq("owner_id", userData.user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="container">
      <ScreenHeader
        title="People"
        tabs={[
          { id: "day", label: "My Day", href: "/day" },
          { id: "week", label: "Week", href: "/week" },
          { id: "people", label: "People", href: "/people" },
        ]}
        activeTab="people"
      />

      <p
        className="type-prose t-15"
        style={{ color: "var(--ink-secondary)", marginTop: "var(--space-5)" }}
      >
        Privately add people you care about. Their data is visible only to you.
      </p>

      <div style={{ marginTop: "var(--space-5)" }}>
        <AddPersonForm />
      </div>

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
    </main>
  );
}
