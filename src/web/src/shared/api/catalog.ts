import { api } from './http';
import type {
    TrackDetail,
    TrackListItem,
    TrackProcessingStatusResponse,
    WaveformResponse,
} from '@/shared/types';

export async function listTracks(page = 1, pageSize = 20): Promise<TrackListItem[]> {
    const r = await api.get<TrackListItem[]>('/tracks', { params: { page, pageSize } });
    return r.data;
}

export async function searchTracks(q: string): Promise<TrackListItem[]> {
    const r = await api.get<TrackListItem[]>('/tracks/search', { params: { q } });
    return r.data;
}

export async function getTrack(id: string): Promise<TrackDetail> {
    const r = await api.get<TrackDetail>(`/tracks/${id}`);
    return r.data;
}

export async function getTrackStatus(id: string): Promise<TrackProcessingStatusResponse> {
    const r = await api.get<TrackProcessingStatusResponse>(`/tracks/${id}/status`);
    return r.data;
}

export async function getWaveform(id: string): Promise<WaveformResponse> {
    const r = await api.get<WaveformResponse>(`/tracks/${id}/waveform`);
    return r.data;
}

export function hlsMasterUrl(trackId: string): string {
    const base = (import.meta.env.VITE_GATEWAY_URL || '/api').replace(/\/$/, '');
    return `${base}/tracks/${trackId}/hls/master.m3u8`;
}