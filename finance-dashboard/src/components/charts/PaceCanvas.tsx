// Lazy-loaded: this module (and Chart.js) only downloads when a chart renders.
import './register.ts'
import type { ChartData, ChartOptions } from 'chart.js'
import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { PaceSeries } from '../../lib/dashboard.ts'
import { formatDay, formatShortDay } from '../../lib/dates.ts'
import { formatCents, formatCentsShort } from '../../lib/money.ts'
import { crosshairPlugin, lineEndLabelsPlugin, tooltipStyle } from './plugins.ts'
import type { ChartTheme } from './useChartTheme.ts'

export type PaceCanvasProps = {
  series: PaceSeries
  theme: ChartTheme
  actualLabel: string
  /** Text alternative for the canvas; the table view carries every value. */
  ariaLabel: string
}

export default function PaceCanvas({ series, theme, actualLabel, ariaLabel }: PaceCanvasProps) {
  const lastActual = series.actual.findLastIndex((v) => v !== null)

  const data = useMemo<ChartData<'line', (number | null)[], string>>(() => {
    const datasets: ChartData<'line', (number | null)[], string>['datasets'] = [
      {
        label: actualLabel,
        data: series.actual,
        borderColor: theme.series,
        backgroundColor: theme.series,
        borderWidth: 2,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        tension: 0,
        spanGaps: false,
        // Only the latest point gets a marker: >= 8px with a 2px surface ring.
        pointRadius: (ctx) => (ctx.dataIndex === lastActual ? 4 : 0),
        pointHoverRadius: 5,
        pointBackgroundColor: theme.series,
        pointBorderColor: theme.surface,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2,
        order: 1,
      },
    ]
    if (series.pace) {
      datasets.push({
        label: 'Budget pace',
        data: series.pace,
        borderColor: theme.pace,
        backgroundColor: theme.pace,
        borderWidth: 2,
        // Dashed: a target, and a second cue besides hue where the lines cross.
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        order: 2,
      })
    }
    return { labels: series.days.map(formatShortDay), datasets }
  }, [series, theme, actualLabel, lastActual])

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { right: 104, top: 8 } },
      scales: {
        x: {
          grid: { display: false },
          border: { color: theme.axis },
          ticks: { color: theme.textMuted, maxRotation: 0, autoSkipPadding: 16 },
        },
        y: {
          beginAtZero: true,
          grid: { color: theme.grid },
          border: { display: false },
          ticks: {
            color: theme.textMuted,
            maxTicksLimit: 5,
            callback: (value) => formatCentsShort(Number(value)),
          },
        },
      },
      plugins: {
        tooltip: {
          ...tooltipStyle<'line'>(theme),
          callbacks: {
            title: (items) => (items[0] ? formatDay(series.days[items[0].dataIndex]) : ''),
            // Value first, series name second.
            label: (item) => `${formatCents(Number(item.raw))}  ${item.dataset.label}`,
            labelPointStyle: () => ({ pointStyle: 'line', rotation: 0 }),
          },
        },
      },
    }),
    [theme, series.days],
  )

  const plugins = useMemo(() => {
    const labels = []
    if (lastActual >= 0) {
      labels.push({ datasetIndex: 0, text: `${formatCentsShort(series.actual[lastActual] ?? 0)} spent` })
    }
    if (series.pace) {
      labels.push({ datasetIndex: 1, text: `${formatCentsShort(series.pace.at(-1) ?? 0)} budget` })
    }
    return [crosshairPlugin(theme.axis), lineEndLabelsPlugin(labels, theme.text, theme.surface)]
  }, [series, theme, lastActual])

  return <Line data={data} options={options} plugins={plugins} role="img" aria-label={ariaLabel} />
}
