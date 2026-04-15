import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

interface PreFilledRow {
  no: number
  type: 'フィード' | 'リール'
  product: string
  productUrl: string
  productDesc: string
  rowNote: string
}

interface ApprovedRow {
  no: number
  type: 'フィード' | 'リール'
  category: string
  product: string
  theme: string
  point: string
  memo: string
  reason: string
}

interface ProposeRequest {
  clientName: string
  targetMonths: string[]
  totalPosts: number
  feedCount: number
  reelCount: number
  previousContent: string
  reportBase64List: { name: string; base64: string }[]
  preFilledRows: PreFilledRow[]
  approvedRows?: ApprovedRow[]
  globalNote?: string   // 今回全体の注意点
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
  }

  const body: ProposeRequest = await req.json()
  const {
    clientName, targetMonths, totalPosts, feedCount, reelCount,
    previousContent, reportBase64List, preFilledRows, approvedRows = [],
    globalNote = '',
  } = body

  const anthropic = new Anthropic({ apiKey })

  const monthStr = targetMonths
    .sort()
    .map((m) => { const [y, mo] = m.split('-'); return `${y}年${parseInt(mo)}月` })
    .join('・')

  type DocumentBlock = {
    type: 'document'
    source: { type: 'base64'; media_type: 'application/pdf'; data: string }
    title: string
    context: string
    citations: { enabled: boolean }
  }

  const pdfBlocks: DocumentBlock[] = reportBase64List.map((r) => ({
    type: 'document' as const,
    source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: r.base64 },
    title: r.name,
    context: '過去のInstagramレポート。エンゲージメント率・リーチ・保存数・いいね数などのデータが含まれます。',
    citations: { enabled: true },
  }))

  // 生成対象の行（承認済みを除く）
  const approvedNos = new Set(approvedRows.map((r) => r.no))
  const targetRows = preFilledRows.filter((r) => !approvedNos.has(r.no))
  const targetTotal = targetRows.length
  const targetFeed = targetRows.filter((r) => r.type === 'フィード').length
  const targetReel = targetRows.filter((r) => r.type === 'リール').length

  const specifiedRows = targetRows.filter((r) => r.product.trim() !== '')
  const freeRows = targetRows.filter((r) => r.product.trim() === '')

  const approvedSection = approvedRows.length > 0
    ? `【承認済み（変更不要・そのまま出力すること）】
${approvedRows.map((r) => `No.${r.no} [${r.type}] 商品:${r.product} / テーマ:${r.theme}`).join('\n')}`
    : ''

  const noteSection = globalNote.trim()
    ? `【今回全体の注意点（必ず守ること）】\n${globalNote.trim()}`
    : ''

  const specifiedSection = specifiedRows.length > 0
    ? `【商品指定あり（この商品でコンテンツを考える）】
${specifiedRows.map((r) => {
    let line = `No.${r.no} [${r.type}] 商品: ${r.product}`
    if (r.productUrl) line += ` URL: ${r.productUrl}`
    if (r.productDesc) line += ` 説明: ${r.productDesc}`
    if (r.rowNote) line += ` ※注意点: ${r.rowNote}`
    return line
  }).join('\n')}`
    : ''

  const freeRowsWithNotes = freeRows.filter((r) => r.rowNote.trim())
  const rowNotesSection = freeRowsWithNotes.length > 0
    ? `【各投稿の個別注意点】\n${freeRowsWithNotes.map((r) => `No.${r.no}: ${r.rowNote}`).join('\n')}`
    : ''

  const freeSection = freeRows.length > 0
    ? `【商品指定なし（No.${freeRows.map((r) => r.no).join('・')} は商品・内容ともに自由に提案）】`
    : ''

  const systemPrompt = `あなたはInstagramマーケティングの専門家です。
クライアントの過去レポートと前回コンテンツを分析し、次回投稿コンテンツを提案します。

【絶対に守るルール】
1. 前回のコンテンツと全く同じ企画・テーマは禁止。レポートの結果が良くても「発展・深化」させること。
2. 「ポイント」には、撮影方法・見た目・デザインの指示は一切書かない。
   カルーセル投稿の場合は各スライドの構成の流れを書く。
   例: 「①注意喚起（梅雨に気をつけるべきこと）→ ②理由（なぜ梅雨が肌に悪いか）→ ③解決策（こうすれば防げる）」
   単発投稿の場合は投稿の核心メッセージとその展開を書く。
3. 承認済み行はそのまま出力する（変更禁止）。
4. 根拠は具体的なレポートデータ（エンゲージメント率・保存数など）を必ず引用する。
5. 必ずJSON形式のみで返す（説明文・前置き・バッククォートなし）。
6. フィードとリールを明確に区別し、指定の番号・種別を厳守する。`

  const userPrompt = `クライアント: ${clientName}
対象月: ${monthStr}
全体の投稿数: 合計${totalPosts}件（フィード${feedCount}件・リール${reelCount}件）
今回生成する件数: ${targetTotal}件（フィード${targetFeed}件・リール${targetReel}件）

【前回のコンテンツ一覧（これと被らないこと）】
${previousContent.trim() || '（未入力）'}

${approvedSection}
${noteSection}
${specifiedSection}
${rowNotesSection}
${freeSection}

全${totalPosts}件分のJSONを返してください。承認済み行はそのまま含め、残りを新規生成してください。
（JSONのみ・余分なテキスト不要）:
{
  "proposals": [
    {
      "no": 1,
      "type": "フィード",
      "category": "カテゴリー名",
      "product": "撮影する商品・素材",
      "theme": "訴求テーマ（前回と被らないこと）",
      "point": "カルーセルの場合は①〜の構成フロー、単発の場合は核心メッセージの展開",
      "memo": "補足・注意点",
      "reason": "この提案の根拠（前回との差別化の理由・レポート数値・季節性など具体的に）"
    }
  ],
  "overview": "全体的な提案方針と前回からの差別化ポイント（200字程度）"
}`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          ...(pdfBlocks.length > 0 ? pdfBlocks : []),
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  })

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    rawText.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) {
    return NextResponse.json(
      { error: 'Claudeからの応答をパースできませんでした', raw: rawText },
      { status: 500 }
    )
  }

  const parsed = JSON.parse(jsonMatch[1])
  return NextResponse.json(parsed)
}
