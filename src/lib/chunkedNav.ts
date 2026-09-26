// Google Mapsの経由地は実務上9件程度が上限（それを超えると経路が計算できない/エラーになる）。
// 数百件のスポットを1つのナビにまとめることはできないため、入力順のまま区間に分割し、
// 区間ごとに1本のGoogle Mapsナビ（現在地→区間内を経由→区間最後のスポット）を発行する。
const DEFAULT_CHUNK_SIZE = 9

export type NavChunk = {
  chunkIndex: number
  startOrder: number
  endOrder: number
  spotIds: string[]
  url: string
}

export function buildChunkedNavUrls<T extends { id: string; latitude: number; longitude: number; orderInRoute: number }>(
  spotsInOrder: T[],
  chunkSize = DEFAULT_CHUNK_SIZE,
): NavChunk[] {
  const chunks: NavChunk[] = []
  for (let i = 0; i < spotsInOrder.length; i += chunkSize) {
    const chunk = spotsInOrder.slice(i, i + chunkSize)
    const destination = chunk[chunk.length - 1]
    const waypoints = chunk.slice(0, -1)
    const params = new URLSearchParams({
      api: '1',
      destination: `${destination.latitude},${destination.longitude}`,
      travelmode: 'driving',
    })
    if (waypoints.length > 0) {
      params.set('waypoints', waypoints.map(w => `${w.latitude},${w.longitude}`).join('|'))
    }
    chunks.push({
      chunkIndex: chunks.length,
      startOrder: chunk[0].orderInRoute,
      endOrder: destination.orderInRoute,
      spotIds: chunk.map(s => s.id),
      url: `https://www.google.com/maps/dir/?${params.toString()}`,
    })
  }
  return chunks
}
