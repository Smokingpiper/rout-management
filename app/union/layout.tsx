import '../admin/admin.css'

export const metadata = {
  title: '協会管理 | ゴミ収支管理アプリ',
}

export default function UnionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-body">
      <div className="admin-topbar">
        <span className="brand">🗑 協会管理</span>
        <a href="/union/companies">会社登録</a>
        <a href="/union/invites">ユーザー招待管理</a>
        <a href="/admin">会社管理者向けへ</a>
        <a href="/mockup.html">画面モックアップへ</a>
      </div>
      <div className="admin-main">{children}</div>
    </div>
  )
}
