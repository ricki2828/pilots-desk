/**
 * AgentTile Component - Modern Operations
 *
 * Displays real-time agent status with circular adherence gauge,
 * compliance badge, and time-on-call progress bar
 */

import React from 'react';
import { ActiveCall } from '../hooks/useActiveCallsWS';

interface AgentTileProps {
  call: ActiveCall;
  onClick?: () => void;
}

export const AgentTile: React.FC<AgentTileProps> = ({ call, onClick }) => {
  const getAdherenceColor = (score: number | null): string => {
    if (score === null) return 'text-slate-400';
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-amber-500';
    return 'text-red-500';
  };

  const getBorderColor = (score: number | null): string => {
    if (score === null) return 'border-slate-700';
    if (score >= 0.8) return 'border-green-500/50';
    if (score >= 0.6) return 'border-amber-500/50';
    return 'border-red-500/50';
  };

  const getGaugeColor = (score: number | null): string => {
    if (score === null) return '#475569'; // slate-600
    if (score >= 0.8) return '#10b981'; // green-500
    if (score >= 0.6) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatScore = (score: number | null): string => {
    if (score === null) return '--';
    return `${Math.round(score * 100)}`;
  };

  const truncateText = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const adherenceScore = call.latest_adherence_score ?? 0;
  const adherencePercent = Math.round(adherenceScore * 100);
  const circumference = 2 * Math.PI * 36; // radius = 36
  const strokeDashoffset = circumference - (adherencePercent / 100) * circumference;

  // Calculate progress for time-on-call (assume 10 min = 600s as max for visual)
  const maxDuration = 600;
  const durationPercent = Math.min((call.duration_seconds / maxDuration) * 100, 100);

  return (
    <div
      className={`bg-slate-800 border-2 ${getBorderColor(call.latest_adherence_score)} rounded-lg p-4 cursor-pointer
                  transition-all duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg motion-safe:hover:shadow-blue-500/20`}
      onClick={onClick}
    >
      {/* Header: Agent Name + Circular Gauge */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-slate-50 mb-1">
            {call.agent_name}
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            {formatDuration(call.duration_seconds)}
          </p>
        </div>

        {/* Circular Adherence Gauge */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
            {/* Background circle */}
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="#334155"
              strokeWidth="6"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke={getGaugeColor(call.latest_adherence_score)}
              strokeWidth="6"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${getAdherenceColor(call.latest_adherence_score)}`}>
              {formatScore(call.latest_adherence_score)}
            </span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wide">
              Score
            </span>
          </div>
        </div>
      </div>

      {/* Current Node */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Current Node
        </div>
        <div className="text-xs font-mono bg-slate-900 text-blue-400 px-2 py-1.5 rounded border border-slate-700">
          {call.current_node_id}
        </div>
      </div>

      {/* Current Script Text */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Script
        </div>
        <div className="text-xs text-slate-300 leading-relaxed">
          {truncateText(call.current_node_text)}
        </div>
      </div>

      {/* Time-on-Call Progress Bar */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Time on Call
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${durationPercent}%` }}
          />
        </div>
      </div>

      {/* Footer: Compliance Badge */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-700">
        <div className="flex items-center gap-2">
          {call.compliance_ok ? (
            <span className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium px-2.5 py-1 rounded-full">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Compliant
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full motion-safe:animate-pulse">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
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

        <div className="text-xs text-slate-500">
          {new Date(call.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};
