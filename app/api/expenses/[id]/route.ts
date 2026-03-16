import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import type { ExpenseCategory } from '@prisma/client'

const updateExpenseSchema = z.object({
  amount: z.number().positive().optional(),
  category: z
    .enum(['REPAIRS', 'UTILITIES', 'SALARIES', 'CLEANING', 'SECURITY', 'AMC', 'MISCELLANEOUS'])
    .optional(),
  vendor: z.string().max(100).optional(),
  description: z.string().min(3).max(500).optional(),
  expenseDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  receiptUrl: z.string().url().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const existing = await prisma.expense.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  const body = await request.json()
  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
      ...(parsed.data.category !== undefined && {
        category: parsed.data.category as ExpenseCategory,
      }),
      ...(parsed.data.vendor !== undefined && { vendor: parsed.data.vendor }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.expenseDate !== undefined && { expenseDate: parsed.data.expenseDate }),
      ...(parsed.data.receiptUrl !== undefined && { receiptUrl: parsed.data.receiptUrl }),
    },
    include: {
      addedBy: { select: { name: true } },
    },
  })

  await writeAuditLog({
    userId: session.user.id,
    action: 'EXPENSE_UPDATED',
    entity: 'Expense',
    entityId: id,
    metadata: { changes: parsed.data },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const existing = await prisma.expense.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  await prisma.expense.delete({ where: { id } })

  await writeAuditLog({
    userId: session.user.id,
    action: 'EXPENSE_DELETED',
    entity: 'Expense',
    entityId: id,
    metadata: { amount: existing.amount, category: existing.category },
  })

  return NextResponse.json({ success: true })
}
