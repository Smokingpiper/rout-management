// Google Maps・Apple Mapsともに、1回のナビに入れられる経由地の数には実務上の上限がある
// （Google Mapsはモバイルブラウザ経由で3件、ネイティブアプリ経由で9件など環境依存）。
// 数百件のスポットを1つのナビにまとめることはできないため、入力順のまま区間に分割し、
// 区間ごとに1本のナビ（現在地→区間内を経由→区間最後のスポット）を発行する。
const DEFAULT_CHUNK_SIZE = 9

export type NavChunk = {
  chunkIndex: number
  startOrder: number
  endOrder: number
  spotIds: string[]
  url: string
}

type SpotLike = { id: string; latitude: number; longitude: number; orderInRoute: number }

function buildGoogleUrl(destination: SpotLike, waypoints: SpotLike[]): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(w => `${w.latitude},${w.longitude}`).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function buildAppleUrl(destination: SpotLike, waypoints: SpotLike[]): string {
  const params = new URLSearchParams({
    destination: `${destination.latitude},${destination.longitude}`,
    mode: 'driving',
  })
  for (const w of waypoints) params.append('waypoint', `${w.latitude},${w.longitude}`)
  return `https://maps.apple.com/directions?${params.toString()}`
}

export function buildChunkedNavUrls<T extends SpotLike>(
  spotsInOrder: T[],
  isApple: boolean,
  chunkSize = DEFAULT_CHUNK_SIZE,
): NavChunk[] {
  const chunks: NavChunk[] = []
  for (let i = 0; i < spotsInOrder.length; i += chunkSize) {
    const chunk = spotsInOrder.slice(i, i + chunkSize)
    const destination = chunk[chunk.length - 1]
    const waypoints = chunk.slice(0, -1)
    chunks.push({
      chunkIndex: chunks.length,
      startOrder: chunk[0].orderInRoute,
      endOrder: destination.orderInRoute,
      spotIds: chunk.map(s => s.id),
      url: isApple ? buildAppleUrl(destination, waypoints) : buildGoogleUrl(destination, waypoints),
    })
  }
  return chunks
}
