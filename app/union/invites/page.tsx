import { db } from '@/db/client'
import { allowedEmails, companies } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getPrimaryUnion } from '@/lib/union'
import NewInviteForm from './NewInviteForm'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  union_admin: '協会管理者',
  company_admin: '会社管理者',
  driver: 'ドライバー',
}
const STATUS_LABEL: Record<string, string> = {
  invited: '招待中',
  registered: '登録済み',
}

export default async function InvitesPage() {
  const union = await getPrimaryUnion()
  const invites = union
    ? await db.select().from(allowedEmails).where(eq(allowedEmails.unionId, union.id)).orderBy(desc(allowedEmails.createdAt))
    : []
  const companyList = union ? await db.select().from(companies).where(eq(companies.unionId, union.id)) : []
  const companyById = new Map(companyList.map(c => [c.id, c]))

  return (
    <>
      <div className="breadcrumb">協会管理者向け</div>
      <div className="page-title">ユーザー招待管理</div>
      <div className="page-desc">Googleアカウントの招待制許可リストを管理します（Google認証自体はまだ未実装のため、現時点ではリストの準備のみ）。</div>

      <div className="card">
        <table>
          <thead><tr><th>メールアドレス</th><th>所属</th><th>ロール</th><th>状態</th></tr></thead>
          <tbody>
            {invites.map(i => (
              <tr key={i.id}>
                <td>{i.email}</td>
                <td>{i.companyId ? (companyById.get(i.companyId)?.name ?? '—') : '（協会全体）'}</td>
                <td>{ROLE_LABEL[i.invitedRole]}</td>
                <td><span className={`pill ${i.status === 'registered' ? 'ok' : 'warn'}`}>{STATUS_LABEL[i.status]}</span></td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>まだ招待がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {union && <NewInviteForm unionId={union.id} companyList={companyList.map(c => ({ id: c.id, name: c.name }))} />}
    </>
  )
}
