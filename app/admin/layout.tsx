import AppShell from '@/components/AppShell'

export const metadata = {
  title: 'ルート・スポット管理 | ゴミ収支管理アプリ',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
