/**
 * Pilot's Desk - Dashboard
 * Main application component with navigation
 */

import { useState } from 'react';
import { CoachingReportsView } from './pages/CoachingReportsView';
import { AnalyticsView } from './pages/AnalyticsView';
import { TranscriptSearch } from './pages/TranscriptSearch';

type View = 'coaching' | 'analytics' | 'search';

function App() {
  const [currentView, setCurrentView] = useState<View>('coaching');
  const clientId = 'SKY_TV_NZ';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation Bar */}
      <nav className="bg-slate-900 border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-slate-50">Pilot's Desk</h1>
              <span className="text-sm text-slate-600">|</span>
              <span className="text-sm text-slate-400">{clientId}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('coaching')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'coaching'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                }`}
              >
                Coaching Reports
              </button>
              <button
                onClick={() => setCurrentView('analytics')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'analytics'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setCurrentView('search')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'search'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                }`}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div>
        {currentView === 'coaching' && <CoachingReportsView clientId={clientId} />}
        {currentView === 'analytics' && <AnalyticsView clientId={clientId} />}
        {currentView === 'search' && <TranscriptSearch clientId={clientId} />}
      </div>
    </div>
  );
}

export default App;
