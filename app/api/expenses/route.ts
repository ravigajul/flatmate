import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import type { ExpenseCategory } from '@prisma/client'

const expenseCategoryEnum = z.enum([
  'REPAIRS',
  'UTILITIES',
  'SALARIES',
  'CLEANING',
  'SECURITY',
  'AMC',
  'MISCELLANEOUS',
])

const createExpenseSchema = z.object({
  amount: z.number().positive(),
  category: expenseCategoryEnum,
  vendor: z.string().max(100).optional(),
  description: z.string().min(3).max(500),
  expenseDate: z.string().transform((s) => new Date(s)),
  receiptUrl: z.string().url().optional(),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') as ExpenseCategory | null
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}

  if (category) where.category = category

  if (from || to) {
    const dateFilter: Record<string, Date> = {}
    if (from) {
      const fromDate = new Date(from)
      if (!isNaN(fromDate.getTime())) dateFilter.gte = fromDate
    }
    if (to) {
      const toDate = new Date(to)
      if (!isNaN(toDate.getTime())) dateFilter.lte = toDate
    }
    if (Object.keys(dateFilter).length > 0) {
      where.expenseDate = dateFilter
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      addedBy: { select: { name: true } },
    },
    orderBy: { expenseDate: 'desc' },
  })

  return NextResponse.json(expenses)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const expense = await prisma.expense.create({
    data: {
      amount: parsed.data.amount,
      category: parsed.data.category as ExpenseCategory,
      vendor: parsed.data.vendor,
      description: parsed.data.description,
      expenseDate: parsed.data.expenseDate,
      receiptUrl: parsed.data.receiptUrl,
      addedById: session.user.id,
    },
    include: {
      addedBy: { select: { name: true } },
    },
  })

  await writeAuditLog({
    userId: session.user.id,
    action: 'EXPENSE_CREATED',
    entity: 'Expense',
    entityId: expense.id,
    metadata: { amount: expense.amount, category: expense.category },
  })

  return NextResponse.json(expense, { status: 201 })
}
