/**
 * ScriptFunnelChart Component
 *
 * Displays script node performance and identifies bottlenecks
 * Shows nodes with low adherence or high compliance failures
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ScriptBottleneck } from '../hooks/useAnalytics';

interface ScriptFunnelChartProps {
  bottlenecks: ScriptBottleneck[] | null;
}

export const ScriptFunnelChart: React.FC<ScriptFunnelChartProps> = ({ bottlenecks }) => {
  if (!bottlenecks || bottlenecks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Script Bottlenecks</h3>
        <div className="text-center text-gray-500 py-8">
          No bottlenecks detected - all nodes performing well!
        </div>
      </div>
    );
  }

  // Prepare data for chart
  const chartData = bottlenecks.map((b) => ({
    node_id: b.node_id.length > 20 ? b.node_id.slice(0, 20) + '...' : b.node_id,
    full_node_id: b.node_id,
    adherence: b.avg_adherence_score ? Math.round(b.avg_adherence_score * 100) : 0,
    failures: b.compliance_failures,
    calls: b.calls_reached,
    status: b.status,
  }));

  const getBarColor = (status: string): string => {
    return status === 'critical' ? '#ef4444' : '#f59e0b';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <p className="font-semibold text-gray-900 mb-2">{data.full_node_id}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              <span className="font-medium">Calls Reached:</span> {data.calls}
            </p>
            <p className="text-orange-600">
              <span className="font-medium">Avg Adherence:</span> {data.adherence}%
            </p>
            <p className="text-red-600">
              <span className="font-medium">Compliance Failures:</span> {data.failures}
            </p>
            <p
              className={`font-semibold ${
                data.status === 'critical' ? 'text-red-600' : 'text-yellow-600'
              }`}
            >
              Status: {data.status.toUpperCase()}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900">Script Bottlenecks</h3>
        <p className="text-sm text-gray-600 mt-1">
          Nodes with low adherence scores or high compliance failures
        </p>
      </div>

      {/* Adherence Score Chart */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
          Average Adherence by Node
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="node_id"
              tick={{ fontSize: 11 }}
              width={150}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="adherence" name="Adherence Score (%)">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Compliance Failures Chart */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
          Compliance Failures by Node
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="node_id"
              tick={{ fontSize: 11 }}
              width={150}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="failures" fill="#dc2626" name="Compliance Failures" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottleneck Table */}
      <div className="overflow-x-auto">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
          Detailed Bottleneck Analysis
        </h4>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Node ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Calls Reached
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Avg Adherence
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Failures
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bottlenecks.map((b, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  {b.node_id}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {b.calls_reached}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`font-semibold ${
                      b.avg_adherence_score && b.avg_adherence_score >= 0.8
                        ? 'text-green-600'
                        : b.avg_adherence_score && b.avg_adherence_score >= 0.6
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {b.avg_adherence_score
                      ? `${Math.round(b.avg_adherence_score * 100)}%`
                      : 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`font-semibold ${
                      b.compliance_failures === 0
                        ? 'text-green-600'
                        : b.compliance_failures < 5
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {b.compliance_failures}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      b.status === 'critical'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {b.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recommendations */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          Coaching Recommendations
        </h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          {bottlenecks
            .filter((b) => b.status === 'critical')
            .slice(0, 3)
            .map((b, idx) => (
              <li key={idx}>
                Review <span className="font-mono">{b.node_id}</span> -{' '}
                {b.avg_adherence_score && b.avg_adherence_score < 0.6
                  ? 'agents struggling with adherence'
                  : 'high compliance failure rate'}
              </li>
            ))}
          {bottlenecks.filter((b) => b.status === 'critical').length === 0 && (
            <li>No critical issues detected - continue monitoring</li>
          )}
        </ul>
      </div>
    </div>
  );
};
