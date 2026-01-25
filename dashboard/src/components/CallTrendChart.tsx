/**
 * CallTrendChart Component
 *
 * Displays historical trends for calls, sales, and adherence scores
 * Uses Recharts for visualization
 */

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { CallTrend } from '../hooks/useAnalytics';

interface CallTrendChartProps {
  data: CallTrend[] | null;
  type?: 'line' | 'bar';
}

export const CallTrendChart: React.FC<CallTrendChartProps> = ({ data, type = 'line' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">No trend data available</div>
      </div>
    );
  }

  // Format dates for display
  const formattedData = data.map((d) => ({
    ...d,
    displayDate: format(parseISO(d.date), 'MMM dd'),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <p className="font-semibold text-gray-900 mb-2">
            {format(parseISO(data.date), 'MMMM dd, yyyy')}
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              <span className="font-medium">Total Calls:</span> {data.total_calls}
            </p>
            <p className="text-green-600">
              <span className="font-medium">Sales:</span> {data.sales}
            </p>
            <p className="text-purple-600">
              <span className="font-medium">Conversion:</span> {data.conversion_rate.toFixed(1)}%
            </p>
            <p className="text-orange-600">
              <span className="font-medium">Avg Adherence:</span> {data.avg_adherence.toFixed(0)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Call Trends</h3>

      {/* Calls and Sales Chart */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
          Calls & Sales Volume
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          {type === 'line' ? (
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12 }}
                stroke="#999"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#999" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="total_calls"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Total Calls"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#10b981"
                strokeWidth={2}
                name="Sales"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12 }}
                stroke="#999"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#999" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="total_calls" fill="#3b82f6" name="Total Calls" />
              <Bar dataKey="sales" fill="#10b981" name="Sales" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Conversion Rate Chart */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
          Conversion Rate
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              stroke="#999"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#999"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="conversion_rate"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Conversion Rate (%)"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Adherence Score Chart */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
          Average Adherence Score
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              stroke="#999"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#999"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="avg_adherence"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Avg Adherence (%)"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
