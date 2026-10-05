export function CategoryLabel({ name, color }: { name: string; color: string }) {
  return (
    <span className="category-label">
      <span className="swatch" style={{ background: color }} aria-hidden="true" />
      {name}
    </span>
  )
}
