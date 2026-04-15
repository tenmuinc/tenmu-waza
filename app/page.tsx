import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">tenmu inc.</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">わざマシン</h1>
        <div className="grid gap-3">
          <Link
            href="/waza/content-proposal"
            className="group flex items-start gap-4 bg-white rounded-2xl p-5 border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all"
          >
            <span className="text-3xl">✨</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">SNS事業</p>
              <p className="font-bold text-gray-900 text-sm mb-1">過去レポート参照 コンテンツ提案</p>
              <p className="text-xs text-gray-500 leading-relaxed">過去レポートと前回コンテンツをもとに、次回の投稿をAIが根拠つきで提案する</p>
            </div>
            <span className="text-gray-300 group-hover:text-gray-600 transition-colors mt-1">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
