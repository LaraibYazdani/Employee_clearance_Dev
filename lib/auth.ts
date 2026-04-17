import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-dev-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

/**
 * Signs a JWT token with the given payload.
 */
export function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

/**
 * Verifies and decodes a JWT token.
 * Throws an error if the token is invalid or expired.
 */
export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET)
}

/**
 * Hashes a plain-text password using bcrypt with salt rounds of 10.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Compares a plain-text password against a bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    sf_employee_id: string
    email: string
    full_name: string
    roles: string[]
  }
}

type RouteHandler = (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>

/**
 * Middleware wrapper for API routes that require authentication.
 * Reads the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded user to the request object.
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req: AuthenticatedRequest, context?: any): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
          { status: 401 }
        )
      }

      const token = authHeader.substring(7)

      let decoded: any
      try {
        decoded = verifyToken(token)
      } catch (err) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid or expired token' },
          { status: 401 }
        )
      }

      // Always fetch fresh roles from DB — JWT roles go stale when admin changes them
      let freshRoles: string[] = decoded.roles || []
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { roles: true },
        })
        if (dbUser) freshRoles = (dbUser.roles as string[]) || []
      } catch {
        // Non-critical — fall back to JWT roles if DB is unreachable
      }

      req.user = {
        id: decoded.id,
        sf_employee_id: decoded.sf_employee_id,
        email: decoded.email,
        full_name: decoded.full_name,
        roles: freshRoles,
      }

      return handler(req, context)
    } catch (error) {
      console.error('withAuth middleware error:', error)
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'An unexpected error occurred' },
        { status: 500 }
      )
    }
  }
}
