/**
 * SupervisorView Page - Modern Operations
 *
 * Real-time dashboard for supervisors to monitor all active calls
 * Dark theme optimized for wallboard displays and extended viewing
 */

import React, { useState, useMemo } from 'react';
import { useActiveCallsWS } from '../hooks/useActiveCallsWS';
import { AgentTile } from '../components/AgentTile';
import { TeamMetrics } from '../components/TeamMetrics';

interface SupervisorViewProps {
  clientId?: string;
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({
  clientId = 'SKY_TV_NZ',
}) => {
  const [, setSelectedCallId] = useState<string | null>(null);
  const { activeCalls, teamSummary, isConnected, error, reconnect } =
    useActiveCallsWS(clientId);

  const handleAgentClick = (callId: string) => {
    setSelectedCallId(callId);
    // TODO: Show detailed call modal/panel
  };

  // Calculate recent alerts (compliance violations and low adherence)
  const alerts = useMemo(() => {
    const alertList: Array<{
      id: string;
      type: 'violation' | 'low_adherence';
      agentName: string;
      message: string;
      timestamp: string;
    }> = [];

    activeCalls.forEach((call) => {
      if (!call.compliance_ok) {
        alertList.push({
          id: `${call.call_id}-violation`,
          type: 'violation',
          agentName: call.agent_name,
          message: 'Compliance violation detected',
          timestamp: call.last_updated,
        });
      }
      if (call.latest_adherence_score !== null && call.latest_adherence_score < 0.6) {
        alertList.push({
          id: `${call.call_id}-adherence`,
          type: 'low_adherence',
          agentName: call.agent_name,
          message: `Low adherence: ${Math.round(call.latest_adherence_score * 100)}%`,
          timestamp: call.last_updated,
        });
      }
    });

    return alertList.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 5);
  }, [activeCalls]);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header Bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-50">
              Real-Time Monitoring
            </h1>
            <span className="text-slate-500">|</span>
            <span className="text-sm text-slate-300">{clientId}</span>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                {isConnected && (
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
                )}
              </div>
              <span className="text-sm text-slate-300 font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Reconnect Button */}
            {!isConnected && (
              <button
                onClick={reconnect}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
              >
                Reconnect
              </button>
            )}

            {/* Current Time */}
            <div className="text-sm text-slate-400 font-mono">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Team Metrics Banner */}
      <div className="px-6 pt-6 pb-4">
        <TeamMetrics summary={teamSummary} activeCallCount={activeCalls.length} />
      </div>

      {/* Main Content Area */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Active Calls Grid - Takes 3 columns */}
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-50">
                Active Calls <span className="text-slate-400">({activeCalls.length})</span>
              </h2>
            </div>

            {activeCalls.length === 0 ? (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-16 text-center">
                <svg
                  className="w-20 h-20 text-slate-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <h3 className="text-2xl font-semibold text-slate-300 mb-2">
                  No Active Calls
                </h3>
                <p className="text-slate-500">
                  All agents are currently idle or offline
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeCalls.map((call) => (
                  <AgentTile
                    key={call.call_id}
                    call={call}
                    onClick={() => handleAgentClick(call.call_id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Alerts Panel - Takes 1 column */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-slate-50 mb-4">
              Alerts
              {alerts.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full motion-safe:animate-bounce">
                  {alerts.length}
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
                  <svg
                    className="w-12 h-12 text-green-500 mx-auto mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-slate-400">
                    All systems normal
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`bg-slate-800 border-l-4 ${
                      alert.type === 'violation'
                        ? 'border-red-500'
                        : 'border-amber-500'
                    } rounded-lg p-4`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                          alert.type === 'violation'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        } motion-safe:animate-pulse`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200">
                          {alert.agentName}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {alert.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-4 text-center">
        <p className="text-sm text-slate-500">
          Dashboard updates automatically in real-time via WebSocket connection
        </p>
      </div>
    </div>
  );
};
