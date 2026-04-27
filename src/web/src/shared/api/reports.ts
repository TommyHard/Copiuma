import { api } from './http';
import type { ReportItem, ReportTargetType } from '@/shared/types';

/**
 * /reports
 *   POST  { targetType, targetId, reason, details? }   — создать
 *   GET   /mine                                        — мои жалобы (история)
 *   POST  /{id}/resolve                                — модератор закрывает
 */

export interface CreateReportPayload {
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
    details?: string;
}

export async function createReport(payload: CreateReportPayload): Promise<ReportItem> {
    const r = await api.post<ReportItem>('/reports', payload);
    return r.data;
}

export async function listMyReports(): Promise<ReportItem[]> {
    const r = await api.get<ReportItem[]>('/reports/mine');
    return r.data;
}