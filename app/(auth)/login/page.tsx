import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LoginButton from './login-button'

export default async function LoginPage() {
  const session = await auth()

  if (session?.user?.isActive) {
    const role = session.user.role
    if (role === 'PRESIDENT' || role === 'SUPER_ADMIN') {
      redirect('/president')
    } else {
      redirect('/resident')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">FlatMate</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Sign in with your Gmail account to continue
          </p>
        </div>

        <LoginButton />

        <p className="mt-6 text-xs text-gray-400">
          Access is restricted to registered residents only.
          <br />
          Contact the President if you need access.
        </p>
      </div>
    </main>
  )
}
