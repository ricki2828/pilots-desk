/**
 * SupervisorView Page
 *
 * Real-time dashboard for supervisors to monitor all active calls
 * Shows live agent status, team metrics, and call details
 */

import React, { useState } from 'react';
import { useActiveCallsWS } from '../hooks/useActiveCallsWS';
import { AgentTile } from '../components/AgentTile';
import { TeamMetrics } from '../components/TeamMetrics';

interface SupervisorViewProps {
  clientId?: string;
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({
  clientId = 'SKY_TV_NZ',
}) => {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const { activeCalls, teamSummary, isConnected, error, reconnect } =
    useActiveCallsWS(clientId);

  const handleAgentClick = (callId: string) => {
    setSelectedCallId(callId);
    // TODO: Show detailed call modal/panel
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Real-Time Monitoring
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Client: {clientId}</span>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Reconnect Button */}
          {!isConnected && (
            <button
              onClick={reconnect}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Reconnect
            </button>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-400 text-red-800 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Team Metrics */}
      <div className="mb-6">
        <TeamMetrics summary={teamSummary} activeCallCount={activeCalls.length} />
      </div>

      {/* Active Calls Grid */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            Active Calls ({activeCalls.length})
          </h2>

          {/* View Toggle (could add different layouts) */}
          <div className="text-sm text-gray-600">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {activeCalls.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Active Calls
            </h3>
            <p className="text-gray-500">
              All agents are currently idle or offline
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {/* Footer Info */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Dashboard updates automatically in real-time via WebSocket connection
        </p>
        <p className="mt-1">
          Team metrics refresh every 60 seconds
        </p>
      </div>
    </div>
  );
};
