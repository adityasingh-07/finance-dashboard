import { useId, useState, type ReactNode } from 'react'

type Props = {
  title: string
  description?: ReactNode
  legend?: ReactNode
  /** The accessible twin of the chart: every value, no hovering required. */
  table: ReactNode
  /** Holding the previous month's render while the new one loads. */
  dimmed?: boolean
  children: ReactNode
}

export function ChartCard({ title, description, legend, table, dimmed = false, children }: Props) {
  const [showTable, setShowTable] = useState(false)
  const headingId = useId()

  return (
    <section className="card chart-card" aria-labelledby={headingId} aria-busy={dimmed || undefined}>
      <div className="chart-card-header">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p className="chart-description">{description}</p>}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          aria-pressed={showTable}
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      <div className={`chart-card-body${dimmed ? ' is-dimmed' : ''}`}>
        {showTable ? (
          <div className="table-wrap chart-table">{table}</div>
        ) : (
          <>
            {legend && <div className="chart-legend">{legend}</div>}
            {children}
          </>
        )}
      </div>
    </section>
  )
}

/** Legend entry whose key mirrors the mark: a line for lines, a rect for bars. */
export function LegendItem({
  label,
  color,
  shape,
}: {
  label: string
  color: string
  shape: 'line' | 'dashed' | 'rect'
}) {
  return (
    <span className="legend-item">
      <span className={`legend-key legend-key-${shape}`} style={{ color }} aria-hidden="true" />
      {label}
    </span>
  )
}

export function ChartSkeleton({ height }: { height: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />
}
