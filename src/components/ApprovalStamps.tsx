import SealStamp from './SealStamp'

export type StampInfo = { text: string; date: string } | null

// 日報の押印欄（紙の「課　長／係　長／担当者」）。左から 課長・係長・担当者
export default function ApprovalStamps({
  manager, chief, staff, size = 'normal',
}: { manager: StampInfo; chief: StampInfo; staff: StampInfo; size?: 'normal' | 'compact' }) {
  const box = size === 'compact' ? 56 : 72
  const seal = size === 'compact' ? 38 : 50
  const slots: { label: string; stamp: StampInfo }[] = [
    { label: '課 長', stamp: manager },
    { label: '係 長', stamp: chief },
    { label: '担当者', stamp: staff },
  ]
  return (
    <div style={{ display: 'inline-flex', border: '1px solid #333', background: '#fff', color: '#111' }}>
      {slots.map((s, i) => (
        <div key={s.label} style={{ width: box, borderLeft: i === 0 ? 'none' : '1px solid #333', textAlign: 'center' }}>
          <div style={{ fontSize: 11, borderBottom: '1px solid #333', padding: '1px 0', letterSpacing: 2 }}>{s.label}</div>
          <div style={{ height: box - 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            {s.stamp ? (
              <>
                <SealStamp text={s.stamp.text} size={seal} />
                {s.stamp.date && <span style={{ fontSize: 9, lineHeight: 1 }}>{s.stamp.date}</span>}
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
