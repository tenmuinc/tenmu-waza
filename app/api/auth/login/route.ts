import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!password || password !== process.env.WAZA_PASSWORD) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  const secret = process.env.WAZA_SESSION_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('waza_auth', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90, // 90日
    path: '/',
  })
  return res
}
