import '@/components/shared.css'
import LoginForm from './LoginForm'

export const metadata = { title: 'ログイン | ゴミ収支管理アプリ' }

export default function LoginPage() {
  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 20 }}>🗑 ゴミ収支管理 ログイン</h1>
      <LoginForm />
    </div>
  )
}
