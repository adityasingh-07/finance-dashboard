import type { ChartType, Plugin, TooltipOptions } from 'chart.js'
import type { ChartTheme } from './useChartTheme.ts'

const LABEL_FONT = "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Vertical hairline at the hovered x, drawn under the data. */
export function crosshairPlugin(color: string): Plugin<'line'> {
  return {
    id: 'crosshair',
    beforeDatasetsDraw(chart) {
      const active = chart.tooltip?.getActiveElements()
      if (!active?.length) return
      const { ctx, chartArea } = chart
      const x = active[0].element.x
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.stroke()
      ctx.restore()
    },
  }
}

export type EndLabel = { datasetIndex: number; text: string }

/**
 * Text beside the last drawn point of each listed line, in text colour (never
 * the series colour). Labels are in priority order: if a lower-priority label
 * would collide with one already drawn it is skipped rather than nudged away
 * from its line, and the legend carries it instead.
 */
export function lineEndLabelsPlugin(labels: EndLabel[], color: string, halo: string): Plugin<'line'> {
  return {
    id: 'lineEndLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      const drawn: { x: number; y: number }[] = []
      ctx.save()
      ctx.font = LABEL_FONT
      ctx.fillStyle = color
      ctx.strokeStyle = halo
      ctx.lineWidth = 4
      ctx.lineJoin = 'round'
      ctx.textBaseline = 'middle'
      for (const { datasetIndex, text } of labels) {
        const data = chart.data.datasets[datasetIndex]?.data ?? []
        let last = -1
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i] !== null && data[i] !== undefined) {
            last = i
            break
          }
        }
        if (last < 0) continue
        const point = chart.getDatasetMeta(datasetIndex).data[last]
        if (!point) continue
        const x = point.x + 8
        const y = point.y
        if (drawn.some((d) => Math.abs(d.y - y) < 16 && Math.abs(d.x - x) < 120)) continue
        // Surface-coloured halo keeps the text legible where it crosses a line.
        ctx.strokeText(text, x, y)
        ctx.fillText(text, x, y)
        drawn.push({ x, y })
      }
      ctx.restore()
    },
  }
}

/**
 * Value at the tip of each horizontal bar: placed just past whichever of the
 * listed datasets' bars ends furthest right, so it never sits inside a mark.
 */
export function barTipLabelsPlugin(
  texts: string[],
  datasetIndexes: number[],
  color: string,
): Plugin<'bar'> {
  return {
    id: 'barTipLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      ctx.save()
      ctx.font = LABEL_FONT
      ctx.fillStyle = color
      ctx.textBaseline = 'middle'
      texts.forEach((text, i) => {
        const bars = datasetIndexes
          .map((d) => chart.getDatasetMeta(d).data[i])
          .filter((b) => b !== undefined)
        if (bars.length === 0) return
        const x = Math.max(...bars.map((b) => b.x), chart.chartArea.left) + 6
        ctx.fillText(text, x, bars[0].y)
      })
      ctx.restore()
    },
  }
}

/** Width of the widest label in the chart label font (for reserving padding). */
export function measureLabels(texts: string[]): number {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return 0
  ctx.font = LABEL_FONT
  return Math.max(0, ...texts.map((t) => ctx.measureText(t).width))
}

/** Shared tooltip styling: surface-coloured card, text tokens, line/rect keys. */
export function tooltipStyle<T extends ChartType>(theme: ChartTheme): Partial<TooltipOptions<T>> {
  return {
    backgroundColor: theme.surface,
    titleColor: theme.text,
    bodyColor: theme.text,
    borderColor: theme.grid,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 6,
    usePointStyle: true,
    boxPadding: 6,
    titleFont: { weight: 'bold' },
  }
}

