// Fail fast, with a fix, when the local Supabase stack isn't up.
export default async function globalSetup() {
  try {
    const response = await fetch('http://127.0.0.1:54321/auth/v1/health')
    if (!response.ok) throw new Error(`status ${response.status}`)
  } catch (error) {
    throw new Error(
      `Local Supabase is not reachable at 127.0.0.1:54321 (${String(error)}). ` +
        'Start Docker Desktop, then run `npm run db:start` (and `npm run db:reset` for fresh demo data).',
      { cause: error },
    )
  }
}
