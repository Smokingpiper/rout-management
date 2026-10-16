import { sealTextFor, formatStampDate } from './seal'
import type { StampInfo } from '@/components/ApprovalStamps'

type StampUser = { id: string; name: string | null; email: string | null; sealName: string | null }

export type ReportStampSource = {
  status: string
  submittedBy: string | null
  submittedAt: Date | null
  chiefStampedBy: string | null
  chiefStampedAt: Date | null
  approvedBy: string | null
  approvedAt: Date | null
}

// 日報の押印欄の内容を組み立てる。担当者=提出したドライバー、係長=係長の押印、課長=承認者
export function stampsFor(report: ReportStampSource, userById: Map<string, StampUser>): { manager: StampInfo; chief: StampInfo; staff: StampInfo } {
  const stamp = (userId: string | null, at: Date | null, fallbackText = ''): StampInfo => {
    if (!userId) return null
    const text = sealTextFor(userById.get(userId)) || fallbackText
    return text ? { text, date: formatStampDate(at) } : null
  }
  return {
    staff: stamp(report.submittedBy, report.submittedAt),
    chief: stamp(report.chiefStampedBy, report.chiefStampedAt),
    // 承認者が記録されていない古い承認済み日報は「承認」印で表示する
    manager: report.status === 'approved'
      ? (report.approvedBy ? stamp(report.approvedBy, report.approvedAt, '承認') : { text: '承認', date: formatStampDate(report.approvedAt) })
      : null,
  }
}

export function stampUserIds(report: ReportStampSource): string[] {
  return [report.submittedBy, report.chiefStampedBy, report.approvedBy].filter((id): id is string => !!id)
}
