import AppShell from '@/components/AppShell'

export const metadata = {
  title: '協会管理 | ゴミ収支管理アプリ',
}

export default function UnionLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
