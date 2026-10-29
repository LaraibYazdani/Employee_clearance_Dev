import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const IAS_AUTHORIZE_URL = process.env.IAS_AUTHORIZE_URL!
const IAS_CLIENT_ID = process.env.IAS_CLIENT_ID!
const IAS_REDIRECT_URI = process.env.IAS_REDIRECT_URI!

export async function GET() {
  if (!IAS_AUTHORIZE_URL || !IAS_CLIENT_ID || !IAS_REDIRECT_URI) {
    return NextResponse.json({ error: 'IAS not configured' }, { status: 503 })
  }

  const state = randomBytes(20).toString('hex')
  const nonce = randomBytes(20).toString('hex')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: IAS_CLIENT_ID,
    redirect_uri: IAS_REDIRECT_URI,
    scope: 'openid profile email',
    state,
    nonce,
  })

  const authorizeUrl = new URL(IAS_AUTHORIZE_URL)
  authorizeUrl.search = params.toString()

  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append('Set-Cookie', `ias_state=${state}; HttpOnly; Max-Age=600; Path=/; SameSite=Lax`)
  headers.append('Set-Cookie', `ias_nonce=${nonce}; HttpOnly; Max-Age=600; Path=/; SameSite=Lax`)
  return new Response(JSON.stringify({ url: authorizeUrl.href }), { status: 200, headers })
}
