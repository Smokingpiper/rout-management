import AppShell from '@/components/AppShell'

export const metadata = {
  title: '使い方 | ゴミ収支管理アプリ',
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
