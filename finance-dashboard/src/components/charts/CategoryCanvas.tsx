// Lazy-loaded: this module (and Chart.js) only downloads when a chart renders.
import './register.ts'
import type { ChartData, ChartOptions } from 'chart.js'
import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { CategoryRow } from '../../lib/dashboard.ts'
import { formatCents } from '../../lib/money.ts'
import { barTipLabelsPlugin, tooltipStyle } from './plugins.ts'
import type { ChartTheme } from './useChartTheme.ts'

export type CategoryCanvasProps = {
  rows: CategoryRow[]
  theme: ChartTheme
  /** One label per row, drawn at the bar tip. */
  tipLabels: string[]
  /** Right padding that fits the widest tip label. */
  tipPadding: number
  ariaLabel: string
}

const BAR_THICKNESS = 14 // <= 24px; the rest of each row is air

export default function CategoryCanvas({ rows, theme, tipLabels, tipPadding, ariaLabel }: CategoryCanvasProps) {
  const data = useMemo<ChartData<'bar', (number | null)[], string>>(
    () => ({
      labels: rows.map((r) => r.name),
      datasets: [
        {
          // Spent: one series, one hue. Over-budget bars switch to the
          // reserved critical colour (paired with a text label at the tip).
          label: 'Spent',
          data: rows.map((r) => r.spentCents),
          backgroundColor: rows.map((r) => (r.overByCents > 0 ? theme.critical : theme.series)),
          hoverBackgroundColor: rows.map((r) => (r.overByCents > 0 ? theme.critical : theme.series)),
          barThickness: BAR_THICKNESS,
          borderRadius: 4,
          borderSkipped: 'start', // rounded data end, square at the baseline
          grouped: false,
          order: 1, // drawn on top of the track
        },
        {
          // Budget: a lighter step of the same ramp behind the bar (meter track).
          label: 'Budget',
          data: rows.map((r) => r.limitCents),
          backgroundColor: theme.track,
          hoverBackgroundColor: theme.track,
          barThickness: BAR_THICKNESS,
          borderRadius: 4,
          borderSkipped: 'start',
          grouped: false,
          order: 2,
        },
      ],
    }),
    [rows, theme],
  )

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      // Hovering anywhere on a row shows it: the hit target is the whole band.
      interaction: { mode: 'index', axis: 'y', intersect: false },
      layout: { padding: { right: tipPadding } },
      scales: {
        // Every bar is labelled at its tip, so the value axis is dropped.
        x: { display: false, beginAtZero: true, grid: { display: false } },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: theme.text, font: { size: 13 } },
        },
      },
      plugins: {
        tooltip: {
          ...tooltipStyle<'bar'>(theme),
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title: (items) => (items[0] ? rows[items[0].dataIndex].name : ''),
            label: (item) => {
              const r = rows[item.dataIndex]
              const lines = [`${formatCents(r.spentCents)} spent · ${r.sharePct}% of the month`]
              if (r.limitCents === null) {
                lines.push('No budget')
              } else {
                const used = r.limitCents > 0 ? Math.round((r.spentCents / r.limitCents) * 100) : null
                lines.push(`${formatCents(r.limitCents)} budget${used === null ? '' : ` · ${used}% used`}`)
                if (r.overByCents > 0) lines.push(`Over by ${formatCents(r.overByCents)}`)
              }
              return lines
            },
            labelPointStyle: () => ({ pointStyle: 'rect', rotation: 0 }),
          },
        },
      },
    }),
    [rows, theme, tipPadding],
  )

  const plugins = useMemo(() => [barTipLabelsPlugin(tipLabels, [0, 1], theme.textMuted)], [tipLabels, theme])

  return <Bar data={data} options={options} plugins={plugins} role="img" aria-label={ariaLabel} />
}
