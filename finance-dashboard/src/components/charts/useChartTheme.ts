import { useEffect, useState } from 'react'

/** Chart colours, read from the CSS tokens in index.css so light/dark live in one place. */
export type ChartTheme = {
  series: string
  track: string
  critical: string
  pace: string
  grid: string
  axis: string
  text: string
  textMuted: string
  surface: string
}

function readTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return {
    series: token('--chart-series'),
    track: token('--chart-track'),
    critical: token('--chart-critical'),
    pace: token('--chart-pace'),
    grid: token('--chart-grid'),
    axis: token('--chart-axis'),
    // Charts sit on ink panels in both modes, so they use panel text colours.
    text: token('--chart-text'),
    textMuted: token('--chart-text-muted'),
    surface: token('--chart-surface'),
  }
}

/**
 * Canvas charts can't use CSS variables directly, so resolve them here and
 * re-resolve when the OS colour scheme flips (dark mode is its own selected
 * palette, not an automatic inversion).
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setTheme(readTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return theme
}
