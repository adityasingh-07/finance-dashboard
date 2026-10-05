// Month-level budget arithmetic shared by the dashboard and budgets page.

export type CategorySpend = {
  spent_cents: number
  /** null when the category has no budget this month (0 is a real budget). */
  limit_cents: number | null
}

export type BudgetTotals = {
  /** All spending in the month, budgeted or not. */
  spentCents: number
  /** Sum of every category budget. */
  budgetCents: number
  /** Spending in categories that have a budget. */
  budgetedSpentCents: number
  /** Spending in categories without a budget. */
  unbudgetedSpentCents: number
  /**
   * Budget left: budgetCents - budgetedSpentCents. Negative means over.
   * Spending in unbudgeted categories doesn't count against it, since no
   * budget was set for it to exceed.
   */
  remainingCents: number
  hasBudgets: boolean
}

export function summarizeBudgets(rows: CategorySpend[]): BudgetTotals {
  let spentCents = 0
  let budgetCents = 0
  let budgetedSpentCents = 0
  let hasBudgets = false

  for (const row of rows) {
    spentCents += row.spent_cents
    if (row.limit_cents !== null) {
      hasBudgets = true
      budgetCents += row.limit_cents
      budgetedSpentCents += row.spent_cents
    }
  }

  return {
    spentCents,
    budgetCents,
    budgetedSpentCents,
    unbudgetedSpentCents: spentCents - budgetedSpentCents,
    remainingCents: budgetCents - budgetedSpentCents,
    hasBudgets,
  }
}
