/**
 * ComplianceAudit Component
 *
 * Pass/fail compliance section with expandable issue details
 */

import React, { useState } from 'react';

export interface ComplianceIssue {
  rule: string;
  severity: 'critical' | 'warning';
  detail: string;
}

interface ComplianceAuditProps {
  passed: boolean;
  issues: ComplianceIssue[];
}

export const ComplianceAudit: React.FC<ComplianceAuditProps> = ({ passed, issues }) => {
  const [expanded, setExpanded] = useState(!passed);

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {passed ? (
            <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Compliance Passed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400 text-sm font-semibold">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              Compliance Failed ({issues.length} issue{issues.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && issues.length > 0 && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-2">
          {issues.map((issue, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-sm px-3 py-2 rounded ${
                issue.severity === 'critical'
                  ? 'bg-red-900/20 border-l-2 border-red-500'
                  : 'bg-amber-900/20 border-l-2 border-amber-500'
              }`}
            >
              <div className="flex-1">
                <p className={`font-medium ${
                  issue.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                }`}>
                  {issue.rule}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">{issue.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
