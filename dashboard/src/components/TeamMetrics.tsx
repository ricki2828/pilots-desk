/**
 * TeamMetrics Component - Modern Operations
 *
 * Large KPI banner with color-coded metrics optimized for wallboard displays
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
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <div className="text-center text-slate-400">Loading team metrics...</div>
      </div>
    );
  }

  const getAdherenceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-amber-500';
    return 'text-red-500';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const adherenceScore = summary.avg_adherence_score;
  const adherencePercent = Math.round(adherenceScore * 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Active Calls - Blue accent */}
      <div className="bg-slate-800 border-2 border-blue-500/50 rounded-lg p-6 text-center">
        <div className="relative">
          <div className="text-5xl font-bold text-blue-500 mb-2">
            {activeCallCount}
          </div>
          {activeCallCount > 0 && (
            <div className="absolute top-0 right-0">
              <span className="relative flex h-3 w-3">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            </div>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Active Now
        </div>
      </div>

      {/* Avg Adherence - Color-coded */}
      <div className={`bg-slate-800 border-2 ${getBorderColor(adherenceScore)} rounded-lg p-6 text-center`}>
        <div className="text-5xl font-bold mb-2">
          <span className={getAdherenceColor(adherenceScore)}>{adherencePercent}%</span>
        </div>
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Avg Adherence
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ease-out ${getBarColor(adherenceScore)}`}
            style={{ width: `${adherencePercent}%` }}
          />
        </div>
      </div>

      {/* Compliance Status */}
      <div className={`bg-slate-800 border-2 ${
        summary.compliance_violations === 0
          ? 'border-green-500/50'
          : 'border-red-500/50'
      } rounded-lg p-6 text-center`}>
        <div className="text-5xl font-bold mb-2">
          <span className={summary.compliance_violations === 0 ? 'text-green-500' : 'text-red-500'}>
            {summary.compliance_violations}
          </span>
        </div>
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Violations
        </div>
        {summary.compliance_violations === 0 && (
          <div className="mt-2">
            <svg className="w-5 h-5 text-green-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Avg Talk Time */}
      <div className="bg-slate-800 border-2 border-slate-700 rounded-lg p-6 text-center">
        <div className="text-5xl font-bold text-slate-300 mb-2 font-mono">
          {formatDuration(summary.avg_duration_seconds)}
        </div>
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Avg Talk Time
        </div>
      </div>
    </div>
  );
};

// Helper functions for border and bar colors
function getBorderColor(score: number): string {
  if (score >= 0.8) return 'border-green-500/50';
  if (score >= 0.6) return 'border-amber-500/50';
  return 'border-red-500/50';
}

function getBarColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-amber-500';
  return 'bg-red-500';
}
