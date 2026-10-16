// 電子印鑑（朱色の丸印）。文字数に応じて縦並び／2x2に配置する
export default function SealStamp({ text, size = 44 }: { text: string; size?: number }) {
  const chars = Array.from(text)
  const color = '#D13438'

  let layout: { ch: string; x: number; y: number; fs: number }[] = []
  if (chars.length <= 1) {
    layout = chars.map(ch => ({ ch, x: 50, y: 50, fs: 46 }))
  } else if (chars.length === 2) {
    layout = [
      { ch: chars[0], x: 50, y: 36, fs: 32 },
      { ch: chars[1], x: 50, y: 68, fs: 32 },
    ]
  } else if (chars.length === 3) {
    layout = [
      { ch: chars[0], x: 50, y: 28, fs: 24 },
      { ch: chars[1], x: 50, y: 52, fs: 24 },
      { ch: chars[2], x: 50, y: 76, fs: 24 },
    ]
  } else {
    layout = [
      { ch: chars[0], x: 66, y: 38, fs: 26 },
      { ch: chars[1], x: 66, y: 68, fs: 26 },
      { ch: chars[2], x: 34, y: 38, fs: 26 },
      { ch: chars[3], x: 34, y: 68, fs: 26 },
    ]
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${text} 印`} style={{ display: 'block' }}>
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="4.5" />
      {layout.map((c, i) => (
        <text
          key={i} x={c.x} y={c.y} fontSize={c.fs} fontWeight="700" fill={color}
          textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif" }}
        >
          {c.ch}
        </text>
      ))}
    </svg>
  )
}
