import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { fromMonthParam, monthStart, toMonthParam, todayISO, type ISODate } from '../lib/dates.ts'

/**
 * The month being viewed, kept in the URL (?month=2026-10) so it survives
 * reloads, is shareable, and carries across pages. Defaults to this month.
 */
export function useSelectedMonth(): [ISODate, (month: ISODate) => void] {
  const [params, setParams] = useSearchParams()
  const month = fromMonthParam(params.get('month')) ?? monthStart(todayISO())

  const setMonth = useCallback(
    (next: ISODate) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          updated.set('month', toMonthParam(next))
          return updated
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return [month, setMonth]
}
