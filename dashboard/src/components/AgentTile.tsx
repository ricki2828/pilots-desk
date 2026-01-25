/**
 * AgentTile Component
 *
 * Displays real-time status of an agent currently on a call
 * Color-coded by adherence score performance
 */

import React from 'react';
import { ActiveCall } from '../hooks/useActiveCallsWS';

interface AgentTileProps {
  call: ActiveCall;
  onClick?: () => void;
}

export const AgentTile: React.FC<AgentTileProps> = ({ call, onClick }) => {
  const getPerformanceColor = (score: number | null): string => {
    if (score === null) return 'border-gray-300 bg-gray-50';
    if (score >= 0.8) return 'border-green-400 bg-green-50';
    if (score >= 0.6) return 'border-yellow-400 bg-yellow-50';
    return 'border-red-400 bg-red-50';
  };

  const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-gray-500';
    if (score >= 0.8) return 'text-green-700';
    if (score >= 0.6) return 'text-yellow-700';
    return 'text-red-700';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatScore = (score: number | null): string => {
    if (score === null) return '--';
    return `${Math.round(score * 100)}%`;
  };

  const truncateText = (text: string, maxLength: number = 60): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const borderColor = getPerformanceColor(call.latest_adherence_score);
  const scoreColor = getScoreColor(call.latest_adherence_score);

  return (
    <div
      className={`border-2 rounded-lg p-4 ${borderColor} cursor-pointer hover:shadow-lg transition-all duration-200`}
      onClick={onClick}
    >
      {/* Header: Agent Name + Duration */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">
            {call.agent_name}
          </h3>
          <p className="text-sm text-gray-500">
            Call Duration: {formatDuration(call.duration_seconds)}
          </p>
        </div>

        {/* Adherence Score Badge */}
        <div className={`text-right ${scoreColor}`}>
          <div className="text-2xl font-bold">
            {formatScore(call.latest_adherence_score)}
          </div>
          <div className="text-xs uppercase tracking-wide">Adherence</div>
        </div>
      </div>

      {/* Current Node */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-600 uppercase mb-1">
          Current Node
        </div>
        <div className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200">
          {call.current_node_id}
        </div>
      </div>

      {/* Current Script Text */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-600 uppercase mb-1">
          Script
        </div>
        <div className="text-sm text-gray-700 leading-tight">
          {truncateText(call.current_node_text)}
        </div>
      </div>

      {/* Footer: Compliance Status + Timestamp */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2">
          {call.compliance_ok ? (
            <span className="inline-flex items-center gap-1 text-green-600 text-xs">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Compliant
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              Violation
            </span>
          )}
        </div>

        <div className="text-xs text-gray-500">
          Updated {new Date(call.last_updated).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
