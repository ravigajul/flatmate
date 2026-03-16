import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    paymentAggregate,
    expenseAggregate,
    expensesByCategory,
    allIssues,
    recentExpenses,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCESS' },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
    }),
    prisma.issue.findMany({
      select: {
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
    prisma.expense.findMany({
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        expenseDate: true,
      },
      orderBy: { expenseDate: 'desc' },
      take: 5,
    }),
  ])

  const totalCollected = paymentAggregate._sum.amount ?? 0
  const totalExpenses = expenseAggregate._sum.amount ?? 0
  const balance = totalCollected - totalExpenses

  // Build expensesByCategory map
  const expensesByCategoryMap: Record<string, number> = {}
  for (const row of expensesByCategory) {
    expensesByCategoryMap[row.category] = row._sum.amount ?? 0
  }

  // Issue stats
  const open = allIssues.filter((i) => i.status === 'OPEN').length
  const resolved = allIssues.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  ).length
  const total = allIssues.length

  const resolvedIssues = allIssues.filter(
    (i) => (i.status === 'RESOLVED' || i.status === 'CLOSED') && i.resolvedAt
  )
  let avgResolutionDays = 0
  if (resolvedIssues.length > 0) {
    const totalDays = resolvedIssues.reduce((sum, i) => {
      const days =
        (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
      return sum + days
    }, 0)
    avgResolutionDays = Math.round((totalDays / resolvedIssues.length) * 10) / 10
  }

  return NextResponse.json({
    totalCollected,
    totalExpenses,
    balance,
    expensesByCategory: expensesByCategoryMap,
    issueStats: { open, resolved, total, avgResolutionDays },
    recentExpenses,
  })
}
