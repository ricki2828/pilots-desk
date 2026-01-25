/**
 * AnalyticsView Page
 *
 * Business Intelligence dashboard with historical data analysis
 * Shows call trends, agent comparisons, and script bottlenecks
 */

import React, { useState } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { CallTrendChart } from '../components/CallTrendChart';
import { AgentComparisonTable } from '../components/AgentComparisonTable';
import { ScriptFunnelChart } from '../components/ScriptFunnelChart';
import { DateRangeFilter } from '../components/DateRangeFilter';

interface AnalyticsViewProps {
  clientId?: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  clientId = 'SKY_TV_NZ',
}) => {
  const [selectedDays, setSelectedDays] = useState(30);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const { callTrends, agentPerformance, scriptBottlenecks, isLoading, error, refetch } =
    useAnalytics(clientId, null, selectedDays);

  const handleDaysChange = (days: number) => {
    setSelectedDays(days);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Business Intelligence Dashboard
            </h1>
            <p className="text-sm text-gray-600">Client: {clientId}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Chart Type Toggle */}
            <div className="flex bg-white rounded-lg shadow-sm p-1">
              <button
                onClick={() => setChartType('line')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  chartType === 'line'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Line Chart
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  chartType === 'bar'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Bar Chart
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
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

        {/* Error Banner */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-400 text-red-800 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="mb-6">
        <DateRangeFilter selectedDays={selectedDays} onDaysChange={handleDaysChange} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Call Trends Chart */}
          <div>
            <CallTrendChart data={callTrends} type={chartType} />
          </div>

          {/* Agent Comparison Table */}
          <div>
            <AgentComparisonTable agents={agentPerformance} />
          </div>

          {/* Script Bottlenecks */}
          <div>
            <ScriptFunnelChart bottlenecks={scriptBottlenecks} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Data updated in real-time from PostgreSQL database</p>
        <p className="mt-1">
          Last refreshed: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};
