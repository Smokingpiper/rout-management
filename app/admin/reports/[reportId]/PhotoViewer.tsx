'use client'

import { useEffect, useState } from 'react'

export default function PhotoViewer({ reportId, hasReportPhoto, hasReceiptPhoto }: { reportId: string; hasReportPhoto: boolean; hasReceiptPhoto: boolean }) {
  const [urls, setUrls] = useState<{ reportPhotoUrl: string | null; receiptPhotoUrl: string | null; configured: boolean } | null>(null)

  useEffect(() => {
    if (!hasReportPhoto && !hasReceiptPhoto) return
    fetch(`/api/admin/photo-url/${reportId}`).then(res => res.json()).then(setUrls).catch(() => {})
  }, [reportId, hasReportPhoto, hasReceiptPhoto])

  if (!hasReportPhoto && !hasReceiptPhoto) {
    return <p style={{ fontSize: 13, color: 'var(--text-3)' }}>まだ写真がアップロードされていません</p>
  }
  if (!urls) return <p style={{ fontSize: 13, color: 'var(--text-3)' }}>読み込み中…</p>
  if (!urls.configured) return <p style={{ fontSize: 13, color: 'var(--warn)' }}>写真ストレージが未設定のため表示できません</p>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {urls.reportPhotoUrl && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>日報</div>
          <a href={urls.reportPhotoUrl} target="_blank" rel="noreferrer">
            <img src={urls.reportPhotoUrl} alt="日報" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
          </a>
        </div>
      )}
      {urls.receiptPhotoUrl && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>回収レシート</div>
          <a href={urls.receiptPhotoUrl} target="_blank" rel="noreferrer">
            <img src={urls.receiptPhotoUrl} alt="回収レシート" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
          </a>
        </div>
      )}
    </div>
  )
}
