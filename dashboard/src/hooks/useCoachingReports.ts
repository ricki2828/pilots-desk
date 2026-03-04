/**
 * useCoachingReports Hook
 *
 * Fetches recent calls with analysis status, individual coaching reports,
 * and polls for status updates on pending/in-progress items.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { CallStatus } from '../components/StatusPill';
import type { ComplianceIssue } from '../components/ComplianceAudit';
import type { NodeScore } from '../components/NodeBreakdownTable';

export interface RecentCall {
  call_id: string;
  agent_id: string;
  agent_name: string;
  call_date: string;
  duration_seconds: number;
  status: CallStatus;
  overall_score: number | null;
  compliance_passed: boolean | null;
}

export interface ObjectionHandling {
  objection: string;
  handling: string;
  effectiveness: string;
}

export interface CloseAttempt {
  attempt_number: number;
  technique: string;
  outcome: string;
}

export interface KeyMoment {
  timestamp: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
}

export interface CoachingReport {
  call_id: string;
  agent_id: string;
  agent_name: string;
  call_date: string;
  duration_seconds: number;
  overall_score: number;
  rating: string;
  compliance_passed: boolean;
  compliance_issues: ComplianceIssue[];
  strengths: string[];
  improvements: string[];
  node_scores: NodeScore[];
  trend: 'up' | 'down' | 'stable';
  percentile: number;
  objection_handling: ObjectionHandling[];
  close_attempts: CloseAttempt[];
  key_moments: KeyMoment[];
  coaching_summary: string;
}

export interface Filters {
  agentId: string;
  dateFrom: string;
  dateTo: string;
  ratingFilter: string;
  complianceFilter: string;
}

interface UseCoachingReportsResult {
  calls: RecentCall[];
  isLoading: boolean;
  error: string | null;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  expandedReport: CoachingReport | null;
  reportLoading: boolean;
  fetchReport: (callId: string) => Promise<void>;
  clearReport: () => void;
  refresh: () => void;
}

export function useCoachingReports(): UseCoachingReportsResult {
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<CoachingReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    agentId: '',
    dateFrom: '',
    dateTo: '',
    ratingFilter: '',
    complianceFilter: '',
  });

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Map backend analysis_status to frontend CallStatus
  const mapStatus = (status: string | null): CallStatus => {
    switch (status) {
      case 'pending': return 'queued';
      case 'transcribing': return 'transcribing';
      case 'analyzing': return 'analyzing';
      case 'completed': return 'complete';
      case 'failed': return 'failed';
      default: return 'queued';
    }
  };

  const fetchCalls = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (filters.agentId) params.set('agent_id', filters.agentId);

      const response = await apiFetch(`/api/calls/recent?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch calls: ${response.status}`);
      }
      const data = await response.json();
      // Map backend response to frontend RecentCall shape
      const mapped: RecentCall[] = (data.calls || []).map((c: any) => ({
        call_id: c.call_id,
        agent_id: c.agent_id,
        agent_name: c.agent_name,
        call_date: c.started_at,
        duration_seconds: c.duration_seconds || 0,
        status: mapStatus(c.analysis_status),
        overall_score: c.overall_score ?? null,
        compliance_passed: null, // Not in recent list, loaded with report
      }));
      setCalls(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calls');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchReport = useCallback(async (callId: string) => {
    setReportLoading(true);
    try {
      const response = await apiFetch(`/api/calls/${callId}/report`);
      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.status}`);
      }
      const data = await response.json();
      setExpandedReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report');
    } finally {
      setReportLoading(false);
    }
  }, []);

  const clearReport = useCallback(() => {
    setExpandedReport(null);
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchCalls();
  }, [fetchCalls]);

  // Poll for status updates on pending/in-progress items
  useEffect(() => {
    const hasPending = calls.some(
      (c) => c.status === 'queued' || c.status === 'transcribing' || c.status === 'analyzing'
    );

    if (hasPending) {
      pollIntervalRef.current = setInterval(async () => {
        const pendingCalls = calls.filter(
          (c) => c.status === 'queued' || c.status === 'transcribing' || c.status === 'analyzing'
        );
        for (const call of pendingCalls) {
          try {
            const response = await apiFetch(`/api/calls/${call.call_id}/status`);
            if (response.ok) {
              const data = await response.json();
              setCalls((prev) =>
                prev.map((c) =>
                  c.call_id === call.call_id
                    ? { ...c, status: mapStatus(data.status) }
                    : c
                )
              );
            }
          } catch {
            // Silently ignore individual poll failures
          }
        }
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [calls]);

  // Fetch calls on mount and when filters change
  useEffect(() => {
    setIsLoading(true);
    fetchCalls();
  }, [fetchCalls]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchCalls, 30000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  return {
    calls,
    isLoading,
    error,
    filters,
    setFilters,
    expandedReport,
    reportLoading,
    fetchReport,
    clearReport,
    refresh,
  };
}
