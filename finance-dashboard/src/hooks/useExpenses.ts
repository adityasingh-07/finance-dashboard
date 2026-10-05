import { useMutation, useQuery } from '@tanstack/react-query'
import type { Tables } from '../lib/database.types.ts'
import { monthBounds, type ISODate } from '../lib/dates.ts'
import type { ExpenseInput } from '../lib/expenseForm.ts'
import { supabase } from '../lib/supabaseClient.ts'
import { queryKeys } from './queryKeys.ts'
import { useInvalidate } from './useInvalidate.ts'

export type Expense = Tables<'expenses'>

// PostgREST returns at most max_rows (1000, supabase/config.toml) per request,
// silently truncating anything larger, so fetch in pages no bigger than that.
const PAGE_SIZE = 1000

/** All expenses in the month containing `month`, newest first. */
export function useExpenses(month: ISODate) {
  return useQuery({
    queryKey: queryKeys.expenses(month),
    queryFn: async () => {
      const { start, end } = monthBounds(month)
      const rows: Expense[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .gte('spent_on', start)
          .lt('spent_on', end)
          // id makes the order total, so pages never overlap or skip rows.
          .order('spent_on', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        rows.push(...data)
        if (data.length < PAGE_SIZE) return rows
      }
    },
  })
}

export function useAddExpense() {
  const invalidate = useInvalidate('expenses')
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const { error } = await supabase.from('expenses').insert(input)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateExpense() {
  const invalidate = useInvalidate('expenses')
  return useMutation({
    mutationFn: async ({ id, ...changes }: ExpenseInput & { id: string }) => {
      const { error } = await supabase.from('expenses').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidate('expenses')
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
