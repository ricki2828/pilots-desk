/**
 * TeamMetrics Component
 *
 * Displays aggregate team performance metrics for the last 7 days
 */

import React from 'react';
import { TeamSummary } from '../hooks/useActiveCallsWS';

interface TeamMetricsProps {
  summary: TeamSummary | null;
  activeCallCount: number;
}

export const TeamMetrics: React.FC<TeamMetricsProps> = ({ summary, activeCallCount }) => {
  if (!summary) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">Loading team metrics...</div>
      </div>
    );
  }

  const getConversionColor = (rate: number): string => {
    if (rate >= 30) return 'text-green-600';
    if (rate >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAdherenceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const conversionColor = getConversionColor(summary.conversion_rate);
  const adherenceColor = getAdherenceColor(summary.avg_adherence_score);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Team Performance (Last 7 Days)
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Active Calls */}
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {activeCallCount}
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">
            Active Now
          </div>
        </div>

        {/* Total Calls */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">
            {summary.total_calls}
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">
            Total Calls
          </div>
        </div>

        {/* Sales / Conversion */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">
            {summary.sales}
          </div>
          <div className={`text-sm font-semibold uppercase tracking-wide mt-1 ${conversionColor}`}>
            {summary.conversion_rate.toFixed(1)}% Conv
          </div>
        </div>

        {/* Avg Adherence */}
        <div className="text-center">
          <div className={`text-3xl font-bold ${adherenceColor}`}>
            {Math.round(summary.avg_adherence_score * 100)}%
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">
            Avg Adherence
          </div>
        </div>
      </div>

      {/* Bottom Row: Duration + Violations */}
      <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-700">
            {formatDuration(summary.avg_duration_seconds)}
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">
            Avg Call Duration
          </div>
        </div>

        <div className="text-center">
          <div
            className={`text-2xl font-semibold ${
              summary.compliance_violations === 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {summary.compliance_violations}
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">
            Compliance Violations
          </div>
        </div>
      </div>
    </div>
  );
};
