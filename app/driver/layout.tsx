import './driver.css'

export const metadata = {
  title: 'ドライバー | ゴミ収支管理アプリ',
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="driver-body">
      <div className="driver-topbar">
        🗑 ドライバー向け
        <a href="/driver">ルート一覧</a>
      </div>
      <div className="driver-main">{children}</div>
    </div>
  )
}
