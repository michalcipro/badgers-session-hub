import { NextResponse, type NextRequest } from 'next/server'
import { signedMessageFileUrl } from '@/app/hub-actions'

export const dynamic = 'force-dynamic'

/**
 * The attachment on one message. Who may have it is decided by who may
 * read the message, which the database already settles — so this route
 * asks for the row as the signed-in person and 404s if it does not come
 * back.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = await signedMessageFileUrl(id)
  if (!url) return new NextResponse('Not found', { status: 404 })
  return NextResponse.redirect(url)
}
