import './admin.css'

export const metadata = {
  title: 'ルート・スポット管理 | ゴミ収支管理アプリ',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-body">
      <div className="admin-topbar">
        <span className="brand">🗑 管理画面</span>
        <a href="/admin">エリア一覧</a>
        <a href="/admin/reports">日報一覧・承認</a>
        <a href="/mockup.html">画面モックアップへ</a>
      </div>
      <div className="admin-main">{children}</div>
    </div>
  )
}
