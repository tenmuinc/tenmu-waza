import { Client } from '@notionhq/client'
import { NextRequest, NextResponse } from 'next/server'
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

export async function GET(req: NextRequest) {
  const apiKey = process.env.NOTION_API_KEY
  const productDbId = process.env.NOTION_PRODUCT_DATABASE_ID

  if (!apiKey || !productDbId) {
    return NextResponse.json({ error: 'NOTION_PRODUCT_DATABASE_ID が設定されていません' }, { status: 500 })
  }

  const clientId = req.nextUrl.searchParams.get('clientId')
  const notion = new Client({ auth: apiKey })

  // まずクライアントでフィルタして取得、0件なら全件取得
  let results: PageObjectResponse[] = []

  if (clientId) {
    try {
      const filtered = await notion.databases.query({
        database_id: productDbId,
        filter: {
          property: 'クライアント',
          relation: { contains: clientId },
        },
        sorts: [{ direction: 'ascending', timestamp: 'created_time' }],
      })
      results = filtered.results as PageObjectResponse[]
    } catch {
      // フィルタ失敗時は全件にフォールバック
    }
  }

  // フィルタで0件 or クライアントIDなし → 全件取得
  if (results.length === 0) {
    try {
      const all = await notion.databases.query({
        database_id: productDbId,
        sorts: [{ direction: 'ascending', timestamp: 'created_time' }],
      })
      results = all.results as PageObjectResponse[]
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  const products = results.map((page) => {
    const props = page.properties

    const titleEntry = Object.entries(props).find(([, v]) => v.type === 'title')
    const name = titleEntry
      ? (titleEntry[1] as { type: 'title'; title: { plain_text: string }[] }).title
          .map((t) => t.plain_text).join('')
      : '名称未設定'

    const urlProp = props['商品URL']
    const url = urlProp?.type === 'url' ? (urlProp as { type: 'url'; url: string | null }).url ?? '' : ''

    const descProp = props['説明'] ?? props['description']
    const description = descProp?.type === 'rich_text'
      ? (descProp as { type: 'rich_text'; rich_text: { plain_text: string }[] }).rich_text
          .map((t) => t.plain_text).join('')
      : ''

    const catProp = props['カテゴリー']
    const category = catProp?.type === 'select'
      ? (catProp as { type: 'select'; select: { name: string } | null }).select?.name ?? ''
      : ''

    return { id: page.id, name, url, description, category }
  })

  return NextResponse.json({ products })
}
