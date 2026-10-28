import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

const IAS_TOKEN_URL = process.env.IAS_TOKEN_URL!
const IAS_ISSUER = process.env.IAS_ISSUER!
const IAS_CLIENT_ID = process.env.IAS_CLIENT_ID!
const IAS_CLIENT_SECRET = process.env.IAS_CLIENT_SECRET!
const IAS_REDIRECT_URI = process.env.IAS_REDIRECT_URI!

function decodeJwtPayload(jwt: string): Record<string, any> | null {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function loginRedirect(req: NextRequest, error: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?ias_error=${error}`, req.url))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (searchParams.get('error')) {
    return loginRedirect(req, 'ias_denied')
  }

  const expectedState = req.cookies.get('ias_state')?.value
  const expectedNonce = req.cookies.get('ias_nonce')?.value

  if (!expectedState || expectedState !== state || !code) {
    return loginRedirect(req, 'invalid_state')
  }

  // Exchange code for tokens
  let tokens: any
  try {
    const tokenRes = await fetch(IAS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${IAS_CLIENT_ID}:${IAS_CLIENT_SECRET}`).toString('base64'),
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: IAS_REDIRECT_URI,
      }),
    })
    if (!tokenRes.ok) {
      console.error('[IAS callback] token exchange failed:', tokenRes.status, await tokenRes.text())
      return loginRedirect(req, 'token_exchange_failed')
    }
    tokens = await tokenRes.json()
  } catch (err) {
    console.error('[IAS callback] token request error:', err)
    return loginRedirect(req, 'token_request_error')
  }

  if (!tokens?.id_token) {
    return loginRedirect(req, 'no_id_token')
  }

  // Decode and validate JWT claims
  const claims = decodeJwtPayload(tokens.id_token)
  if (!claims?.iss || !claims?.aud || !claims?.exp || !claims?.sub) {
    return loginRedirect(req, 'invalid_token_claims')
  }

  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  const now = Math.floor(Date.now() / 1000)

  if (
    claims.iss.replace(/\/$/, '') !== IAS_ISSUER.replace(/\/$/, '') ||
    !aud.includes(IAS_CLIENT_ID) ||
    claims.exp < now ||
    !claims.nonce ||
    claims.nonce !== expectedNonce
  ) {
    console.error('[IAS callback] token validation failed', {
      iss_match: claims.iss.replace(/\/$/, '') === IAS_ISSUER.replace(/\/$/, ''),
      aud_match: aud.includes(IAS_CLIENT_ID),
      expired: claims.exp < now,
      nonce_match: claims.nonce === expectedNonce,
    })
    return loginRedirect(req, 'token_validation_failed')
  }

  const employeeNumber = String(claims.employee_number ?? '')
  if (!employeeNumber) {
    return loginRedirect(req, 'no_employee_number')
  }

  // Look up user in DB
  const dbUser = await prisma.user.findFirst({
    where: { sf_employee_id: employeeNumber },
  })

  if (!dbUser) {
    console.warn('[IAS callback] no user found for employee_number:', employeeNumber)
    return loginRedirect(req, 'user_not_found')
  }

  const roles = Array.isArray(dbUser.roles) && (dbUser.roles as string[]).length > 0
    ? (dbUser.roles as string[])
    : ['EMPLOYEE']

  const portalToken = signToken({
    id: dbUser.id,
    sf_employee_id: dbUser.sf_employee_id,
    email: dbUser.email,
    full_name: dbUser.full_name,
    roles,
  })

  const response = NextResponse.redirect(new URL(`/login?ias_token=${portalToken}`, req.url))
  response.cookies.delete('ias_state')
  response.cookies.delete('ias_nonce')
  return response
}
