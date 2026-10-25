import ApprovalStamps, { type StampInfo } from './ApprovalStamps'
import {
  CHECK_GROUPS, SHIFT_TYPES, rollCallAlerts,
  type Checks, type RollCall,
} from '@/lib/inspection'

export type PrintableData = {
  reportDate: string
  isEarly: boolean
  companyName: string
  driverName: string
  routeLabel: string          // 例: 阿佐谷南 — 阿佐谷南1 / 早朝回収
  wasteTypeName: string
  totalWeightKg: number | null
  weights: { name: string; weightKg: number }[]  // 収集物の内訳（無ければ空）
  memo: string
  statusLabel: string
  startTime: string | null    // GPS記録の最初の時刻（HH:MM）
  endTime: string | null      // GPS記録の最後の時刻（HH:MM）
  stamps: { manager: StampInfo; chief: StampInfo; staff: StampInfo }
  inspection: {
    vehicleNumber: string | null
    shiftType: string
    checks: unknown
    startRollCall: unknown
    endRollCall: unknown
    nearMissNote: string | null
  } | null
  visited: { address: string | null; time: string; source: string }[]
  incidents: { vehicleNumber: string; company: string; time: string }[]
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function japaneseDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const wd = WEEKDAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()]
  return `令和${y - 2018}年${m}月${d}日（${wd}）`
}

function yn(v: boolean | null, yes: string, no: string) {
  return v === null ? '' : v ? yes : no
}

