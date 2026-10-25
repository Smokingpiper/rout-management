// 収集物マスタ（大分類＋内訳）の扱い。大分類=parentIdがnull、内訳=parentIdが大分類のid
export type WasteTypeRow = { id: string; name: string; parentId: string | null }

export function topLevelTypes<T extends WasteTypeRow>(list: T[]): T[] {
  return list.filter(w => !w.parentId).sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

export function childrenOf<T extends WasteTypeRow>(list: T[], parentId: string): T[] {
  return list.filter(w => w.parentId === parentId)
}

// 表示用の名前。内訳は「古紙／新聞」のように大分類つきにする
export function wasteTypeLabel(id: string | null | undefined, byId: Map<string, WasteTypeRow>): string {
  if (!id) return ''
  const w = byId.get(id)
  if (!w) return ''
  const parent = w.parentId ? byId.get(w.parentId) : null
  return parent ? `${parent.name}／${w.name}` : w.name
}

// 大分類→内訳の順に並べた一覧（マスタ画面・選択肢用）。内訳は名前順
export function orderedTree<T extends WasteTypeRow>(list: T[]): { item: T; depth: 0 | 1 }[] {
  const out: { item: T; depth: 0 | 1 }[] = []
  for (const top of topLevelTypes(list)) {
    out.push({ item: top, depth: 0 })
    for (const c of childrenOf(list, top.id).sort((a, b) => a.name.localeCompare(b.name, 'ja'))) out.push({ item: c, depth: 1 })
  }
  return out
}

// 重さを入力する対象。内訳がある大分類は内訳ごと、なければ大分類自体
export function weightTargets<T extends WasteTypeRow>(list: T[], categoryId: string): T[] {
  const kids = childrenOf(list, categoryId)
  if (kids.length > 0) return kids.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  const self = list.find(w => w.id === categoryId)
  return self ? [self] : []
}
