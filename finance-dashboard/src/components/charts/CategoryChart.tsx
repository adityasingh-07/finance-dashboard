import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { CategoryRow } from '../../lib/dashboard.ts'
import { formatCents, formatCentsShort } from '../../lib/money.ts'
import { CategoryLabel } from '../CategoryLabel.tsx'
import { ChartCard, ChartSkeleton, LegendItem } from './ChartCard.tsx'
import { measureLabels } from './plugins.ts'
import { useChartTheme } from './useChartTheme.ts'

const CategoryCanvas = lazy(() => import('./CategoryCanvas.tsx'))

const ROW_HEIGHT = 36
/** Below this width, tip labels drop the "of $budget" part. */
const COMPACT_WIDTH = 520

/**
 * Tracks an element's width. Uses a callback ref (state) rather than useRef so
 * it re-observes when the element remounts, e.g. after the table view toggle.
 */
function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, width] as const
}

function tipLabel(row: CategoryRow, compact: boolean): string {
  const spent = formatCentsShort(row.spentCents)
  if (row.overByCents > 0) {
    return compact ? `${spent} · over` : `${spent} of ${formatCentsShort(row.limitCents!)} · over by ${formatCentsShort(row.overByCents)}`
  }
  if (row.limitCents === null || compact) return spent
  return `${spent} of ${formatCentsShort(row.limitCents)}`
}

type Props = {
  rows: CategoryRow[]
  monthLabel: string
  dimmed: boolean
}

export function CategoryChart({ rows, monthLabel, dimmed }: Props) {
  const theme = useChartTheme()
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const compact = width > 0 && width < COMPACT_WIDTH

  const tipLabels = useMemo(() => rows.map((r) => tipLabel(r, compact)), [rows, compact])
  const tipPadding = useMemo(() => Math.ceil(measureLabels(tipLabels)) + 12, [tipLabels])
  const hasBudgets = rows.some((r) => r.limitCents !== null)
  const overCount = rows.filter((r) => r.overByCents > 0).length
  const height = rows.length * ROW_HEIGHT + 8

  const ariaLabel = `Bar chart: ${monthLabel} spending by category, ${rows
    .slice(0, 3)
    .map((r) => `${r.name} ${formatCents(r.spentCents)}`)
    .join(', ')}${rows.length > 3 ? ` and ${rows.length - 3} more` : ''}.${
    overCount > 0 ? ` ${overCount} over budget.` : ''
  }`

  const table = (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Category</th>
          <th scope="col" className="num">
            Spent
          </th>
          <th scope="col" className="num">
            Share
          </th>
          <th scope="col" className="num">
            Budget
          </th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <CategoryLabel name={r.name} color={r.color} />
            </td>
            <td className="num">{formatCents(r.spentCents)}</td>
            <td className="num">{r.sharePct}%</td>
            <td className="num">{r.limitCents === null ? '—' : formatCents(r.limitCents)}</td>
            <td>
              {r.limitCents === null
                ? 'No budget'
                : r.overByCents > 0
                  ? `Over by ${formatCents(r.overByCents)}`
                  : 'Within budget'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const legend = (
    <>
      <LegendItem label="Spent" color={theme.series} shape="rect" />
      {hasBudgets && <LegendItem label="Budget" color={theme.track} shape="rect" />}
      {overCount > 0 && <LegendItem label="Over budget" color={theme.critical} shape="rect" />}
    </>
  )

  return (
    <ChartCard
      title="Where the money went"
      description={`Spending by category in ${monthLabel}${hasBudgets ? ', with each budget shown as the track behind its bar' : ''}.`}
      legend={legend}
      table={table}
      dimmed={dimmed}
    >
      <div ref={ref} className="chart-canvas" style={{ height }}>
        <Suspense fallback={<ChartSkeleton height={height} />}>
          {width > 0 && (
            <CategoryCanvas
              rows={rows}
              theme={theme}
              tipLabels={tipLabels}
              tipPadding={tipPadding}
              ariaLabel={ariaLabel}
            />
          )}
        </Suspense>
      </div>
    </ChartCard>
  )
}
