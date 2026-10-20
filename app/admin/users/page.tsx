import { db } from '@/db/client'
import { users } from '@/db/schema'
import { getPrimaryCompany } from '@/lib/company'
import { eq, desc } from 'drizzle-orm'
import { formatRoles } from '@/lib/roleLabel'
import { getLoginStatuses, LOGIN_STATE_LABEL, LOGIN_STATE_PILL } from '@/lib/loginStatus'
import NewUserForm from './NewUserForm'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const company = await getPrimaryCompany()
  const userList = company
    ? await db.select().from(users).where(eq(users.companyId, company.id)).orderBy(desc(users.createdAt))
    : []

  const statuses = await getLoginStatuses(userList)
  const pendingCount = userList.filter(u => statuses.get(u.id)?.state !== 'done').length

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">ユーザー管理</div>
      <div className="page-desc">
        ドライバーなどのアカウントを作成します。作成時に一時パスワードが発行されるので、そのままご本人にお伝えください
        （Google認証は今後導入予定です。現時点ではメールアドレスとパスワードでログインします）。
      </div>

      {pendingCount > 0 && (
        <div className="card" style={{ background: 'var(--warn-dim)', fontSize: 13 }}>
          初期ログインが完了していないユーザーが <b>{pendingCount}人</b> います。パスワードが分からない場合は「詳細」から初期パスワードを再発行できます。
        </div>
      )}

      <div className="card">
        {userList.map(u => {
          const st = statuses.get(u.id)!
          return (
          <div key={u.id} className="spot-row" style={{ flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                {u.name || u.email}
                <span className={`pill ${LOGIN_STATE_PILL[st.state]}`} style={{ marginLeft: 8 }}>{LOGIN_STATE_LABEL[st.state]}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, wordBreak: 'break-all' }}>
                {u.email}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {formatRoles(u.roles as string[], u.adminRank)} ・ 登録日 {u.createdAt.toISOString().slice(0, 10)}
              </div>
            </div>
            <a className="btn sm" href={`/admin/users/${u.id}`}>詳細</a>
          </div>
          )
        })}
        {userList.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0', fontSize: 13 }}>まだユーザーが登録されていません</p>
        )}
      </div>

      <NewUserForm />
    </>
  )
}
