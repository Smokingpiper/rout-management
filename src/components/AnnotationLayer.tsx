'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Annotation = {
  id: number | string
  screen_id: string
  x: number
  y: number
  author: string | null
  comment: string
  created_at: string
}

function defaultAuthor() {
  try { return localStorage.getItem('routmgmt_annotator_name') || '' } catch { return '' }
}
function saveDefaultAuthor(name: string) {
  try { localStorage.setItem('routmgmt_annotator_name', name) } catch {}
}

export default function AnnotationLayer() {
  const pathname = usePathname()
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [available, setAvailable] = useState(true)
  const [mode, setMode] = useState(false)
  const [status, setStatus] = useState('')
  const [newPin, setNewPin] = useState<{ x: number; y: number } | null>(null)
  const [openId, setOpenId] = useState<string | number | null>(null)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/annotations')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setAnnotations)
      .catch(() => setAvailable(false))
  }, [])

  useEffect(() => {
    const counts: Record<string, number> = {}
    for (const a of annotations) {
      for (const badge of document.querySelectorAll<HTMLElement>('.annot-badge')) {
        const href = badge.dataset.badgeFor
        if (href && a.screen_id.startsWith(href)) {
          counts[href] = (counts[href] || 0) + 1
        }
      }
    }
    document.querySelectorAll<HTMLElement>('.annot-badge').forEach(badge => {
      const href = badge.dataset.badgeFor
      const n = href ? (counts[href] || 0) : 0
      badge.textContent = n > 0 ? String(n) : ''
      badge.classList.toggle('show', n > 0)
    })
  }, [annotations])

  function toggleMode() {
    if (!available) { setStatus('アノテーションDB未設定です'); return }
    setMode(m => !m)
    setNewPin(null)
    setStatus(mode ? '' : '画面をクリックしてコメントを追加')
  }

  function onOverlayClick(e: React.MouseEvent) {
    if (!mode || !overlayRef.current) return
    if ((e.target as HTMLElement).closest('.pin, .annotate-popover')) return
    const rect = overlayRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOpenId(null)
    setEditingId(null)
    setNewPin({ x, y })
  }

  async function submitNew(comment: string, author: string) {
    if (!comment.trim()) return
    saveDefaultAuthor(author)
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen_id: pathname, x: newPin!.x, y: newPin!.y, author, comment }),
      })
      if (!res.ok) throw new Error()
      const saved = await res.json()
      setAnnotations(prev => [...prev, saved])
      setNewPin(null)
    } catch {
      setStatus('投稿に失敗しました')
    }
  }

  async function submitEdit(a: Annotation, comment: string, author: string) {
    if (!comment.trim()) return
    try {
      const res = await fetch('/api/annotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, author, comment }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setAnnotations(prev => prev.map(x => (x.id === a.id ? updated : x)))
      setEditingId(null)
      setOpenId(a.id)
    } catch {
      setStatus('更新に失敗しました')
    }
  }

  async function deleteAnnotation(a: Annotation) {
    if (!confirm('このコメントを削除しますか？')) return
    try {
      const res = await fetch('/api/annotations?id=' + encodeURIComponent(String(a.id)), { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAnnotations(prev => prev.filter(x => x.id !== a.id))
      setOpenId(null)
    } catch {
      setStatus('削除に失敗しました')
    }
  }

  const pageAnnotations = annotations.filter(a => a.screen_id === pathname)

  return (
    <>
      <div
        ref={overlayRef}
        className={`annotation-overlay ${mode ? 'mode-on' : ''}`}
        onClick={onOverlayClick}
      >
        {pageAnnotations.map((a, i) => (
          <div key={a.id} className="pin" style={{ left: `${a.x}%`, top: `${a.y}%` }} onClick={(e) => { e.stopPropagation(); setEditingId(null); setOpenId(openId === a.id ? null : a.id) }}>
            {i + 1}
          </div>
        ))}

        {pageAnnotations.map(a => openId === a.id && editingId !== a.id && (
          <ViewPopover key={`view-${a.id}`} a={a} onClose={() => setOpenId(null)} onEdit={() => setEditingId(a.id)} onDelete={() => deleteAnnotation(a)} />
        ))}
        {pageAnnotations.map(a => editingId === a.id && (
          <EditPopover key={`edit-${a.id}`} a={a} onCancel={() => setEditingId(null)} onSave={(c, au) => submitEdit(a, c, au)} />
        ))}

        {newPin && (
          <NewPopover x={newPin.x} y={newPin.y} defaultAuthor={defaultAuthor()} onCancel={() => setNewPin(null)} onSave={submitNew} />
        )}
      </div>

      {/* Sidebar controls, portal-free: rendered via fixed slot appended by CSS selector target */}
      <SidebarControls available={available} mode={mode} status={status} onToggle={toggleMode} />
    </>
  )
}

function ViewPopover({ a, onClose, onEdit, onDelete }: { a: Annotation; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const when = new Date(a.created_at).toLocaleString('ja-JP')
  return (
    <div className="annotate-popover" style={{ left: `${a.x}%`, top: `${a.y}%` }} onClick={e => e.stopPropagation()}>
      <div className="meta">{a.author || '匿名'} ・ {when}</div>
      <div className="comment-text">{a.comment}</div>
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn sm danger-outline" onClick={onDelete}>削除</button>
        <button className="btn sm" onClick={onEdit}>編集</button>
        <button className="btn sm" onClick={onClose}>閉じる</button>
      </div>
    </div>
  )
}

function EditPopover({ a, onCancel, onSave }: { a: Annotation; onCancel: () => void; onSave: (comment: string, author: string) => void }) {
  const [comment, setComment] = useState(a.comment)
  const [author, setAuthor] = useState(a.author || '')
  return (
    <div className="annotate-popover" style={{ left: `${a.x}%`, top: `${a.y}%` }} onClick={e => e.stopPropagation()}>
      <div className="field"><label>お名前（任意）</label><input value={author} onChange={e => setAuthor(e.target.value)} /></div>
      <div className="field"><label>コメント</label><textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} /></div>
      <div className="actions">
        <button className="btn sm" onClick={onCancel}>キャンセル</button>
        <button className="btn sm primary" onClick={() => onSave(comment, author)}>保存</button>
      </div>
    </div>
  )
}

function NewPopover({ x, y, defaultAuthor, onCancel, onSave }: { x: number; y: number; defaultAuthor: string; onCancel: () => void; onSave: (comment: string, author: string) => void }) {
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState(defaultAuthor)
  return (
    <div className="annotate-popover" style={{ left: `${x}%`, top: `${y}%` }} onClick={e => e.stopPropagation()}>
      <div className="field"><label>お名前（任意）</label><input value={author} onChange={e => setAuthor(e.target.value)} /></div>
      <div className="field"><label>コメント</label><textarea rows={3} placeholder="気になる点を入力" value={comment} onChange={e => setComment(e.target.value)} /></div>
      <div className="actions">
        <button className="btn sm" onClick={onCancel}>キャンセル</button>
        <button className="btn sm primary" onClick={() => onSave(comment, author)}>投稿</button>
      </div>
    </div>
  )
}

function SidebarControls({ available, mode, status, onToggle }: { available: boolean; mode: boolean; status: string; onToggle: () => void }) {
  const [target, setTarget] = useState<Element | null>(null)
  useEffect(() => {
    setTarget(document.getElementById('annotation-controls-slot'))
  }, [])
  if (!target) return null
  return createPortal(
    <>
      <div className={`app-toggle ${mode ? 'on' : ''}`} onClick={onToggle}>📌 アノテーションモード{!available ? '（未設定）' : ''}</div>
      <div className="app-status">{status}</div>
    </>,
    target,
  )
}
