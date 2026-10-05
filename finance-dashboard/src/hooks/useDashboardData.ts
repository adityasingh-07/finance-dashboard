import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DailyRow } from '../lib/dashboard.ts'
import type { ISODate } from '../lib/dates.ts'
import { supabase } from '../lib/supabaseClient.ts'
import { queryKeys } from './queryKeys.ts'
import type { CategorySummary } from './useMonthlySummary.ts'

export type DashboardData = {
  /** The month these numbers belong to (1st of the month). */
  month: ISODate
  summary: CategorySummary[]
  daily: DailyRow[]
}

/**
 * Everything the dashboard charts need for one month, fetched together so the
 * summary and the daily series always describe the same month.
 *
 * On a month change the previous month's data stays (isPlaceholderData) until
 * the new month arrives, so charts dim instead of flashing a skeleton. Render
 * from data.month, not the selected month, so a dimmed chart is never shown
 * under the wrong label.
 */
export function useDashboardData(month: ISODate) {
  return useQuery({
    queryKey: queryKeys.dashboard(month),
    queryFn: async (): Promise<DashboardData> => {
      const [summary, daily] = await Promise.all([
        supabase.rpc('monthly_category_summary', { p_month: month }),
        supabase.rpc('daily_spend', { p_month: month }),
      ])
      if (summary.error) throw summary.error
      if (daily.error) throw daily.error
      return { month, summary: summary.data, daily: daily.data }
    },
    placeholderData: keepPreviousData,
  })
}
