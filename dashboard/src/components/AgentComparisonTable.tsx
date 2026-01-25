/**
 * AgentComparisonTable Component
 *
 * Displays side-by-side comparison of agent performance metrics
 * with sortable columns and color-coded indicators
 */

import React, { useState, useMemo } from 'react';
import { AgentPerformance } from '../hooks/useAnalytics';

interface AgentComparisonTableProps {
  agents: AgentPerformance[] | null;
}

type SortColumn = 'name' | 'calls' | 'sales' | 'conversion' | 'adherence' | 'violations';
type SortDirection = 'asc' | 'desc';

export const AgentComparisonTable: React.FC<AgentComparisonTableProps> = ({ agents }) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('adherence');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedAgents = useMemo(() => {
    if (!agents) return [];

    return [...agents].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortColumn) {
        case 'name':
          aVal = a.agent_name;
          bVal = b.agent_name;
          break;
        case 'calls':
          aVal = a.total_calls;
          bVal = b.total_calls;
          break;
        case 'sales':
          aVal = a.sales;
          bVal = b.sales;
          break;
        case 'conversion':
          aVal = a.conversion_rate;
          bVal = b.conversion_rate;
          break;
        case 'adherence':
          aVal = a.avg_adherence;
          bVal = b.avg_adherence;
          break;
        case 'violations':
          aVal = a.violations;
          bVal = b.violations;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [agents, sortColumn, sortDirection]);

  const getAdherenceColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 font-semibold';
    if (score >= 60) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  const getConversionColor = (rate: number): string => {
    if (rate >= 30) return 'text-green-600';
    if (rate >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h5a1 1 0 000-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM13 16a1 1 0 102 0v-5.586l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 101.414 1.414L13 10.414V16z" />
      </svg>
    );
  };

  if (!agents || agents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">No agent data available</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Agent Performance Comparison</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Agent Name
                  <SortIcon column="name" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('calls')}
              >
                <div className="flex items-center gap-2">
                  Total Calls
                  <SortIcon column="calls" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('sales')}
              >
                <div className="flex items-center gap-2">
                  Sales
                  <SortIcon column="sales" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('conversion')}
              >
                <div className="flex items-center gap-2">
                  Conversion
                  <SortIcon column="conversion" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('adherence')}
              >
                <div className="flex items-center gap-2">
                  Avg Adherence
                  <SortIcon column="adherence" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('violations')}
              >
                <div className="flex items-center gap-2">
                  Violations
                  <SortIcon column="violations" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAgents.map((agent, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {agent.agent_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{agent.total_calls}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{agent.sales}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${getConversionColor(agent.conversion_rate)}`}>
                    {agent.conversion_rate.toFixed(1)}%
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${getAdherenceColor(agent.avg_adherence)}`}>
                    {agent.avg_adherence.toFixed(0)}%
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div
                    className={`text-sm ${
                      agent.violations === 0
                        ? 'text-green-600'
                        : agent.violations < 5
                        ? 'text-yellow-600'
                        : 'text-red-600 font-semibold'
                    }`}
                  >
                    {agent.violations}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4 border-t pt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {sortedAgents.reduce((sum, a) => sum + a.total_calls, 0)}
          </div>
          <div className="text-xs text-gray-600 uppercase">Total Calls</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {sortedAgents.reduce((sum, a) => sum + a.sales, 0)}
          </div>
          <div className="text-xs text-gray-600 uppercase">Total Sales</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {(
              sortedAgents.reduce((sum, a) => sum + a.avg_adherence, 0) /
              sortedAgents.length
            ).toFixed(0)}
            %
          </div>
          <div className="text-xs text-gray-600 uppercase">Avg Adherence</div>
        </div>
        <div className="text-center">
          <div
            className={`text-2xl font-bold ${
              sortedAgents.reduce((sum, a) => sum + a.violations, 0) === 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {sortedAgents.reduce((sum, a) => sum + a.violations, 0)}
          </div>
          <div className="text-xs text-gray-600 uppercase">Total Violations</div>
        </div>
      </div>
    </div>
  );
};
