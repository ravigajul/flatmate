'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Building2,
  Users,
  IndianRupee,
  Wrench,
  Receipt,
  Megaphone,
  FileBarChart2,
  LogOut,
  Home,
  CreditCard,
  ClipboardList,
  Menu,
  X,
} from 'lucide-react'
import type { Role } from '@prisma/client'
import { cn } from '@/lib/utils'

interface SidebarUser {
  name?: string | null
  email?: string | null
  image?: string | null
  role: Role
}

const presidentNav = [
  { href: '/president', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/president/units', label: 'Units', icon: Building2 },
  { href: '/president/users', label: 'Residents', icon: Users },
  { href: '/president/fees', label: 'Fee Schedules', icon: IndianRupee },
  { href: '/president/issues', label: 'Issues', icon: Wrench },
  { href: '/president/expenses', label: 'Expenses', icon: Receipt },
  { href: '/president/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/president/reports', label: 'Reports', icon: FileBarChart2 },
]

const residentNav = [
  { href: '/resident', label: 'Dashboard', icon: Home, exact: true },
  { href: '/resident/pay', label: 'Pay Fees', icon: CreditCard },
  { href: '/resident/issues', label: 'My Issues', icon: ClipboardList },
  { href: '/resident/announcements', label: 'Announcements', icon: Megaphone },
]

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isPresident = user.role === 'PRESIDENT' || user.role === 'SUPER_ADMIN'
  const nav = isPresident ? presidentNav : residentNav

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : user.email?.[0].toUpperCase() ?? '?'

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">FlatMate</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {isPresident ? 'Admin Panel' : 'Resident Portal'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'sidebar-link',
                active ? 'sidebar-link-active' : 'sidebar-link-inactive'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-slate-200 text-xs font-medium truncate">
              {user.name ?? user.email}
            </p>
            <p className="text-slate-500 text-xs truncate">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="sidebar-link sidebar-link-inactive w-full"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-lg"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'md:hidden fixed inset-y-0 left-0 w-64 bg-slate-900 z-40 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-slate-900 flex-col z-50">
        {sidebarContent}
      </aside>
    </>
  )
}
