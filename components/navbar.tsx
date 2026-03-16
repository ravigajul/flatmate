'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import type { Role } from '@prisma/client'

interface NavUser {
  name?: string | null
  email?: string | null
  role: Role
  isActive: boolean
}

const presidentLinks = [
  { href: '/president', label: 'Dashboard' },
  { href: '/president/units', label: 'Units' },
  { href: '/president/users', label: 'Residents' },
  { href: '/president/fees', label: 'Fees' },
  { href: '/president/issues', label: 'Issues' },
  { href: '/president/expenses', label: 'Expenses' },
  { href: '/president/announcements', label: 'Announcements' },
]

const residentLinks = [
  { href: '/resident', label: 'Dashboard' },
  { href: '/resident/pay', label: 'Pay Fees' },
  { href: '/resident/issues', label: 'My Issues' },
  { href: '/resident/announcements', label: 'Announcements' },
]

export default function Navbar({ user }: { user: NavUser }) {
  const isPresident = user.role === 'PRESIDENT' || user.role === 'SUPER_ADMIN'
  const links = isPresident ? presidentLinks : residentLinks

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href={isPresident ? '/president' : '/resident'} className="font-bold text-gray-900 text-sm">
              FlatMate
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
