import { useQueryClient } from '@tanstack/react-query'
import { dependsOn } from './queryKeys.ts'

/** Returns a function that refetches every query depending on `table`. */
export function useInvalidate(table: keyof typeof dependsOn) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      dependsOn[table].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
}
