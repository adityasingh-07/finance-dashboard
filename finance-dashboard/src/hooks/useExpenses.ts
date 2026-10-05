import { useMutation, useQuery } from '@tanstack/react-query'
import type { Tables } from '../lib/database.types.ts'
import { monthBounds, type ISODate } from '../lib/dates.ts'
import type { ExpenseInput } from '../lib/expenseForm.ts'
import { supabase } from '../lib/supabaseClient.ts'
import { queryKeys } from './queryKeys.ts'
import { useInvalidate } from './useInvalidate.ts'

export type Expense = Tables<'expenses'>

/** All expenses in the month containing `month`, newest first. */
export function useExpenses(month: ISODate) {
  return useQuery({
    queryKey: queryKeys.expenses(month),
    queryFn: async () => {
      const { start, end } = monthBounds(month)
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('spent_on', start)
        .lt('spent_on', end)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
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
