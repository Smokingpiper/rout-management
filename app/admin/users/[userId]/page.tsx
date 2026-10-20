import { db } from '@/db/client'
import { users, userRoutes, routes, areas } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { formatRoles } from '@/lib/roleLabel'
import { getLoginStatuses, LOGIN_STATE_LABEL, LOGIN_STATE_HINT, LOGIN_STATE_PILL } from '@/lib/loginStatus'
import UserRolesForm from './UserRolesForm'
import ResetPasswordCard from './ResetPasswordCard'

export const dynamic = 'force-dynamic'

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) notFound()

  const loginStatus = (await getLoginStatuses([user])).get(user.id)!

  const assignments = await db.select().from(userRoutes).where(eq(userRoutes.userId, userId))
  const routeIds = assignments.map(a => a.routeId)
  const routeList = routeIds.length ? await db.select().from(routes).where(inArray(routes.id, routeIds)) : []
  const areaIds = [...new Set(routeList.map(r => r.areaId))]
  const areaList = areaIds.length ? await db.select().from(areas).where(inArray(areas.id, areaIds)) : []
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const routeById = new Map(routeList.map(r => [r.id, r]))

  const rows = assignments
    .map(a => ({
      routeId: a.routeId,
      route: routeById.get(a.routeId),
      areaName: routeById.get(a.routeId) ? areaById.get(routeById.get(a.routeId)!.areaId)?.name ?? '' : '',
      daysOfWeek: (a.daysOfWeek as number[]).slice().sort(),
    }))
    .sort((a, b) => (a.areaName + (a.route?.name ?? '')).localeCompare(b.areaName + (b.route?.name ?? ''), 'ja'))

  return (
    <>
      <div className="breadcrumb"><a href="/admin/users">ユーザー管理</a> / {user.name || user.email}</div>
      <div className="page-title">{user.name || user.email}</div>
      <div className="page-desc">{user.email} ・ {formatRoles(user.roles as string[], user.adminRank)}</div>

      <div className="card" style={{ display: 'flex', gap: 10 }}>
        <a className="btn primary" href={`/admin/users/${userId}/schedule`}>スケジュール設定</a>
      </div>

      <div className="card">
        <div className="card-title">ログイン状況</div>
        <span className={`pill ${LOGIN_STATE_PILL[loginStatus.state]}`}>{LOGIN_STATE_LABEL[loginStatus.state]}</span>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 8 }}>{LOGIN_STATE_HINT[loginStatus.state]}</p>
        {loginStatus.lastLoginAt && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            直近のログイン: {loginStatus.lastLoginAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
          </p>
        )}
      </div>

      <ResetPasswordCard userId={userId} userLabel={user.name || user.email || 'このユーザー'} />

      <UserRolesForm
        userId={userId}
        initialRoles={(user.roles as string[]) ?? []}
        initialRank={user.adminRank}
        initialSealName={user.sealName}
        userName={user.name}
        userEmail={user.email}
      />

      <div className="card">
        <div className="card-title">担当ルート（{rows.length}件）</div>
        <table>
          <thead>
            <tr><th>ルート</th><th>曜日</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.routeId}>
                <td>{r.areaName} — {r.route?.name ?? '（削除済み）'}</td>
                <td>{r.daysOfWeek.length > 0 ? r.daysOfWeek.map(d => DAY_LABELS[d]).join('・') : <span style={{ color: 'var(--text-3)' }}>未設定</span>}</td>
                <td><a className="btn sm" href={`/admin/routes/${r.routeId}`}>ルート詳細</a></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>まだ担当ルートが設定されていません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
