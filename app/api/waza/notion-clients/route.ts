import { Client } from '@notionhq/client'
import { NextResponse } from 'next/server'
import type {
  DatabaseObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'NOTION_API_KEY が設定されていません' }, { status: 500 })
  }

  const notion = new Client({ auth: apiKey })

  // インテグレーションがアクセスできる全データベースを検索
  let databases: DatabaseObjectResponse[] = []
  try {
    const search = await notion.search({
      filter: { value: 'database', property: 'object' },
      sort: { direction: 'ascending', timestamp: 'last_edited_time' },
    })
    databases = search.results as DatabaseObjectResponse[]
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  if (databases.length === 0) {
    return NextResponse.json({
      error: 'アクセスできるデータベースが見つかりません。インテグレーションを顧客データベースに接続してください。',
    }, { status: 404 })
  }

  // データベースが複数ある場合は選択肢として返す
  // 「顧客」を含むDBを優先する
  const preferred = databases.find((db) => {
    const title = db.title.map((t) => t.plain_text).join('')
    return title.includes('顧客') || title.includes('クライアント') || title.includes('client')
  }) ?? databases[0]

  // そのDBの行をクライアント一覧として返す
  let pages
  try {
    pages = await notion.databases.query({
      database_id: preferred.id,
      sorts: [{ direction: 'ascending', timestamp: 'created_time' }],
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const clients = (pages.results as PageObjectResponse[]).map((page) => {
    const props = page.properties
    const titleEntry = Object.entries(props).find(([, v]) => v.type === 'title')
    const name = titleEntry
      ? (titleEntry[1] as { type: 'title'; title: { plain_text: string }[] }).title
          .map((t) => t.plain_text)
          .join('')
      : '名称未設定'
    return { id: page.id, name }
  })

  return NextResponse.json({ clients })
}
