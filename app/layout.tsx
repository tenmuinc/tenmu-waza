import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'わざマシン | tenmu inc.',
  description: '業務効率化ツール集',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  )
}
