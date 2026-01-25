# Pilot's Desk - Dashboard

Comprehensive dashboard for supervisors to monitor real-time calls and analyze historical performance.

## Features

### Real-Time Monitoring
- **Live Updates**: WebSocket connection for instant call updates
- **Agent Tiles**: Color-coded agent cards showing current performance
- **Team Metrics**: Aggregate team performance over last 7 days
- **Compliance Alerts**: Instant visibility into compliance violations
- **Performance Tracking**: Adherence scores and call duration monitoring

### Business Intelligence & Analytics
- **Call Trend Charts**: Visualize calls, sales, conversion, and adherence over time
- **Agent Comparison**: Sortable table comparing all agent performance metrics
- **Script Bottlenecks**: Identify problematic script nodes with low adherence or high failures
- **Date Range Filtering**: Analyze data from 7, 14, 30, or 90 days
- **Chart Types**: Toggle between line and bar charts
- **Performance Insights**: Automated coaching recommendations

### Transcript Search
- **Full-Text Search**: Keyword search across all call transcripts
- **Advanced Filtering**: Filter by disposition, adherence score, compliance status
- **Keyword Highlighting**: Matched terms highlighted in yellow
- **PII Redaction**: Automatic redaction of sensitive information
- **Search Results**: Snippets with call metadata and context
- **Fast Search**: Sub-second response times for most queries

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Pilot's Desk backend running on port 8006

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

Dashboard will be available at http://localhost:5173

### Build for Production

```bash
npm run build
npm run preview
```

## Architecture

### Pages

- **SupervisorView** (`src/pages/SupervisorView.tsx`): Real-time monitoring dashboard
- **AnalyticsView** (`src/pages/AnalyticsView.tsx`): Business intelligence and historical analysis
- **TranscriptSearch** (`src/pages/TranscriptSearch.tsx`): Full-text transcript search portal

### Components

**Real-Time:**
- **AgentTile** (`src/components/AgentTile.tsx`): Individual agent status card
- **TeamMetrics** (`src/components/TeamMetrics.tsx`): Aggregate team performance

**Analytics:**
- **CallTrendChart** (`src/components/CallTrendChart.tsx`): Historical trend visualization
- **AgentComparisonTable** (`src/components/AgentComparisonTable.tsx`): Agent performance comparison
- **ScriptFunnelChart** (`src/components/ScriptFunnelChart.tsx`): Script bottleneck analysis
- **DateRangeFilter** (`src/components/DateRangeFilter.tsx`): Date range selection

**Search:**
- **SearchFilters** (`src/components/SearchFilters.tsx`): Advanced search filter UI
- **SearchResults** (`src/components/SearchResults.tsx`): Search results with keyword highlighting

### Hooks

- **useActiveCallsWS** (`src/hooks/useActiveCallsWS.ts`): WebSocket connection for real-time updates
- **useAnalytics** (`src/hooks/useAnalytics.ts`): Historical data fetching and aggregation
- **useTranscriptSearch** (`src/hooks/useTranscriptSearch.ts`): Full-text transcript search with filtering

### Data Flow

1. Dashboard connects to `/api/supervisor/ws/{client_id}` WebSocket endpoint
2. Backend sends initial active calls snapshot
3. Backend broadcasts updates when:
   - Call starts (`call_started`)
   - Call updates (`call_updated`)
   - Call ends (`call_ended`)
   - Periodic refresh every 30 seconds (`active_calls_update`)
4. Team metrics refresh every 60 seconds via REST API

## API Endpoints

### WebSocket

- `ws://localhost:8006/api/supervisor/ws/{client_id}` - Real-time call updates

### REST - Real-Time

- `GET /api/analytics/supervisor/team-summary?client_id={id}&days=7` - Team performance metrics
- `GET /api/analytics/supervisor/active-calls?client_id={id}` - Current active calls

### REST - Analytics

- `GET /api/analytics/reports/daily-summary?client_id={id}&target_date={date}` - Daily summary report
- `GET /api/analytics/agent/{agent_id}/performance?days=30` - Agent performance over time
- `GET /api/analytics/script/bottlenecks?client_id={id}&days=30&min_calls=10` - Script bottlenecks
- `GET /api/analytics/call/{call_id}/summary` - Detailed call summary

### REST - Search

- `POST /api/search/transcripts` - Full-text search with filters (query, dates, disposition, adherence)
- `GET /api/search/keywords?client_id={id}&days=30` - Common keywords/phrases for suggestions

## Color Coding

### Adherence Score

- **Green** (≥80%): Excellent performance
- **Yellow** (60-79%): Needs monitoring
- **Red** (<60%): Requires intervention

### Compliance

- **Green checkmark**: Compliant
- **Red X**: Violation detected

## Future Enhancements

- [ ] Call detail modal/panel (drill-down from agent tile)
- [x] Historical trend charts (COMPLETE)
- [x] Agent comparison (COMPLETE)
- [x] Script bottleneck analysis (COMPLETE)
- [x] Transcript search portal (COMPLETE)
- [ ] Export reports (PDF/CSV)
- [ ] Alert notifications (email/Slack)
- [ ] Multi-client support with client selector
- [ ] Authentication integration (JWT from backend)
- [ ] Agent search/filter in comparison table
- [ ] Custom date range picker (beyond presets)
- [ ] Real-time alerts in supervisor view
- [ ] Pagination for search results (beyond 50 limit)
- [ ] Export search results to CSV
- [ ] Save search queries/filters
