/**
 * NodeBreakdownTable Component
 *
 * Sortable table showing node-by-node scores from the coaching report
 */

import React, { useState, useMemo } from 'react';

export interface NodeScore {
  node_id: string;
  score: number;
  notes: string;
}

interface NodeBreakdownTableProps {
  nodes: NodeScore[];
}

type SortKey = 'node_id' | 'score';
type SortDir = 'asc' | 'desc';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 65) return 'text-blue-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

export const NodeBreakdownTable: React.FC<NodeBreakdownTableProps> = ({ nodes }) => {
  const [sortKey, setSortKey] = useState<SortKey>('node_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [nodes, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return '\u2195';
    return sortDir === 'asc' ? '\u2191' : '\u2193';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th
              className="text-left py-2 px-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 select-none"
              onClick={() => handleSort('node_id')}
            >
              Node {sortIcon('node_id')}
            </th>
            <th
              className="text-right py-2 px-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 select-none w-24"
              onClick={() => handleSort('score')}
            >
              Score {sortIcon('score')}
            </th>
            <th className="text-left py-2 px-3 text-slate-400 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((node) => (
            <tr
              key={node.node_id}
              className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
            >
              <td className="py-2 px-3 text-slate-200 font-mono text-xs">
                {node.node_id}
              </td>
              <td className={`py-2 px-3 text-right font-bold ${getScoreColor(node.score)}`}>
                {node.score}
              </td>
              <td className="py-2 px-3 text-slate-400 text-xs">
                {node.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
