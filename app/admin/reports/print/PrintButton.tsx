'use client'

export default function PrintButton({ disabled }: { disabled: boolean }) {
  return (
    <button className="btn primary" disabled={disabled} onClick={() => window.print()}>
      🖨 印刷する
    </button>
  )
}
