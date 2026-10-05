import { useState, type FormEvent } from 'react'
import { CategoryLabel } from '../components/CategoryLabel.tsx'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type Category,
} from '../hooks/useCategories.ts'
import { friendlyError } from '../lib/dbErrors.ts'

const PALETTE = ['#16A34A', '#EA580C', '#2563EB', '#0891B2', '#CA8A04', '#DB2777', '#7C3AED', '#DC2626', '#4F46E5', '#0D9488']

const NAME_ERRORS = { '23505': 'You already have a category with that name.' }

function nextColor(categories: Category[]): string {
  const used = new Set(categories.map((c) => c.color.toUpperCase()))
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[categories.length % PALETTE.length]
}

export function CategoriesPage() {
  const categories = useCategories()

  return (
    <>
      <div className="page-header">
        <h1>Categories</h1>
      </div>

      <section className="card" aria-labelledby="add-category-heading">
        <h2 id="add-category-heading" className="card-header">
          Add a category
        </h2>
        {categories.data && <AddCategoryForm categories={categories.data} />}
      </section>

      <section className="card" aria-labelledby="category-list-heading">
        <div className="card-header">
          <h2 id="category-list-heading">Your categories</h2>
        </div>
        {categories.isPending ? (
          <p className="muted" role="status">
            Loading categories…
          </p>
        ) : categories.isError ? (
          <p className="form-error" role="alert">
            {friendlyError(categories.error)}
          </p>
        ) : categories.data.length === 0 ? (
          <div className="empty-state">
            <strong>No categories yet</strong>
            Add one above to start tracking expenses.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.data.map((category) => (
                  <CategoryRow key={category.id} category={category} others={categories.data} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function AddCategoryForm({ categories }: { categories: Category[] }) {
  const createCategory = useCreateCategory()
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextColor(categories))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || createCategory.isPending) return
    createCategory.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          setName('')
          setColor(nextColor([...categories, { color } as Category]))
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="form-row">
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span>Name</span>
          <input
            type="text"
            maxLength={40}
            required
            placeholder="e.g. Pets"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Colour</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={createCategory.isPending || !name.trim()}
        >
          {createCategory.isPending ? 'Adding…' : 'Add category'}
        </button>
      </div>
      {createCategory.isError && (
        <p className="form-error" role="alert">
          {friendlyError(createCategory.error, NAME_ERRORS)}
        </p>
      )}
    </form>
  )
}

type RowMode = 'view' | 'edit' | 'confirm-delete' | 'reassign'

function CategoryRow({ category, others }: { category: Category; others: Category[] }) {
  const [mode, setMode] = useState<RowMode>('view')

  if (mode === 'edit') {
    return <EditCategoryRow category={category} onDone={() => setMode('view')} />
  }

  return (
    <tr>
      <td>
        <CategoryLabel name={category.name} color={category.color} />
      </td>
      <td className="actions">
        {mode === 'view' ? (
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMode('edit')}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost btn-danger"
              onClick={() => setMode('confirm-delete')}
            >
              Delete
            </button>
          </>
        ) : (
          <DeleteCategoryControls
            category={category}
            others={others.filter((c) => c.id !== category.id)}
            mode={mode}
            onNeedsReassign={() => setMode('reassign')}
            onCancel={() => setMode('view')}
          />
        )}
      </td>
    </tr>
  )
}

function DeleteCategoryControls({
  category,
  others,
  mode,
  onNeedsReassign,
  onCancel,
}: {
  category: Category
  others: Category[]
  mode: 'confirm-delete' | 'reassign'
  onNeedsReassign: () => void
  onCancel: () => void
}) {
  const deleteCategory = useDeleteCategory()
  const [chosenTarget, setChosenTarget] = useState<string | null>(null)
  // Derived, so a refetched list can't leave the select showing one category
  // while the stale id of a deleted one is submitted.
  const reassignTo = others.some((c) => c.id === chosenTarget) ? chosenTarget! : (others[0]?.id ?? '')

  function deletePlain() {
    deleteCategory.mutate(
      { id: category.id },
      {
        onError: (err) => {
          // Still has expenses: ask where to move them instead of failing.
          if ((err as { code?: string }).code === '23503') {
            deleteCategory.reset()
            onNeedsReassign()
          }
        },
      },
    )
  }

  const error = deleteCategory.isError ? friendlyError(deleteCategory.error) : null

  if (mode === 'confirm-delete') {
    return (
      <span className="inline-confirm">
        <span className="muted">Delete “{category.name}” and its budgets?</span>
        {error && <span className="field-error">{error}</span>}
        <button
          type="button"
          className="btn btn-sm btn-danger-solid"
          disabled={deleteCategory.isPending}
          onClick={deletePlain}
        >
          {deleteCategory.isPending ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </span>
    )
  }

  if (others.length === 0) {
    return (
      <span className="inline-confirm">
        <span className="field-error">
          “{category.name}” has expenses. Create another category to move them to first.
        </span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
          OK
        </button>
      </span>
    )
  }

  return (
    <span className="inline-confirm">
      <label className="muted" htmlFor={`reassign-${category.id}`}>
        “{category.name}” has expenses. Move them to
      </label>
      <select
        id={`reassign-${category.id}`}
        value={reassignTo}
        onChange={(e) => setChosenTarget(e.target.value)}
        style={{ width: 'auto' }}
      >
        {others.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
      <button
        type="button"
        className="btn btn-sm btn-danger-solid"
        disabled={deleteCategory.isPending}
        onClick={() => deleteCategory.mutate({ id: category.id, reassignTo })}
      >
        {deleteCategory.isPending ? 'Moving…' : 'Move & delete'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </span>
  )
}

function EditCategoryRow({ category, onDone }: { category: Category; onDone: () => void }) {
  const updateCategory = useUpdateCategory()
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)

  function save() {
    if (!name.trim() || updateCategory.isPending) return
    updateCategory.mutate({ id: category.id, name: name.trim(), color }, { onSuccess: onDone })
  }

  return (
    <tr
      className="row-editing"
      onKeyDown={(e) => {
        // Enter on Save/Cancel activates that button; saving here as well would
        // save on Cancel, or send the update twice on Save.
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') save()
        if (e.key === 'Escape') onDone()
      }}
    >
      <td>
        <div className="form-row" style={{ alignItems: 'center' }}>
          <input
            type="color"
            aria-label="Colour"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <input
            type="text"
            aria-label="Name"
            maxLength={40}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
        </div>
      </td>
      <td className="actions">
        <span className="inline-confirm">
          {updateCategory.isError && (
            <span className="field-error">{friendlyError(updateCategory.error, NAME_ERRORS)}</span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={updateCategory.isPending || !name.trim()}
            onClick={save}
          >
            {updateCategory.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onDone}>
            Cancel
          </button>
        </span>
      </td>
    </tr>
  )
}
