/**
 * CoachingReportsView Page
 *
 * Primary view showing recent calls with coaching analysis.
 * Supports filtering, expandable report cards, and auto-refresh.
 */

import React, { useState } from 'react';
import { useCoachingReports } from '../hooks/useCoachingReports';
import { StatusPill } from '../components/StatusPill';
import { ScoreGauge } from '../components/ScoreGauge';
import { CoachingReportCard } from '../components/CoachingReportCard';

interface CoachingReportsViewProps {
  clientId?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const CoachingReportsView: React.FC<CoachingReportsViewProps> = ({
  clientId: _clientId = 'SKY_TV_NZ',
}) => {
  const {
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
  } = useCoachingReports();

  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  const handleRowClick = async (callId: string) => {
    if (expandedCallId === callId) {
      setExpandedCallId(null);
      clearReport();
      return;
    }
    setExpandedCallId(callId);
    await fetchReport(callId);
  };

  const handleCloseReport = () => {
    setExpandedCallId(null);
    clearReport();
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header Bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Coaching Reports</h1>
            <p className="text-sm text-slate-400 mt-1">
              Review call analyses and coaching feedback
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Agent Filter */}
          <input
            type="text"
            placeholder="Agent name or ID..."
            value={filters.agentId}
            onChange={(e) => setFilters((f) => ({ ...f, agentId: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
          />

          {/* Date From */}
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
          />

          {/* Date To */}
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
          />

          {/* Rating Filter */}
          <select
            value={filters.ratingFilter}
            onChange={(e) => setFilters((f) => ({ ...f, ratingFilter: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Ratings</option>
            <option value="excellent">Excellent (90+)</option>
            <option value="great">Great (80+)</option>
            <option value="good">Good (65+)</option>
            <option value="acceptable">Acceptable (50+)</option>
            <option value="needs_work">Needs Work (&lt;50)</option>
          </select>

          {/* Compliance Filter */}
          <select
            value={filters.complianceFilter}
            onChange={(e) => setFilters((f) => ({ ...f, complianceFilter: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Compliance</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Clear Filters */}
          {(filters.agentId || filters.dateFrom || filters.dateTo || filters.ratingFilter || filters.complianceFilter) && (
            <button
              onClick={() =>
                setFilters({ agentId: '', dateFrom: '', dateTo: '', ratingFilter: '', complianceFilter: '' })
              }
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4 bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      )}

      {/* Main Content */}
      <div className="px-6 py-6">
        {isLoading && calls.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4" />
            <p className="text-slate-400">Loading coaching reports...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
            <svg
              className="w-16 h-16 text-slate-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Reports Found</h3>
            <p className="text-slate-500">
              No coaching reports match your current filters. Try adjusting filters or check back after calls are processed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <div key={call.call_id}>
                {/* Call Row */}
                <div
                  onClick={() => call.status === 'complete' ? handleRowClick(call.call_id) : undefined}
                  className={`bg-slate-800 rounded-xl border border-slate-700 p-4 transition-all ${
                    call.status === 'complete'
                      ? 'cursor-pointer hover:border-slate-600 hover:bg-slate-800/80'
                      : 'opacity-80'
                  } ${expandedCallId === call.call_id ? 'border-blue-500/50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm flex-shrink-0">
                      {call.agent_name.charAt(0)}
                    </div>

                    {/* Agent + Time */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{call.agent_name}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(call.call_date).toLocaleString()} -- {formatDuration(call.duration_seconds)}
                      </p>
                    </div>

                    {/* Status Pill */}
                    <StatusPill status={call.status} />

                    {/* Score */}
                    {call.overall_score !== null ? (
                      <ScoreGauge score={call.overall_score} size="sm" />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center">
                        <span className="text-xs text-slate-500">--</span>
                      </div>
                    )}

                    {/* Compliance Badge */}
                    <div className="flex-shrink-0">
                      {call.compliance_passed === null ? (
                        <span className="text-xs text-slate-500">--</span>
                      ) : call.compliance_passed ? (
                        <span className="text-green-400 text-lg" title="Compliance Passed">
                          &#10003;
                        </span>
                      ) : (
                        <span className="text-red-400 text-lg" title="Compliance Failed">
                          &#10007;
                        </span>
                      )}
                    </div>

                    {/* Expand Arrow */}
                    {call.status === 'complete' && (
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                          expandedCallId === call.call_id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Expanded Report */}
                {expandedCallId === call.call_id && (
                  <div className="mt-2">
                    {reportLoading ? (
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
                        <p className="text-sm text-slate-400">Loading report...</p>
                      </div>
                    ) : expandedReport ? (
                      <CoachingReportCard report={expandedReport} onClose={handleCloseReport} />
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-4 text-center">
        <p className="text-sm text-slate-500">
          Auto-refreshes every 30 seconds -- Click completed calls to view full coaching report
        </p>
      </div>
    </div>
  );
};
