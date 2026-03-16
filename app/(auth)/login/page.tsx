import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LoginButton from './login-button'
import { Building2 } from 'lucide-react'

export default async function LoginPage() {
  const session = await auth()

  if (session?.user?.isActive) {
    const role = session.user.role
    if (role === 'PRESIDENT' || role === 'SUPER_ADMIN') redirect('/president')
    else redirect('/resident')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">FlatMate</h1>
            <p className="text-slate-400 text-sm mt-1">Apartment Management Portal</p>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 mb-6" />

          <p className="text-center text-slate-300 text-sm mb-5">
            Sign in with your Gmail account to continue
          </p>

          <LoginButton />

          <p className="text-center text-slate-500 text-xs mt-6 leading-relaxed">
            Access is restricted to registered residents only.
            <br />
            Contact the President if you need access.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          Secure · Private · Made for your community
        </p>
      </div>
    </main>
  )
}
