import { useQuery } from '@tanstack/react-query'
import type { Database } from '../lib/database.types.ts'
import type { ISODate } from '../lib/dates.ts'
import { supabase } from '../lib/supabaseClient.ts'
import { queryKeys } from './queryKeys.ts'

type GeneratedRow =
  Database['public']['Functions']['monthly_category_summary']['Returns'][number]

// The type generator marks every function column non-null, but these are
// NULL for categories without a budget.
export type CategorySummary = Omit<
  GeneratedRow,
  'limit_cents' | 'remaining_cents' | 'pct_used'
> & {
  limit_cents: number | null
  remaining_cents: number | null
  pct_used: number | null
}

/** Spend vs budget per category for the month containing `month`. */
export function useMonthlySummary(month: ISODate) {
  return useQuery({
    queryKey: queryKeys.summary(month),
    queryFn: async (): Promise<CategorySummary[]> => {
      const { data, error } = await supabase.rpc('monthly_category_summary', {
        p_month: month,
      })
      if (error) throw error
      return data
    },
  })
}
