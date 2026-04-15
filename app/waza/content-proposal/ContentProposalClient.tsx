'use client'

import { useEffect, useRef, useState } from 'react'

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface NotionClient {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  url: string
  description: string
  category: string
}

interface PreFilledRow {
  no: number
  type: 'フィード' | 'リール'
  product: string
  productUrl: string
  productDesc: string
  rowNote: string   // 行ごとの注意点
}

interface Proposal {
  no: number
  type: 'フィード' | 'リール'
  category: string
  product: string
  theme: string
  point: string
  memo: string
  reason: string
}

interface ProposeResponse {
  proposals: Proposal[]
  overview: string
}

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const STEPS = [
  { label: 'クライアント' },
  { label: '対象月・投稿数' },
  { label: 'レポート・前回' },
  { label: '商品指定' },
  { label: '提案確認' },
] as const

type Step = 0 | 1 | 2 | 3 | 4

// ─── メインコンポーネント ──────────────────────────────────────────────────────

export default function ContentProposalClient() {
  const [step, setStep] = useState<Step>(0)

  // ── step 0: クライアント選択
  const [clients, setClients] = useState<NotionClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientsError, setClientsError] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedClientName, setSelectedClientName] = useState('')

  // ── step 1: 対象月・投稿数
  const currentYear = new Date().getFullYear()
  const [targetYear, setTargetYear] = useState(currentYear)
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [postsPerMonth, setPostsPerMonth] = useState(4)
  const [feedPerMonth, setFeedPerMonth] = useState(3)
  const [reelPerMonth, setReelPerMonth] = useState(1)

  // ── step 2: レポート・前回コンテンツ
  const [reportFiles, setReportFiles] = useState<File[]>([])
  const [previousContent, setPreviousContent] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── step 3: 商品指定
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [preFilledRows, setPreFilledRows] = useState<PreFilledRow[]>([])
  const [globalNote, setGlobalNote] = useState('')

  // ── step 4: 提案
  const [proposing, setProposing] = useState(false)
  const [result, setResult] = useState<ProposeResponse | null>(null)
  const [proposeError, setProposeError] = useState('')
  const [editingCell, setEditingCell] = useState<{ row: number; col: keyof Proposal } | null>(null)
  const [approvedNos, setApprovedNos] = useState<Set<number>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Notionクライアント取得
  useEffect(() => {
    setClientsLoading(true)
    fetch('/api/waza/notion-clients')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setClientsError(data.error)
        else setClients(data.clients ?? [])
      })
      .catch((e: unknown) => setClientsError('通信エラー: ' + String(e)))
      .finally(() => setClientsLoading(false))
  }, [])

  // Step 3に入ったとき商品を取得 & 空テーブルを初期化
  useEffect(() => {
    if (step !== 3) return
    setProductsLoading(true)
    fetch(`/api/waza/products?clientId=${selectedClientId}`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))

    // preFilledRows を投稿数に合わせて初期化
    const rows: PreFilledRow[] = []
    let feedLeft = totalFeed
    let reelLeft = totalReel
    for (let i = 1; i <= totalPosts; i++) {
      const type: 'フィード' | 'リール' = feedLeft > 0 ? 'フィード' : 'リール'
      if (feedLeft > 0) feedLeft--; else reelLeft--
      rows.push({ no: i, type, product: '', productUrl: '', productDesc: '', rowNote: '' })
    }
    setPreFilledRows(rows)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── 計算値
  const totalPosts = postsPerMonth * selectedMonths.length
  const totalFeed  = feedPerMonth  * selectedMonths.length
  const totalReel  = reelPerMonth  * selectedMonths.length

  // ── イベントハンドラ

  const toggleMonth = (label: string) => {
    const monthIdx = MONTHS.indexOf(label) + 1
    const key = `${targetYear}-${String(monthIdx).padStart(2, '0')}`
    setSelectedMonths((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    )
  }

  const isMonthSelected = (label: string) => {
    const monthIdx = MONTHS.indexOf(label) + 1
    return selectedMonths.includes(`${targetYear}-${String(monthIdx).padStart(2, '0')}`)
  }

  const syncTotal = (feed: number, reel: number) => {
    setFeedPerMonth(feed)
    setReelPerMonth(reel)
    setPostsPerMonth(feed + reel)
  }

  const addFiles = (files: File[]) => {
    const pdfs = files.filter((f) => f.type === 'application/pdf')
    setReportFiles((prev) => [...prev, ...pdfs])
  }

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const removeFile = (idx: number) => setReportFiles((prev) => prev.filter((_, i) => i !== idx))

  const setRowProduct = (no: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    setPreFilledRows((prev) =>
      prev.map((r) =>
        r.no === no
          ? {
              ...r,
              product: product?.name ?? '',
              productUrl: product?.url ?? '',
              productDesc: product?.description ?? '',
            }
          : r
      )
    )
  }

  const setRowNote = (no: number, note: string) => {
    setPreFilledRows((prev) =>
      prev.map((r) => r.no === no ? { ...r, rowNote: note } : r)
    )
  }

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handlePropose = async (keepApproved = false) => {
    setProposing(true)
    setProposeError('')
    if (!keepApproved) {
      setResult(null)
      setApprovedNos(new Set())
    }
    try {
      const reportBase64List = await Promise.all(
        reportFiles.map(async (f) => ({ name: f.name, base64: await readFileAsBase64(f) }))
      )
      const approvedRows = keepApproved && result
        ? result.proposals.filter((p) => approvedNos.has(p.no))
        : []

      const res = await fetch('/api/waza/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: selectedClientName,
          targetMonths: selectedMonths,
          totalPosts,
          feedCount: totalFeed,
          reelCount: totalReel,
          previousContent,
          reportBase64List,
          preFilledRows,
          approvedRows,
          globalNote,
        }),
      })
      const data: ProposeResponse & { error?: string } = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? '提案生成に失敗しました')
      setResult(data)
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : '提案生成に失敗しました')
    } finally {
      setProposing(false)
    }
  }

  const toggleApproved = (no: number) => {
    setApprovedNos((prev) => {
      const next = new Set(prev)
      next.has(no) ? next.delete(no) : next.add(no)
      return next
    })
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const formatProposal = (p: Proposal) =>
    [
      `【No.${p.no} / ${p.type === 'リール' ? 'REEL' : 'FEED'}】`,
      `カテゴリー: ${p.category}`,
      `撮影商品: ${p.product}`,
      `訴求テーマ: ${p.theme}`,
      `ポイント: ${p.point}`,
      `メモ: ${p.memo}`,
    ].join('\n')

  const updateCell = (rowIdx: number, col: keyof Proposal, value: string) => {
    if (!result) return
    setResult({
      ...result,
      proposals: result.proposals.map((p, i) =>
        i === rowIdx ? { ...p, [col]: value } : p
      ),
    })
  }

  const exportCsv = () => {
    if (!result) return
    const headers = ['No', '種別', 'カテゴリー', '撮影商品', '訴求テーマ', 'ポイント', 'メモ', '根拠']
    const rows = result.proposals.map((p) => [
      p.no, p.type, p.category, p.product, p.theme, p.point, p.memo, p.reason,
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${selectedClientName}_コンテンツ提案_${selectedMonths.sort().join('-')}.csv`
    a.click()
  }

  // ── Stepインジケーター

  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-10">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <button
            onClick={() => i < step ? setStep(i as Step) : undefined}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              i === step ? 'bg-gray-900 text-white shadow-sm' :
              i < step ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer' :
              'bg-gray-100 text-gray-400 cursor-default',
            ].join(' ')}
          >
            <span className={[
              'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
              i === step ? 'bg-white text-gray-900' :
              i < step ? 'bg-gray-500 text-white' : 'bg-gray-300 text-gray-400',
            ].join(' ')}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
          {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-200" />}
        </div>
      ))}
    </div>
  )

  const Counter = ({
    value, min = 0, onChange,
  }: { value: number; min?: number; onChange: (n: number) => void }) => (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors font-bold">−</button>
      <span className="w-8 text-center font-bold text-sm tabular-nums">{value}</span>
      <button onClick={() => onChange(value + 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors font-bold">+</button>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // Step 0: クライアント選択
  // ────────────────────────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="max-w-md">
      <h2 className="text-base font-bold text-gray-900 mb-1">クライアントを選択</h2>
      <p className="text-xs text-gray-400 mb-6">Notionのクライアントデータベースから選んでください</p>

      {clientsLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <span className="inline-block w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          読み込み中...
        </div>
      )}

      {clientsError && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 mb-4">
          <p className="text-xs font-semibold text-red-600 mb-1">エラー</p>
          <p className="text-xs text-red-700">{clientsError}</p>
        </div>
      )}

      {!clientsLoading && !clientsError && clients.length === 0 && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-4 text-xs text-yellow-800">
          クライアントが見つかりません。Notionインテグレーションの接続を確認してください。
        </div>
      )}

      {clients.length > 0 && (
        <select
          value={selectedClientId}
          onChange={(e) => {
            const id = e.target.value
            const c = clients.find((c) => c.id === id)
            setSelectedClientId(id)
            setSelectedClientName(c?.name ?? '')
          }}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 appearance-none cursor-pointer"
        >
          <option value="">-- クライアントを選択 --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <div className="mt-8 flex justify-end">
        <button
          disabled={!selectedClientId}
          onClick={() => setStep(1)}
          className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
        >
          次へ →
        </button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // Step 1: 対象月・投稿数
  // ────────────────────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="max-w-lg">
      <h2 className="text-base font-bold text-gray-900 mb-1">コンテンツを考える月を教えてください</h2>
      <p className="text-xs text-gray-400 mb-6">対象月と月あたりの投稿数を設定してください</p>

      <div className="mb-5">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">対象年</label>
        <Counter value={targetYear} min={2020} onChange={setTargetYear} />
      </div>

      <div className="mb-6">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">対象月（複数選択可）</label>
        <div className="grid grid-cols-6 gap-1.5">
          {MONTHS.map((m) => {
            const active = isMonthSelected(m)
            return (
              <button key={m} onClick={() => toggleMonth(m)}
                className={['py-2 rounded-lg text-xs font-semibold border transition-all',
                  active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
                ].join(' ')}
              >{m}</button>
            )
          })}
        </div>
        {selectedMonths.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            選択中: {selectedMonths.sort().map((m) => { const [y, mo] = m.split('-'); return `${y}年${parseInt(mo)}月` }).join('・')}
          </p>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-2">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">月あたりの投稿数</label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-2">フィード</p>
            <Counter value={feedPerMonth} onChange={(v) => syncTotal(v, reelPerMonth)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">リール</p>
            <Counter value={reelPerMonth} onChange={(v) => syncTotal(feedPerMonth, v)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">月合計</p>
            <p className="text-sm font-bold text-gray-900 h-8 flex items-center">{postsPerMonth} 件</p>
          </div>
        </div>
        {selectedMonths.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-500">{selectedMonths.length}ヶ月 × {postsPerMonth}件/月</p>
            <p className="text-sm font-bold text-gray-900">
              提案合計: {totalPosts}件
              <span className="text-xs font-normal text-gray-400 ml-2">（フィード{totalFeed} + リール{totalReel}）</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <button onClick={() => setStep(0)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← 戻る</button>
        <button disabled={selectedMonths.length === 0} onClick={() => setStep(2)}
          className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
        >次へ →</button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // Step 2: レポート & 前回コンテンツ
  // ────────────────────────────────────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="max-w-2xl">
      <h2 className="text-base font-bold text-gray-900 mb-1">レポートと前回コンテンツ</h2>
      <p className="text-xs text-gray-400 mb-6">過去3ヶ月分のレポートPDFをアップロードし、前回コンテンツを貼り付けてください</p>

      <div className="mb-6">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          過去レポートPDF <span className="text-gray-300 font-normal normal-case tracking-normal">（任意・複数可）</span>
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          className={['w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            isDragging ? 'border-gray-900 bg-gray-900/5 scale-[1.01]' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
          ].join(' ')}
        >
          <div className="text-3xl mb-2">{isDragging ? '⬇' : '📄'}</div>
          <p className="text-sm font-medium text-gray-600">{isDragging ? 'ここにドロップ' : 'クリックまたはドラッグ＆ドロップでPDFを追加'}</p>
          <p className="text-xs text-gray-400 mt-1">過去3ヶ月分のレポートをまとめて追加できます</p>
        </div>
        <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onFilesChange} />
        {reportFiles.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {reportFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-gray-400">PDF</span>
                <span className="flex-1 text-xs text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => removeFile(i)} className="text-gray-300 hover:text-red-400 transition-colors text-xs shrink-0 ml-1">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          前回のコンテンツ一覧 <span className="text-gray-300 font-normal normal-case tracking-normal">（テキストで貼り付け）</span>
        </label>
        <textarea
          value={previousContent}
          onChange={(e) => setPreviousContent(e.target.value)}
          placeholder={`例:\n1. フィード / 新商品紹介 / バニララテ / 春の新フレーバー\n2. リール / レシピ動画 / 抹茶スイーツ / 作り方を短く紹介`}
          rows={10}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-800 resize-y font-mono leading-relaxed"
        />
      </div>

      <div className="flex justify-between">
        <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← 戻る</button>
        <button onClick={() => setStep(3)} className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors">次へ →</button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // Step 3: 商品指定
  // ────────────────────────────────────────────────────────────────────────────

  const renderStep3 = () => (
    <div className="max-w-3xl">
      <h2 className="text-base font-bold text-gray-900 mb-1">商品に指定があれば埋めてください</h2>
      <p className="text-xs text-gray-400 mb-6">
        空欄の行はClaudeが自由に提案します。指定した行はその商品を元にコンテンツを提案します。
      </p>

      {/* 全体の注意点 */}
      <div className="mb-6">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          今回の注意点はあるか？ <span className="text-gray-300 font-normal normal-case tracking-normal">（任意・自由記述）</span>
        </label>
        <textarea
          value={globalNote}
          onChange={(e) => setGlobalNote(e.target.value)}
          placeholder="例: 新商品ラインナップ追加のため、新商品は必ず1本は入れること。夏フェア期間中のため夏感を出す。etc."
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-800 resize-y"
        />
      </div>

      {productsLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <span className="inline-block w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          商品を読み込み中...
        </div>
      ) : (
        <>
          {products.length === 0 && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 mb-4 text-xs text-yellow-800">
              このクライアントの商品がNotionに登録されていません。全行Claudeが提案します。
            </div>
          )}

          <div className="flex flex-col gap-6 mb-6">
            {selectedMonths.sort().map((monthKey, monthIdx) => {
              const [y, mo] = monthKey.split('-')
              const label = `${y}年${parseInt(mo)}月`
              const monthRows = preFilledRows.slice(monthIdx * postsPerMonth, (monthIdx + 1) * postsPerMonth)
              const specifiedCount = monthRows.filter((r) => r.product).length

              return (
                <div key={monthKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                    {specifiedCount > 0 && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {specifiedCount}件指定済み
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="w-10 px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">No</th>
                          <th className="w-16 px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">種別</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            撮影商品
                            <span className="ml-2 text-gray-300 font-normal normal-case tracking-normal">空欄 = Claudeが提案</span>
                          </th>
                          <th className="min-w-[160px] px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">注意点</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthRows.map((row, i) => (
                          <tr key={row.no} className={`border-b border-gray-100 last:border-0 ${row.product ? 'bg-gray-900/[0.02]' : i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                            <td className="px-3 py-2 text-gray-400 font-mono">{row.no}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={[
                                'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap',
                                row.type === 'リール' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700',
                              ].join(' ')}>
                                {row.type === 'リール' ? 'REEL' : 'FEED'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <select
                                  value={products.find((p) => p.name === row.product)?.id ?? ''}
                                  onChange={(e) => setRowProduct(row.no, e.target.value)}
                                  className={[
                                    'w-full max-w-xs px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-gray-800 appearance-none cursor-pointer transition-colors',
                                    row.product
                                      ? 'border-gray-900 bg-gray-900 text-white'
                                      : 'border-gray-200 bg-white text-gray-500',
                                  ].join(' ')}
                                >
                                  <option value="">空欄（Claudeに任せる）</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}{p.category ? ` — ${p.category}` : ''}</option>
                                  ))}
                                </select>
                                {row.product && row.productUrl && (
                                  <a href={row.productUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-600 text-[10px] underline whitespace-nowrap transition-colors">
                                    リンク
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.rowNote}
                                onChange={(e) => setRowNote(row.no, e.target.value)}
                                placeholder="この投稿の注意点（任意）"
                                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-800"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="flex justify-between">
        <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← 戻る</button>
        <button
          onClick={() => { setStep(4); handlePropose() }}
          className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          提案を生成する
        </button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // Step 4: 提案確認
  // ────────────────────────────────────────────────────────────────────────────

  const TABLE_COLS: { key: keyof Proposal; label: string; minW: string }[] = [
    { key: 'no',       label: 'No',          minW: 'min-w-[36px]'  },
    { key: 'type',     label: '種別',        minW: 'min-w-[60px]'  },
    { key: 'category', label: 'カテゴリー',  minW: 'min-w-[90px]'  },
    { key: 'product',  label: '撮影商品',    minW: 'min-w-[110px]' },
    { key: 'theme',    label: '訴求テーマ',  minW: 'min-w-[130px]' },
    { key: 'point',    label: 'ポイント',    minW: 'min-w-[200px]' },
    { key: 'memo',     label: 'メモ',        minW: 'min-w-[120px]' },
  ]

  const monthGroups = result
    ? selectedMonths.sort().map((monthKey, idx) => {
        const [y, mo] = monthKey.split('-')
        const label = `${y}年${parseInt(mo)}月`
        const proposals = result.proposals.slice(idx * postsPerMonth, (idx + 1) * postsPerMonth)
        return { monthKey, label, proposals }
      })
    : []

  const unapprovedCount = result
    ? result.proposals.filter((p) => !approvedNos.has(p.no)).length
    : 0

  const ProposalRow = ({ p, rowIdx }: { p: Proposal; rowIdx: number }) => {
    const approved = approvedNos.has(p.no)
    return (
      <tr className={`border-b border-gray-100 last:border-0 transition-colors ${approved ? 'bg-green-100 border-green-200' : rowIdx % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
        {/* 採用チェック */}
        <td className="px-2 py-2.5 align-top">
          <label className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className={[
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
              approved
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 hover:border-green-400',
            ].join(' ')}>
              {approved && <span className="text-white text-[11px] font-bold leading-none">✓</span>}
              <input
                type="checkbox"
                checked={approved}
                onChange={() => toggleApproved(p.no)}
                className="sr-only"
              />
            </div>
            <span className={`text-[9px] leading-none font-semibold ${approved ? 'text-green-600' : 'text-gray-400'}`}>
              {approved ? '採用' : '採用'}
            </span>
          </label>
        </td>
        {TABLE_COLS.map((c) => (
          <td key={c.key} className={`${c.minW} px-3 py-2.5 align-top`}>
            {c.key === 'no' ? (
              <span className="text-gray-400 font-mono">{p.no}</span>
            ) : c.key === 'type' ? (
              <span className={['inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap',
                p.type === 'リール' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700',
              ].join(' ')}>
                {p.type === 'リール' ? 'REEL' : 'FEED'}
              </span>
            ) : editingCell?.row === rowIdx && editingCell?.col === c.key ? (
              <textarea autoFocus value={String(p[c.key])}
                onChange={(e) => updateCell(rowIdx, c.key, e.target.value)}
                onBlur={() => setEditingCell(null)}
                rows={3}
                className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none resize-none bg-white leading-relaxed"
              />
            ) : (
              <button onClick={() => setEditingCell({ row: rowIdx, col: c.key })}
                className="w-full text-left text-gray-700 hover:text-gray-900 leading-relaxed" title="クリックして編集">
                {String(p[c.key])}
              </button>
            )}
          </td>
        ))}
        {/* 根拠 */}
        <td className="min-w-[160px] px-3 py-2.5 align-top">
          <p className="text-gray-400 leading-relaxed text-[11px]">{p.reason}</p>
        </td>
        {/* 行コピー */}
        <td className="px-2 py-2.5 align-top">
          <button
            onClick={() => copyText(formatProposal(p), `row-${p.no}`)}
            className={['px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all whitespace-nowrap',
              copiedKey === `row-${p.no}`
                ? 'bg-green-600 text-white border-green-600'
                : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700',
            ].join(' ')}
          >
            {copiedKey === `row-${p.no}` ? 'コピー済' : 'コピー'}
          </button>
        </td>
      </tr>
    )
  }

  const renderStep4 = () => (
    <div className="w-full">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-0.5">コンテンツ提案</h2>
          <p className="text-xs text-gray-400">
            {selectedClientName} ／ {selectedMonths.sort().map((m) => { const [y, mo] = m.split('-'); return `${y}年${parseInt(mo)}月` }).join('・')}
            ／ 合計{totalPosts}件
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← 戻る</button>
          {result && (
            <>
              <button
                onClick={() => handlePropose(true)}
                disabled={proposing || unapprovedCount === 0}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                未採用{unapprovedCount > 0 ? `（${unapprovedCount}件）` : ''}を再生成
              </button>
              <button onClick={exportCsv} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* ローディング */}
      {proposing && (
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="w-12 h-12 border-4 border-gray-100 border-t-gray-900 rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Claudeが分析・提案中...</p>
            <p className="text-xs text-gray-400 mt-1">レポートの量によっては1〜2分かかる場合があります</p>
          </div>
        </div>
      )}

      {/* エラー */}
      {proposeError && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 mb-5">
          <p className="text-xs font-semibold text-red-600 mb-1">エラーが発生しました</p>
          <p className="text-xs text-red-700">{proposeError}</p>
        </div>
      )}

      {/* 結果 */}
      {result && !proposing && (
        <>
          {/* 提案方針 */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-6">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">提案方針</p>
            <p className="text-sm text-blue-900 leading-relaxed">{result.overview}</p>
          </div>

          {/* 月ごとのテーブル */}
          <div className="flex flex-col gap-8">
            {monthGroups.map(({ monthKey, label, proposals }) => (
              <div key={monthKey}>
                {/* 月ヘッダー */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                  <button
                    onClick={() => copyText(
                      `=== ${label} ===\n\n` + proposals.map(formatProposal).join('\n\n'),
                      `month-${monthKey}`
                    )}
                    className={['px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                      copiedKey === `month-${monthKey}`
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700',
                    ].join(' ')}
                  >
                    {copiedKey === `month-${monthKey}` ? 'コピー済' : `${label}をまとめてコピー`}
                  </button>
                </div>

                {/* テーブル */}
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="w-12 px-2 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">採用</th>
                        {TABLE_COLS.map((c) => (
                          <th key={c.key} className={`${c.minW} px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>
                            {c.label}
                          </th>
                        ))}
                        <th className="min-w-[160px] px-3 py-2.5 text-left text-[10px] font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">根拠</th>
                        <th className="w-16 px-2 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposals.map((p, rowIdx) => (
                        <ProposalRow key={p.no} p={p} rowIdx={rowIdx} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">各セルをクリックすると内容を編集できます</p>
        </>
      )}
    </div>
  )

  // ─── メインレンダー

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <a href="/" className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">← ホーム</a>
        <span className="text-gray-200 select-none">|</span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">わざマシン / SNS事業</p>
          <h1 className="text-sm font-bold text-gray-900">過去レポート参照 コンテンツ提案</h1>
        </div>
      </header>

      <div className="px-6 py-8 max-w-6xl mx-auto">
        <StepIndicator />
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  )
}
