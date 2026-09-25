import './shared.css'
import Sidebar from './Sidebar'
import AnnotationLayer from './AnnotationLayer'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-body">
      <Sidebar />
      <main className="app-main">
        {children}
        <AnnotationLayer />
      </main>
    </div>
  )
}
