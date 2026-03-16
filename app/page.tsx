import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function Home() {
  const session = await auth()

  if (!session?.user) redirect('/login')
  if (!session.user.isActive) redirect('/pending')

  const role = session.user.role
  if (role === 'PRESIDENT' || role === 'SUPER_ADMIN') {
    redirect('/president')
  }
  redirect('/resident')
}
