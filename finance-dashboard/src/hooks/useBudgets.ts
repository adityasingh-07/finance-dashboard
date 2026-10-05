import { useMutation, useQuery } from '@tanstack/react-query'
import type { Tables } from '../lib/database.types.ts'
import type { ISODate } from '../lib/dates.ts'
import { supabase } from '../lib/supabaseClient.ts'
import { queryKeys } from './queryKeys.ts'
import { useInvalidate } from './useInvalidate.ts'

export type Budget = Tables<'budgets'>

/** Budgets for one month (`month` must be the 1st). */
export function useBudgets(month: ISODate) {
  return useQuery({
    queryKey: queryKeys.budgets(month),
    queryFn: async () => {
      const { data, error } = await supabase.from('budgets').select('*').eq('month', month)
      if (error) throw error
      return data
    },
  })
}

/** Creates or replaces the budget for a category in a month. */
export function useSetBudget() {
  const invalidate = useInvalidate('budgets')
  return useMutation({
    mutationFn: async (input: { category_id: string; month: ISODate; limit_cents: number }) => {
      // user_id is filled by its column default, which Postgres applies before
      // checking the conflict target.
      const { error } = await supabase
        .from('budgets')
        .upsert(input, { onConflict: 'user_id,month,category_id' })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteBudget() {
  const invalidate = useInvalidate('budgets')
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** Copies every budget from one month into another (which should be empty). */
export function useCopyBudgets() {
  const invalidate = useInvalidate('budgets')
  return useMutation({
    mutationFn: async ({ from, to }: { from: ISODate; to: ISODate }) => {
      const { data, error } = await supabase
        .from('budgets')
        .select('category_id, limit_cents')
        .eq('month', from)
      if (error) throw error
      if (data.length === 0) return

      const { error: insertError } = await supabase
        .from('budgets')
        .insert(data.map((b) => ({ ...b, month: to })))
      if (insertError) throw insertError
    },
    onSuccess: invalidate,
  })
}
