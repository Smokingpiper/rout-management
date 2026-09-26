import { db } from '@/db/client'
import { users } from '@/db/schema'
import { getPrimaryCompany } from '@/lib/company'
import { eq, desc } from 'drizzle-orm'
import NewUserForm from './NewUserForm'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  union_admin: '協会管理者',
  company_admin: '会社管理者',
  driver: 'ドライバー',
}

export default async function AdminUsersPage() {
  const company = await getPrimaryCompany()
  const userList = company
    ? await db.select().from(users).where(eq(users.companyId, company.id)).orderBy(desc(users.createdAt))
    : []

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">ユーザー管理</div>
      <div className="page-desc">
        ドライバーなどのアカウントを作成します。作成時に一時パスワードが発行されるので、そのままご本人にお伝えください
        （Google認証は今後導入予定です。現時点ではメールアドレスとパスワードでログインします）。
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>メールアドレス</th><th>氏名</th><th>ロール</th><th>登録日</th><th></th></tr>
          </thead>
          <tbody>
            {userList.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || '—'}</td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.createdAt.toISOString().slice(0, 10)}</td>
                <td><a className="btn sm" href={`/admin/users/${u.id}`}>詳細</a></td>
              </tr>
            ))}
            {userList.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>まだユーザーが登録されていません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <NewUserForm />
    </>
  )
}
