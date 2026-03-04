/**
 * CoachingReportCard Component
 *
 * Expandable report card with all coaching details
 */

import React from 'react';
import type { CoachingReport } from '../hooks/useCoachingReports';
import { ScoreGauge } from './ScoreGauge';
import { TrendBadge } from './TrendBadge';
import { ComplianceAudit } from './ComplianceAudit';
import { NodeBreakdownTable } from './NodeBreakdownTable';

interface CoachingReportCardProps {
  report: CoachingReport;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getMomentColor(type: 'positive' | 'negative' | 'neutral'): string {
  if (type === 'positive') return 'border-green-500 bg-green-500/10';
  if (type === 'negative') return 'border-red-500 bg-red-500/10';
  return 'border-slate-500 bg-slate-500/10';
}

export const CoachingReportCard: React.FC<CoachingReportCardProps> = ({ report, onClose }) => {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-slate-200 font-bold text-lg">
            {report.agent_name.charAt(0)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-50">{report.agent_name}</h3>
            <p className="text-sm text-slate-400">
              {new Date(report.call_date).toLocaleString()} -- {formatDuration(report.duration_seconds)}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Score + Rating + Trend */}
        <div className="flex items-center gap-8 flex-wrap">
          <ScoreGauge score={report.overall_score} size="lg" />
          <div className="space-y-2">
            <TrendBadge trend={report.trend} percentile={report.percentile} />
          </div>
        </div>

        {/* Compliance Audit */}
        <div>
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Compliance</h4>
          <ComplianceAudit passed={report.compliance_passed} issues={report.compliance_issues} />
        </div>

        {/* Strengths + Improvements side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">Strengths</h4>
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Improvement Areas */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">Areas for Improvement</h4>
            <ul className="space-y-2">
              {report.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">-</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Node Breakdown */}
        <div>
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Node Breakdown</h4>
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
            <NodeBreakdownTable nodes={report.node_scores} />
          </div>
        </div>

        {/* Objection Handling */}
        {report.objection_handling.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Objection Handling</h4>
            <div className="space-y-2">
              {report.objection_handling.map((obj, i) => (
                <div key={i} className="bg-slate-900 rounded-lg border border-slate-700 p-3">
                  <p className="text-sm font-medium text-slate-200">{obj.objection}</p>
                  <p className="text-xs text-slate-400 mt-1">Response: {obj.handling}</p>
                  <span className={`inline-block text-xs mt-1 px-2 py-0.5 rounded ${
                    obj.effectiveness === 'effective'
                      ? 'bg-green-500/10 text-green-400'
                      : obj.effectiveness === 'partial'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-red-500/10 text-red-400'
                  }`}>
                    {obj.effectiveness}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close Attempts */}
        {report.close_attempts.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
              Close Attempts ({report.close_attempts.length})
            </h4>
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">#</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Technique</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {report.close_attempts.map((ca) => (
                    <tr key={ca.attempt_number} className="border-b border-slate-800">
                      <td className="py-2 px-3 text-slate-300">{ca.attempt_number}</td>
                      <td className="py-2 px-3 text-slate-300">{ca.technique}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          ca.outcome === 'success'
                            ? 'bg-green-500/10 text-green-400'
                            : ca.outcome === 'deferred'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-red-500/10 text-red-400'
                        }`}>
                          {ca.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Key Moments Timeline */}
        {report.key_moments.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Key Moments</h4>
            <div className="space-y-2">
              {report.key_moments.map((moment, i) => (
                <div
                  key={i}
                  className={`border-l-2 rounded-r-lg px-3 py-2 ${getMomentColor(moment.type)}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{moment.timestamp}</span>
                    <span className="text-sm text-slate-200">{moment.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coaching Summary */}
        <div>
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Coaching Summary</h4>
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-300 leading-relaxed">{report.coaching_summary}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
