import { auth } from '@/lib/auth'
import { supabaseAdmin, ISSUE_PHOTOS_BUCKET } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP and HEIC images are allowed' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${session.user.id}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabaseAdmin.storage
    .from(ISSUE_PHOTOS_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) {
    console.error('Supabase upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data } = supabaseAdmin.storage
    .from(ISSUE_PHOTOS_BUCKET)
    .getPublicUrl(path)

  return NextResponse.json({ url: data.publicUrl }, { status: 201 })
}
