/**
 * Shared API client with authentication
 */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8010';
const API_KEY = import.meta.env.VITE_API_KEY || '';

export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'X-API-Key': API_KEY,
    ...extra,
  };
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...apiHeaders(),
      ...init?.headers,
    },
  });
}

export function wsUrl(path: string): string {
  const base = API_URL.replace(/^http/, 'ws');
  return `${base}${path}?api_key=${encodeURIComponent(API_KEY)}`;
}

// --- Coaching Reports API ---

export async function fetchRecentCalls(
  params: Record<string, string> = {}
): Promise<Response> {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/api/calls/recent${qs ? `?${qs}` : ''}`);
}

export async function fetchCallReport(callId: string): Promise<Response> {
  return apiFetch(`/api/calls/${callId}/report`);
}

export async function fetchCallStatus(callId: string): Promise<Response> {
  return apiFetch(`/api/calls/${callId}/status`);
}

export async function fetchAgentReportHistory(
  agentId: string,
  days: number = 30
): Promise<Response> {
  return apiFetch(`/api/calls/recent?agent_id=${encodeURIComponent(agentId)}&limit=50&days=${days}`);
}

export async function fetchTeamSummary(
  clientId: string,
  days: number = 7
): Promise<Response> {
  return apiFetch(`/api/analytics/supervisor/team-summary?client_id=${encodeURIComponent(clientId)}&days=${days}`);
}
