import { db } from '@/db/client'
import { dailyInspections, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import {
  CHECK_GROUPS, SHIFT_TYPES, rollCallAlerts, summarizeInspection,
  type Checks, type RollCall,
} from '@/lib/inspection'

export const dynamic = 'force-dynamic'

const SHIFT_LABEL = Object.fromEntries(SHIFT_TYPES.map(s => [s.value, s.label])) as Record<string, string>

function formatTime(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

function yn(v: boolean | null, yes: string, no: string) {
  return v === null ? <span style={{ color: 'var(--text-3)' }}>未入力</span> : v ? yes : no
}

function RollCallCard({ title, rc }: { title: string; rc: RollCall | null }) {
  const alerts = rollCallAlerts(rc)
  return (
    <div className="card">
      <div className="card-title">
        {title}
        {rc?.at ? <span className="pill ok">記録 {formatTime(rc.at)}</span> : <span className="pill muted">未実施</span>}
      </div>
      {rc ? (
        <table>
          <tbody>
            <tr><td style={{ color: 'var(--text-3)', width: 160 }}>点呼者</td><td>{rc.caller || '—'}</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>点呼（対面）</td><td>{yn(rc.faceToFace, '有', '無')}</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>アルコール検知器</td><td>{yn(rc.alcoholDeviceUsed, '使用', '不使用')}</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>酒気帯び</td><td>{yn(rc.drunk, '有', '無')}</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>疾病・疲労・睡眠不足 など</td><td>{yn(rc.unwell, '有', '無')}</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>連絡事項</td><td style={{ whiteSpace: 'pre-wrap' }}>{rc.note || '—'}</td></tr>
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>入力されていません</p>
      )}
      {alerts.length > 0 && (
        <p style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>⚠️ {alerts.join('・')}</p>
      )}
    </div>
  )
}

export default async function AdminInspectionDetailPage({ params }: { params: Promise<{ inspectionId: string }> }) {
  const { inspectionId } = await params
  const [record] = await db.select().from(dailyInspections).where(eq(dailyInspections.id, inspectionId))
  if (!record) notFound()
  const [driver] = await db.select().from(users).where(eq(users.id, record.userId))

  const checks = (record.checks ?? {}) as Checks
  const summary = summarizeInspection(record)

  return (
    <>
      <div className="breadcrumb"><a href="/admin/inspections">点検記録</a> / {record.inspectionDate}</div>
      <div className="page-title">{driver?.name || driver?.email || '（不明なユーザー）'} の作業前点検</div>
      <div className="page-desc">
        {record.inspectionDate} ・ {record.vehicleNumber || '車両番号未入力'} ・ {SHIFT_LABEL[record.shiftType] ?? record.shiftType}
        {' ・ '}最終更新 {formatTime(record.updatedAt.toISOString())}
      </div>

      {summary.ngItems.length > 0 && (
        <div className="card" style={{ background: 'var(--danger-dim)', borderColor: 'var(--danger)' }}>
          <b style={{ color: 'var(--danger)' }}>⚠️ ×の項目: {summary.ngItems.map(i => i.label).join('・')}</b>
        </div>
      )}

      {CHECK_GROUPS.map(group => (
        <div className="card" key={group.key}>
          <div className="card-title">{group.title}</div>
          <table>
            <thead><tr><th>確認事項</th><th style={{ width: 80 }}>チェック</th><th>×の場合の対応</th></tr></thead>
            <tbody>
              {group.items.map(item => {
                const e = checks[item.key]
                return (
                  <tr key={item.key}>
                    <td>{item.label}{item.hint && <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 6 }}>{item.hint}</span>}</td>
                    <td style={{ fontWeight: 700, color: e?.result === 'ng' ? 'var(--danger)' : e?.result === 'ok' ? 'var(--accent)' : 'var(--text-3)' }}>
                      {e?.result === 'ok' ? '○' : e?.result === 'ng' ? '×' : '未入力'}
                    </td>
                    <td>{e?.result === 'ng' ? (e.action || <span style={{ color: 'var(--danger)' }}>対応未記入</span>) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <RollCallCard title="始業点呼" rc={(record.startRollCall ?? null) as RollCall | null} />
      <RollCallCard title="終業点呼" rc={(record.endRollCall ?? null) as RollCall | null} />

      <div className="card">
        <div className="card-title">ヒヤリハット共有</div>
        <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{record.nearMissNote || <span style={{ color: 'var(--text-3)' }}>記載なし</span>}</p>
      </div>
    </>
  )
}
