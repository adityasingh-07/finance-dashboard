import { useMutation, useQuery } from '@tanstack/react-query'
import type { Tables } from '../lib/database.types.ts'
import { supabase } from '../lib/supabaseClient.ts'
import { queryKeys } from './queryKeys.ts'
import { useInvalidate } from './useInvalidate.ts'

export type Category = Tables<'categories'>

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateCategory() {
  const invalidate = useInvalidate('categories')
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { error } = await supabase.from('categories').insert(input)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateCategory() {
  const invalidate = useInvalidate('categories')
  return useMutation({
    mutationFn: async ({ id, ...changes }: { id: string; name: string; color: string }) => {
      const { error } = await supabase.from('categories').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/**
 * Deletes a category. Fails with code 23503 if it still has expenses and no
 * `reassignTo` is given; with one, its expenses are moved first (atomically).
 */
export function useDeleteCategory() {
  const invalidate = useInvalidate('categoryDelete')
  return useMutation({
    mutationFn: async ({ id, reassignTo }: { id: string; reassignTo?: string }) => {
      const { error } = await supabase.rpc('delete_category', {
        p_category_id: id,
        p_reassign_to: reassignTo,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
