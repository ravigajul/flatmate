import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function PendingPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.isActive) redirect('/resident')

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        <div className="text-4xl mb-4">⏳</div>
        <h1 className="text-xl font-bold text-gray-900">Account Pending Approval</h1>
        <p className="text-gray-500 mt-3 text-sm leading-relaxed">
          Your account has been created. The President needs to assign you to a unit before you can
          access the app.
        </p>
        <p className="text-gray-400 mt-2 text-xs">
          Signed in as <span className="font-medium">{session.user.email}</span>
        </p>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="mt-6 text-sm text-red-500 hover:text-red-700 underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