function RollCallRow({ title, rc }: { title: string; rc: RollCall | null }) {
  const time = rc?.at ? new Date(rc.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''
  const alerts = rollCallAlerts(rc)
  return (
    <tr>
      <th style={{ width: 52 }}>{title}</th>
      <td style={{ width: 44 }}>{time}</td>
      <td>{rc?.caller ?? ''}</td>
      <td>{rc ? yn(rc.faceToFace, '有', '無') : ''}</td>
      <td>{rc ? yn(rc.alcoholDeviceUsed, '使用', '不使用') : ''}</td>
      <td style={alerts.includes('酒気帯びあり') ? { fontWeight: 700 } : undefined}>{rc ? yn(rc.drunk, '有', '無') : ''}</td>
      <td style={alerts.includes('疾病・疲労・睡眠不足あり') ? { fontWeight: 700 } : undefined}>{rc ? yn(rc.unwell, '有', '無') : ''}</td>
      <td style={{ textAlign: 'left' }}>{rc?.note ?? ''}</td>
    </tr>
  )
}

// 紙の「作業日報・点呼点検表」に合わせたA4・1日報1枚の印刷レイアウト
export default function PrintableReport({ data }: { data: PrintableData }) {
  const ins = data.inspection
  const checks = (ins?.checks ?? {}) as Checks
  const shiftLabel = SHIFT_TYPES.find(s => s.value === (data.isEarly ? 'early' : 'normal'))?.label ?? ''
  const ngWithAction = CHECK_GROUPS.flatMap(g => g.items).filter(i => checks[i.key]?.result === 'ng')

  return (
    <section className="pr-sheet">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 8, textAlign: 'center' }}>作　業　日　報</div>
          <div style={{ fontSize: 10, textAlign: 'center' }}>
            （杉並区・資源回収事業びん・缶・古紙回収業務委託用{data.isEarly ? '／早朝持ち去り防止業務' : ''}）
          </div>
        </div>
        <ApprovalStamps {...data.stamps} size="compact" />
      </div>

      <div style={{ margin: '6px 0 4px', fontSize: 12 }}>
        <b>{japaneseDate(data.reportDate)}</b>　　天候：＿＿＿＿＿　　区分：<b>{shiftLabel}</b>　　<span style={{ color: '#555' }}>（{data.statusLabel}）</span>
      </div>

      <table>
        <tbody>
          <tr>
            <th style={{ width: 90 }}>登録車両番号</th><td>{ins?.vehicleNumber ?? ''}</td>
            <th style={{ width: 90 }}>従事職員</th><td>{data.companyName}　{data.driverName}</td>
          </tr>
          <tr>
            <th>作業開始時間</th><td>{data.startTime ?? ''}</td>
            <th>作業終了時間</th><td>{data.endTime ?? ''}</td>
          </tr>
          <tr>
            <th>{data.isEarly ? '区分' : 'エリア・ルート'}</th><td>{data.routeLabel}</td>
            <th>品目・総重量</th><td>
              {data.wasteTypeName}　{data.totalWeightKg != null ? `${data.totalWeightKg} kg` : ''}
              {data.weights.length > 0 && <div style={{ fontSize: 10.5 }}>（{data.weights.map(w => `${w.name} ${w.weightKg}kg`).join('、')}）</div>}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ marginTop: 4 }}>
        <tbody>
          <tr><th style={{ width: 90 }}>状況・報告等欄</th><td style={{ textAlign: 'left' }}>
            <div><b>ヒヤリハット事例：</b>{ins?.nearMissNote ?? ''}</div>
            <div style={{ minHeight: 26 }}><b>特記事項：</b>{data.memo}</div>
          </td></tr>
        </tbody>
      </table>

      {data.isEarly && (
        <>
          <table style={{ marginTop: 4 }}>
            <thead>
              <tr><th colSpan={3} style={{ textAlign: 'left' }}>回ったスポット（{data.visited.length}件）</th></tr>
            </thead>
            <tbody>
              {data.visited.length > 0 ? data.visited.map((v, i) => (
                <tr key={i}>
                  <td style={{ width: 26 }}>{i + 1}</td>
                  <td style={{ textAlign: 'left' }}>{v.address ?? '（住所未登録）'}</td>
                  <td style={{ width: 60 }}>{v.time}{v.source === 'manual' ? '*' : ''}</td>
                </tr>
              )) : <tr><td colSpan={3}>記録なし</td></tr>}
            </tbody>
          </table>
          <table style={{ marginTop: 4 }}>
            <thead><tr><th>持ち去り車両番号</th><th>業者名（企業名）</th><th style={{ width: 70 }}>確認時間</th></tr></thead>
            <tbody>
              {data.incidents.length > 0 ? data.incidents.map((x, i) => (
                <tr key={i}><td>{x.vehicleNumber}</td><td>{x.company}</td><td>{x.time}</td></tr>
              )) : <tr><td>&nbsp;</td><td></td><td></td></tr>}
            </tbody>
          </table>
        </>
      )}

      <div style={{ marginTop: 8, textAlign: 'center', fontWeight: 700, letterSpacing: 4 }}>日 常 点 検 ・ 点 呼 表</div>
      {!ins ? (
        <div style={{ border: '1px solid #333', padding: 8, textAlign: 'center', color: '#555' }}>この日の作業前点検の記録はありません</div>
      ) : (
        <>
          {CHECK_GROUPS.map(group => (
            <div key={group.key} style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700 }}>■{group.title}</div>
              <div className="pr-grid">
                {group.items.map(item => {
                  const r = checks[item.key]?.result
                  return (
                    <div key={item.key} className="pr-cell">
                      {item.label}{item.hint ? `（${item.hint}）` : ''}　<b style={r === 'ng' ? { fontSize: 13 } : undefined}>{r === 'ok' ? '○' : r === 'ng' ? '×' : '／'}</b>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {ngWithAction.length > 0 && (
            <div style={{ marginTop: 3, fontSize: 10.5 }}>
              <b>×の場合の対応：</b>{ngWithAction.map(i => `${i.label}→${checks[i.key]?.action || '（未記入）'}`).join('　／　')}
            </div>
          )}

          <table style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th></th><th>時刻</th><th>点呼者</th><th>点呼（対面）</th><th>アルコール検知器</th><th>酒気帯び</th><th>疾病・疲労・睡眠不足</th><th>連絡事項</th>
              </tr>
            </thead>
            <tbody>
              <RollCallRow title="始業" rc={(ins.startRollCall ?? null) as RollCall | null} />
              <RollCallRow title="終業" rc={(ins.endRollCall ?? null) as RollCall | null} />
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
