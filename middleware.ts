import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'waza_auth'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const cookie = req.cookies.get(COOKIE)?.value
  const secret = process.env.WAZA_SESSION_SECRET
  const authed = !!secret && cookie === secret

  // /api/waza/* → 未認証なら 401
  if (pathname.startsWith('/api/waza/')) {
    if (!authed) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // UI ページ（/login 以外）→ 未認証ならログインへリダイレクト
  if (!pathname.startsWith('/login') && !pathname.startsWith('/api/')) {
    if (!authed) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
