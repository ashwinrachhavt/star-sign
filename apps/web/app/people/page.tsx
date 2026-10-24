import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddPersonForm from "./add-person-form";
import PersonCard from "./person-card";

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
      <nav className="top">
        <a href="/day">My Day</a>
        <a href="/people">People</a>
      </nav>

      <h1 style={{ margin: "16px 0 8px" }}>People</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Privately add people you care about. Their data is visible only to you.
      </p>

      <AddPersonForm />

      <div style={{ marginTop: 24 }}>
        {(people ?? []).map((person) => (
          <PersonCard key={person.id} person={person} />
        ))}
      </div>
    </main>
  );
}
