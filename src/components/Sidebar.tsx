'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV_GROUPS = [
  {
    label: 'ドライバー向け',
    items: [
      { href: '/driver', label: '今日のルート' },
      { href: '/driver/my-routes', label: '担当ルート一覧' },
      { href: '/driver/reports', label: '日報一覧' },
    ],
  },
  {
    label: '会社管理者向け',
    items: [
      { href: '/admin', label: 'エリア一覧' },
      { href: '/admin/reports', label: '日報一覧・承認' },
      { href: '/admin/users', label: 'ユーザー管理' },
    ],
  },
  {
    label: '協会管理者向け',
    items: [
      { href: '/union/companies', label: '会社登録' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  function isActive(href: string) {
    if (href === '/admin' || href === '/driver') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <nav className="app-sidebar">
      <h1>🗑 ゴミ収支管理</h1>
      <span className="env-badge">実データ版</span>

      {NAV_GROUPS.map(group => (
        <div key={group.label}>
          <div className="group-label">{group.label}</div>
          {group.items.map(item => (
            <a key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
              {item.label}
              <span className="annot-badge" data-badge-for={item.href} />
            </a>
          ))}
        </div>
      ))}

      <div className="app-toggle" onClick={toggleTheme}>🌓 ライト/ダーク切替</div>
      <a className="app-toggle" href="/account/password">🔑 パスワード変更</a>
      <a className="app-toggle" href="/mockup.html">📐 画面モックアップへ</a>
      <div className="app-toggle" onClick={logout}>🚪 ログアウト</div>
      <div id="annotation-controls-slot" />
    </nav>
  )
}
