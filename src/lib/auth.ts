import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/db/client'
import { sessions, users } from '@/db/schema'
import { eq, gt, and } from 'drizzle-orm'

const SESSION_COOKIE = 'session_id'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30日

// 紛らわしい文字（0/O, 1/I等）を除いた一時パスワード用の文字セット
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateDefaultPassword(): string {
  let pw = ''
  for (let i = 0; i < 8; i++) pw += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]
  return pw
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const [session] = await db.insert(sessions).values({ userId, expiresAt }).returning()
  const store = await cookies()
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function destroySession() {
  const store = await cookies()
  const sessionId = store.get(SESSION_COOKIE)?.value
  if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId))
  store.delete(SESSION_COOKIE)
}

export async function getCurrentUser() {
  const store = await cookies()
  const sessionId = store.get(SESSION_COOKIE)?.value
  if (!sessionId) return null
  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
  return row?.user ?? null
}
