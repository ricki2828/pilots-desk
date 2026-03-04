/**
 * WebSocket hook for real-time active calls monitoring
 *
 * Connects to supervisor WebSocket endpoint and receives live updates
 * for all active calls across the team
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, wsUrl } from '../lib/api';

export interface ActiveCall {
  call_id: string;
  agent_id: string;
  agent_name: string;
  current_node_id: string;
  current_node_text: string;
  latest_adherence_score: number | null;
  compliance_ok: boolean;
  started_at: string;
  duration_seconds: number;
  last_updated: string;
}

export interface TeamSummary {
  total_calls: number;
  sales: number;
  conversion_rate: number;
  avg_adherence_score: number;
  avg_duration_seconds: number;
  compliance_violations: number;
}

interface UseActiveCallsWSResult {
  activeCalls: ActiveCall[];
  teamSummary: TeamSummary | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useActiveCallsWS(clientId: string): UseActiveCallsWSResult {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const fetchTeamSummary = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/api/analytics/supervisor/team-summary?client_id=${clientId}&days=7`
      );
      if (response.ok) {
        const data = await response.json();
        setTeamSummary(data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch team summary:', err);
    }
  }, [clientId]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(wsUrl(`/api/supervisor/ws/${clientId}`));

    ws.onopen = () => {
      console.log('[SupervisorWS] Connected');
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Fetch initial data
      fetchTeamSummary();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'active_calls_update') {
          setActiveCalls(data.active_calls);
        } else if (data.type === 'call_started') {
          setActiveCalls((prev) => [...prev, data.call]);
        } else if (data.type === 'call_updated') {
          setActiveCalls((prev) =>
            prev.map((call) =>
              call.call_id === data.call.call_id ? data.call : call
            )
          );
        } else if (data.type === 'call_ended') {
          setActiveCalls((prev) =>
            prev.filter((call) => call.call_id !== data.call_id)
          );
          // Refresh team summary when call ends
          fetchTeamSummary();
        }
      } catch (err) {
        console.error('[SupervisorWS] Failed to parse message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('[SupervisorWS] Error:', event);
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      console.log('[SupervisorWS] Disconnected:', event.code, event.reason);
      setIsConnected(false);

      // Exponential backoff reconnection
      if (reconnectAttemptsRef.current < 10) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[SupervisorWS] Reconnecting in ${delay}ms...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      } else {
        setError('Failed to connect after multiple attempts');
      }
    };

    wsRef.current = ws;
  }, [clientId, fetchTeamSummary]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    // Refresh team summary every 60 seconds
    const summaryInterval = setInterval(fetchTeamSummary, 60000);

    return () => {
      clearInterval(summaryInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, fetchTeamSummary]);

  return {
    activeCalls,
    teamSummary,
    isConnected,
    error,
    reconnect,
  };
}
