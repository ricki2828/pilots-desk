/**
 * StatusPill Component
 *
 * Color-coded status indicator with pulse animation for in-progress states
 */

import React from 'react';

export type CallStatus = 'queued' | 'transcribing' | 'analyzing' | 'complete' | 'failed';

interface StatusPillProps {
  status: CallStatus;
}

const statusConfig: Record<CallStatus, { label: string; classes: string }> = {
  queued: {
    label: 'Queued',
    classes: 'bg-slate-600/20 border-slate-500/30 text-slate-300',
  },
  transcribing: {
    label: 'Transcribing',
    classes: 'bg-blue-500/20 border-blue-500/30 text-blue-400 animate-pulse',
  },
  analyzing: {
    label: 'Analyzing',
    classes: 'bg-purple-500/20 border-purple-500/30 text-purple-400 animate-pulse',
  },
  complete: {
    label: 'Complete',
    classes: 'bg-green-500/20 border-green-500/30 text-green-400',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-500/20 border-red-500/30 text-red-400',
  },
};

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.classes}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'queued' ? 'bg-slate-400' :
          status === 'transcribing' ? 'bg-blue-400' :
          status === 'analyzing' ? 'bg-purple-400' :
          status === 'complete' ? 'bg-green-400' :
          'bg-red-400'
        }`}
      />
      {config.label}
    </span>
  );
};
