/**
 * Pilot's Desk - Dashboard
 * Main application component with navigation
 */

import React, { useState } from 'react';
import { SupervisorView } from './pages/SupervisorView';
import { AnalyticsView } from './pages/AnalyticsView';
import { TranscriptSearch } from './pages/TranscriptSearch';

type View = 'supervisor' | 'analytics' | 'search';

function App() {
  const [currentView, setCurrentView] = useState<View>('supervisor');
  const clientId = 'SKY_TV_NZ';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Pilot's Desk</h1>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-sm text-gray-600">{clientId}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('supervisor')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'supervisor'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Real-Time
              </button>
              <button
                onClick={() => setCurrentView('analytics')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'analytics'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setCurrentView('search')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'search'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Transcript Search
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div>
        {currentView === 'supervisor' && <SupervisorView clientId={clientId} />}
        {currentView === 'analytics' && <AnalyticsView clientId={clientId} />}
        {currentView === 'search' && <TranscriptSearch clientId={clientId} />}
      </div>
    </div>
  );
}

export default App;
