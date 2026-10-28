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

  const response = NextResponse.redirect(`${IAS_AUTHORIZE_URL}?${params}`)
  response.cookies.set('ias_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' })
  response.cookies.set('ias_nonce', nonce, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' })
  return response
}
