// Turns Postgres/PostgREST errors into messages a user can act on.
// Constraint violations surface with their SQLSTATE in `code`.

const DEFAULT_MESSAGES: Record<string, string> = {
  '23505': 'That already exists.',
  '23503': "This is still in use, so it can't be changed that way.",
  '23514': "That value isn't allowed.",
  '42501': "You don't have permission to do that.",
}

export function friendlyError(
  error: unknown,
  overrides: Record<string, string> = {},
): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code)
    const message = overrides[code] ?? DEFAULT_MESSAGES[code]
    if (message) return message
  }
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Something went wrong. Please try again.'
}
