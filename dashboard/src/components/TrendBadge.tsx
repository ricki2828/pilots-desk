/**
 * TrendBadge Component
 *
 * Arrow + percentile rank badge showing performance trend
 */

import React from 'react';

interface TrendBadgeProps {
  trend: 'up' | 'down' | 'stable';
  percentile?: number; // e.g., 25 means "Top 25%"
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ trend, percentile }) => {
  const trendConfig = {
    up: { arrow: '\u2191', color: 'text-green-400', bg: 'bg-green-500/10', label: 'Improving' },
    down: { arrow: '\u2193', color: 'text-red-400', bg: 'bg-red-500/10', label: 'Declining' },
    stable: { arrow: '\u2192', color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Stable' },
  };

  const config = trendConfig[trend];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${config.bg} ${config.color}`}
      >
        <span className="text-sm">{config.arrow}</span>
        {config.label}
      </span>
      {percentile !== undefined && (
        <span className="text-xs font-medium text-slate-300 bg-slate-700 px-2 py-1 rounded-full">
          Top {percentile}%
        </span>
      )}
    </div>
  );
};
