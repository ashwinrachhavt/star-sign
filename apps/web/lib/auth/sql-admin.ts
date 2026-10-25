/**
 * SQL-level identity deletion (ASH-231 / 0.1c).
 *
 * PostgREST cannot reach the auth schema; the account-deletion flow
 * needs `delete from auth.users` (the FK cascades then wipe profiles and
 * every owned table). Uses the postgres client with the database URL
 * from the environment.
 *
 * SECURITY: server-only, called exclusively by the account-deletion
 * route after requireActor. The target id always comes from the verified
 * session, never from the client.
 */
import postgres from "postgres";

export function deleteAuthUserViaSql(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const url =
    process.env.SUPABASE_DB_URL ??
    process.env.STAR_SIGN_TEST_DATABASE_URL ??
    (process.env.SUPABASE_DB_PASSWORD
      ? `postgres://postgres:${process.env.SUPABASE_DB_PASSWORD}@localhost:54322/postgres`
      : null);

  if (!url) {
    return Promise.resolve({
      ok: false,
      error: "no database url configured for identity deletion",
    });
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  return (async () => {
    try {
      await sql`delete from auth.users where id = ${userId}`;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "delete failed" };
    } finally {
      await sql.end();
    }
  })();
}
