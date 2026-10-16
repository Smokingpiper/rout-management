import {
  CHECK_GROUPS, SHIFT_TYPES, rollCallAlerts, summarizeInspection,
  type Checks, type RollCall,
} from '@/lib/inspection'

type InspectionRecord = {
  id: string
  vehicleNumber: string | null
  shiftType: string
  checks: unknown
  startRollCall: unknown
  endRollCall: unknown
  nearMissNote: string | null
}

const SHIFT_LABEL = Object.fromEntries(SHIFT_TYPES.map(s => [s.value, s.label])) as Record<string, string>

function formatTime(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

function yn(v: boolean | null, yes: string, no: string) {
  return v === null ? '未入力' : v ? yes : no
}

function RollCallLine({ title, rc }: { title: string; rc: RollCall | null }) {
  const alerts = rollCallAlerts(rc)
  if (!rc) {
    return <div style={{ fontSize: 13 }}><b>{title}</b>：<span style={{ color: 'var(--text-3)' }}>未実施</span></div>
  }
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
      <b>{title}</b>
      {rc.at && <span style={{ color: 'var(--text-3)' }}> {formatTime(rc.at)}</span>}
      ：点呼者 {rc.caller || '—'} ／ 対面 {yn(rc.faceToFace, '有', '無')} ／ 検知器 {yn(rc.alcoholDeviceUsed, '使用', '不使用')} ／
      酒気帯び {yn(rc.drunk, '有', '無')} ／ 疾病・疲労・睡眠不足 {yn(rc.unwell, '有', '無')}
      {rc.note && <div style={{ color: 'var(--text-2)' }}>連絡事項：{rc.note}</div>}
      {alerts.length > 0 && <div style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {alerts.join('・')}</div>}
    </div>
  )
}

// 日報の中に載せる、その日の作業前点検（日常点検・点呼表）の要約。
// 紙の作業日報は「作業日報」と「日常点検・点呼表」が1枚になっていたので、デジタルでも日報から見られるようにする
export default function InspectionSummaryCard({
  inspection, emptyMessage, detailHref,
}: { inspection: InspectionRecord | null; emptyMessage: string; detailHref?: string }) {
  if (!inspection) {
    return (
      <div className="card">
        <div className="card-title">作業前点検</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{emptyMessage}</p>
      </div>
    )
  }

  const checks = (inspection.checks ?? {}) as Checks
  const summary = summarizeInspection(inspection)
  const startRc = (inspection.startRollCall ?? null) as RollCall | null
  const endRc = (inspection.endRollCall ?? null) as RollCall | null

  return (
    <div className="card">
      <div className="card-title">
        作業前点検
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`pill ${summary.checksDone ? 'ok' : 'warn'}`}>点検 {summary.answered}/{summary.total}</span>
          {summary.ngItems.length > 0 && <span className="pill" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>× {summary.ngItems.length}件</span>}
          {detailHref && <a className="btn sm" href={detailHref}>点検記録を開く</a>}
        </span>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
        {inspection.vehicleNumber || '車両番号未入力'} ・ {SHIFT_LABEL[inspection.shiftType] ?? inspection.shiftType}
      </div>

      {summary.ngItems.length > 0 ? (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>
          <b style={{ color: 'var(--danger)' }}>× の項目</b>
          {summary.ngItems.map(i => (
            <div key={i.key}>・{i.label}：{checks[i.key]?.action || <span style={{ color: 'var(--danger)' }}>対応未記入</span>}</div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 10 }}>
          {summary.checksDone ? '✓ 点検項目はすべて○です' : '点検項目に未入力があります'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <RollCallLine title="始業点呼" rc={startRc} />
        <RollCallLine title="終業点呼" rc={endRc} />
      </div>

      {inspection.nearMissNote && (
        <div style={{ fontSize: 13, marginTop: 10 }}>
          <b>ヒヤリハット</b>：<span style={{ whiteSpace: 'pre-wrap' }}>{inspection.nearMissNote}</span>
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>点検項目をすべて表示</summary>
        <div style={{ marginTop: 8 }}>
          {CHECK_GROUPS.map(group => (
            <div key={group.key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 2 }}>{group.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 13 }}>
                {group.items.map(item => {
                  const r = checks[item.key]?.result
                  return (
                    <span key={item.key} style={{ color: r === 'ng' ? 'var(--danger)' : r === 'ok' ? 'var(--text)' : 'var(--text-3)', fontWeight: r === 'ng' ? 700 : 400 }}>
                      {item.label} {r === 'ok' ? '○' : r === 'ng' ? '×' : '－'}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
