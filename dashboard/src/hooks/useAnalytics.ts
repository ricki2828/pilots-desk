/**
 * Analytics hook for fetching historical data
 *
 * Provides data for BI dashboards, trend charts, and reports
 */

import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { apiFetch } from '../lib/api';

export interface DailyMetric {
  date: string;
  calls: number;
  sales: number;
  avg_adherence: number | null;
  violations: number;
}

export interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  total_calls: number;
  sales: number;
  conversion_rate: number;
  avg_adherence: number;
  violations: number;
}

export interface ScriptBottleneck {
  node_id: string;
  calls_reached: number;
  avg_adherence_score: number | null;
  compliance_failures: number;
  status: 'critical' | 'warning';
}

export interface CallTrend {
  date: string;
  total_calls: number;
  sales: number;
  conversion_rate: number;
  avg_adherence: number;
}

interface UseAnalyticsResult {
  dailyMetrics: DailyMetric[] | null;
  agentPerformance: AgentPerformance[] | null;
  scriptBottlenecks: ScriptBottleneck[] | null;
  callTrends: CallTrend[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAnalytics(
  clientId: string,
  agentId: string | null = null,
  days: number = 30
): UseAnalyticsResult {
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[] | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[] | null>(null);
  const [scriptBottlenecks, setScriptBottlenecks] = useState<ScriptBottleneck[] | null>(null);
  const [callTrends, setCallTrends] = useState<CallTrend[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch agent-specific daily metrics or all agents
      if (agentId) {
        const response = await apiFetch(
          `/api/analytics/agent/${agentId}/performance?days=${days}`
        );
        if (response.ok) {
          const data = await response.json();
          setDailyMetrics(data.daily_metrics);
        }
      }

      // Fetch agent performance comparison (top performers)
      const teamResponse = await apiFetch(
        `/api/analytics/supervisor/team-summary?client_id=${clientId}&days=${days}`
      );
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();

        // Transform top_performers into AgentPerformance format
        const performers: AgentPerformance[] = teamData.top_performers.map((p: any) => ({
          agent_id: '', // Not provided by current endpoint
          agent_name: p.name,
          total_calls: p.calls,
          sales: 0, // Not provided by current endpoint
          conversion_rate: 0,
          avg_adherence: p.avg_score,
          violations: 0,
        }));
        setAgentPerformance(performers);
      }

      // Fetch script bottlenecks
      const bottleneckResponse = await apiFetch(
        `/api/analytics/script/bottlenecks?client_id=${clientId}&days=${days}&min_calls=10`
      );
      if (bottleneckResponse.ok) {
        const bottleneckData = await bottleneckResponse.json();
        setScriptBottlenecks(bottleneckData.bottlenecks);
      }

      // Generate call trends from daily summaries
      const trends: CallTrend[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const summaryResponse = await apiFetch(
          `/api/analytics/reports/daily-summary?client_id=${clientId}&target_date=${date}`
        );

        if (summaryResponse.ok) {
          const summary = await summaryResponse.json();
          trends.push({
            date,
            total_calls: summary.summary.total_calls,
            sales: summary.summary.sales,
            conversion_rate: summary.summary.conversion_rate,
            avg_adherence: summary.summary.avg_adherence_score,
          });
        }
      }
      setCallTrends(trends);

    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setIsLoading(false);
    }
  }, [clientId, agentId, days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    dailyMetrics,
    agentPerformance,
    scriptBottlenecks,
    callTrends,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
}
