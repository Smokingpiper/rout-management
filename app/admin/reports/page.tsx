import { db } from '@/db/client'
import { wasteTypes } from '@/db/schema'
import { queryReportList, type ReportFilters } from '@/lib/reportQuery'
import { loadPatrolStatus } from '@/lib/patrolStatus'
import { todayStr } from '@/lib/date'
import PatrolBoard from './PatrolBoard'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  in_progress: '実施中',
  pending_approval: '承認待ち',
  approved: '承認済み',
}
const STATUS_CLASS: Record<string, string> = {
  in_progress: 'muted',
  pending_approval: 'warn',
  approved: 'ok',
}

function ReportTabs({ active }: { active: 'list' | 'status' }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <a className={`btn ${active === 'list' ? 'primary' : ''}`} href="/admin/reports">📋 日報一覧</a>
      <a className={`btn ${active === 'status' ? 'primary' : ''}`} href="/admin/reports?view=status">🚚 巡回状況</a>
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; status?: string; type?: string; view?: string; date?: string }>
}) {
  const sp = await searchParams

  // 巡回状況：その日のすべてのルートの進み具合と、周回漏れの恐れ・連絡先
  if (sp.view === 'status') {
    const date = /^d{4}-d{2}-d{2}$/.test(sp.date ?? '') ? sp.date! : todayStr()
    const data = await loadPatrolStatus(date)
    return (
      <>
        <div className="breadcrumb">会社管理者向け</div>
        <div className="page-title">日報一覧・承認</div>
        <ReportTabs active="status" />
        <div className="page-desc">
          {date} のすべてのルートの巡回状況です。周回漏れの恐れや、GPS記録の途絶があるルートが上に出ます。担当ドライバーへ、ここから電話・メールで連絡できます。
          要注意スポットの設定とメモも、この画面から変更できます。
        </div>
        <PatrolBoard date={data.date} isToday={data.isToday} generatedAt={data.generatedAt} rows={data.rows} />
      </>
    )
  }
  const filters: ReportFilters = {
    q: (sp.q ?? '').trim(),
    from: (sp.from ?? '').trim(),
    to: (sp.to ?? '').trim(),
    status: (sp.status ?? '').trim(),
    type: (sp.type ?? '').trim(),
  }

  const { reportList, routeById, areaById, userById } = await queryReportList(filters, 300)
  const wasteTypeList = await db.select().from(wasteTypes)
  const wasteTypeById = new Map(wasteTypeList.map(w => [w.id, w]))

  const printParams = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString()
  const hasFilter = Object.values(filters).some(Boolean)

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">日報一覧・承認</div>
      <ReportTabs active="list" />
      <div className="page-desc">ドライバーが提出した日報を確認・承認します。総重量・種別は1日1件、軌跡は詳細画面で確認できます。</div>

      <form method="get" className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input className="search-input" style={{ flex: '1 1 220px' }} type="text" name="q" defaultValue={filters.q} placeholder="ルート名・エリア名・ドライバー名で検索" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          期間
          <input className="text-input" type="date" name="from" defaultValue={filters.from} />
          〜
          <input className="text-input" type="date" name="to" defaultValue={filters.to} />
        </label>
        <select className="text-input" name="status" defaultValue={filters.status}>
          <option value="">状態：すべて</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="text-input" name="type" defaultValue={filters.type}>
          <option value="">区分：すべて</option>
          <option value="regular">通常回収</option>
          <option value="early">早朝回収</option>
        </select>
        <button className="btn primary" type="submit">検索</button>
        {hasFilter && <a className="btn" href="/admin/reports">クリア</a>}
      </form>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          現在の絞り込み条件に一致する日報 <b>{reportList.length}件</b> を、紙の日報と同じ体裁で一括印刷できます。
        </span>
        <a className="btn primary" href={`/admin/reports/print${printParams ? `?${printParams}` : ''}`} target="_blank" rel="noreferrer">🖨 一括印刷</a>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>日付</th><th>エリア</th><th>ルート</th><th>ドライバー</th><th>種別</th><th>総重量</th><th>状態</th><th></th></tr>
          </thead>
          <tbody>
            {reportList.map(r => {
              const route = r.routeId ? routeById.get(r.routeId) : null
              const area = route ? areaById.get(route.areaId) : null
              const wt = r.wasteTypeId ? wasteTypeById.get(r.wasteTypeId) : null
              const submitter = r.submittedBy ? userById.get(r.submittedBy) : null
              const isEarly = r.collectionType === 'early'
              return (
                <tr key={r.id}>
                  <td>{r.reportDate}</td>
                  <td>{isEarly ? '—' : (area?.name ?? '—')}</td>
                  <td>{isEarly ? <span className="pill info">早朝回収</span> : (route?.name ?? '—')}</td>
                  <td>{submitter ? (submitter.name || submitter.email) : <span style={{ color: 'var(--text-3)' }}>未提出</span>}</td>
                  <td>{wt?.name ?? '—'}</td>
                  <td>{r.totalWeightKg != null ? `${r.totalWeightKg}kg` : '—'}</td>
                  <td><span className={`pill ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td><a className="btn sm" href={`/admin/reports/${r.id}`}>詳細</a></td>
                </tr>
              )
            })}
            {reportList.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>該当する日報がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
