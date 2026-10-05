import { lazy, Suspense } from 'react'
import type { PaceSeries } from '../../lib/dashboard.ts'
import { formatDay } from '../../lib/dates.ts'
import { formatCents } from '../../lib/money.ts'
import { ChartCard, ChartSkeleton, LegendItem } from './ChartCard.tsx'
import { useChartTheme } from './useChartTheme.ts'

const PaceCanvas = lazy(() => import('./PaceCanvas.tsx'))

const HEIGHT = 260

type Props = {
  series: PaceSeries
  budgetCents: number
  unbudgetedSpentCents: number
  monthLabel: string
  dimmed: boolean
}

export function PaceChart({ series, budgetCents, unbudgetedSpentCents, monthLabel, dimmed }: Props) {
  const theme = useChartTheme()
  const budgeted = series.measure === 'budgeted'
  const actualLabel = budgeted ? 'Spent in budgeted categories' : 'Spent'
  const last = series.actual.findLast((v) => v !== null) ?? null

  const description = budgeted ? (
    <>
      Running total of spending in budgeted categories, against a steady pace to your{' '}
      {formatCents(budgetCents)} budget. Bills paid early in the month, like rent, push the line above
      pace.
      {unbudgetedSpentCents > 0 &&
        ` Excludes ${formatCents(unbudgetedSpentCents)} in categories without a budget.`}
    </>
  ) : (
    'Running total of spending this month. Set budgets to see whether you’re on pace.'
  )

  const ariaLabel = budgeted
    ? `Line chart: ${monthLabel} spending in budgeted categories${last !== null ? ` reached ${formatCents(last)}` : ''} against a ${formatCents(budgetCents)} budget pace.`
    : `Line chart: ${monthLabel} spending${last !== null ? ` reached ${formatCents(last)}` : ''}.`

  const table = (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col" className="num">
            {actualLabel} (running total)
          </th>
          {series.pace && (
            <th scope="col" className="num">
              Budget pace
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {series.days.map((day, i) => (
          <tr key={day}>
            <td className="cell-date">{formatDay(day)}</td>
            <td className="num">{series.actual[i] === null ? '—' : formatCents(series.actual[i]!)}</td>
            {series.pace && <td className="num">{formatCents(series.pace[i])}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )

  // A single series needs no legend; the title names it.
  const legend = series.pace ? (
    <>
      <LegendItem label={actualLabel} color={theme.series} shape="line" />
      <LegendItem label="Budget pace" color={theme.pace} shape="dashed" />
    </>
  ) : null

  return (
    <ChartCard
      title="Spending vs pace"
      description={description}
      legend={legend}
      table={table}
      dimmed={dimmed}
    >
      <div className="chart-canvas" style={{ height: HEIGHT }}>
        <Suspense fallback={<ChartSkeleton height={HEIGHT} />}>
          <PaceCanvas series={series} theme={theme} actualLabel={actualLabel} ariaLabel={ariaLabel} />
        </Suspense>
      </div>
    </ChartCard>
  )
}
