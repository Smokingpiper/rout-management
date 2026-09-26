import '@/components/shared.css'
import { getCurrentUser } from '@/lib/auth'
import ChangePasswordForm from './ChangePasswordForm'

export const dynamic = 'force-dynamic'

export default async function ChangePasswordPage() {
  const user = await getCurrentUser()

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>パスワード変更</h1>
      {user ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>{user.email} としてログイン中</p>
          <ChangePasswordForm requireCurrent={!user.mustChangePassword} />
        </>
      ) : (
        <p style={{ fontSize: 14 }}>ログインしてください。<a href="/login">ログインページへ</a></p>
      )}
    </div>
  )
}
