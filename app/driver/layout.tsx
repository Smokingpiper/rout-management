import AppShell from '@/components/AppShell'

export const metadata = {
  title: 'ドライバー | ゴミ収支管理アプリ',
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
