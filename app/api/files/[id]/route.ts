import { NextResponse, type NextRequest } from 'next/server'
import { signedFileUrl } from '@/app/hub-actions'

export const dynamic = 'force-dynamic'

/** Redirects to a short-lived signed URL, or 404s if this person may not have it. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = await signedFileUrl(id)
  if (!url) return new NextResponse('Not found', { status: 404 })
  return NextResponse.redirect(url)
}
