import { useQueryClient } from '@tanstack/react-query'
import { dependsOn } from './queryKeys.ts'

/** Returns a function that refetches every query affected by `change` (see dependsOn). */
export function useInvalidate(change: keyof typeof dependsOn) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      dependsOn[change].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
}
