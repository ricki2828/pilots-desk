# Business Intelligence & Analytics Dashboard

Complete guide to the Pilot's Desk BI analytics features.

## Overview

The Analytics Dashboard provides historical data analysis and performance insights for call center operations. It complements the real-time Supervisor Dashboard by offering trend analysis, agent comparisons, and script optimization recommendations.

## Features

### 1. Call Trend Charts

**Location**: Top section of Analytics view

**Visualizations**:
- **Calls & Sales Volume**: Line or bar chart showing daily call count and sales
- **Conversion Rate**: Percentage of calls resulting in sales over time
- **Average Adherence Score**: Team-wide adherence trend

**Chart Types**:
- **Line Chart** (default): Best for spotting trends and patterns
- **Bar Chart**: Better for comparing specific days

**Interactive Features**:
- Hover tooltips showing exact values
- Date formatting (e.g., "Jan 15")
- Color-coded metrics:
  - Blue: Total Calls
  - Green: Sales
  - Purple: Conversion Rate
  - Orange: Adherence Score

**Use Cases**:
- Identify peak call days
- Spot declining conversion trends
- Monitor adherence improvements over time
- Correlate sales with call volume

---

### 2. Agent Comparison Table

**Location**: Middle section of Analytics view

**Columns**:
| Column | Description | Sorting |
|--------|-------------|---------|
| Agent Name | Full agent name | Alphabetical |
| Total Calls | Number of calls handled | Numeric |
| Sales | Number of successful sales | Numeric |
| Conversion | Sales/Calls percentage | Numeric |
| Avg Adherence | Average script adherence score | Numeric |
| Violations | Compliance violation count | Numeric |

**Color Coding**:
- **Adherence Score**:
  - Green (≥80%): Excellent
  - Yellow (60-79%): Needs improvement
  - Red (<60%): Requires coaching

- **Conversion Rate**:
  - Green (≥30%): High performer
  - Yellow (20-29%): Average
  - Red (<20%): Needs training

- **Violations**:
  - Green (0): Compliant
  - Yellow (1-4): Monitor
  - Red (≥5): Urgent attention

**Interactive Features**:
- Click column headers to sort (ascending/descending)
- Sort indicators (arrows) show current sort
- Summary stats at bottom:
  - Total Calls (all agents)
  - Total Sales (all agents)
  - Average Adherence (mean across agents)
  - Total Violations (all agents)

**Use Cases**:
- Identify top and bottom performers
- Spot agents needing coaching
- Compare adherence across team
- Track compliance trends

---

### 3. Script Bottleneck Analysis

**Location**: Bottom section of Analytics view

**Components**:

#### A. Adherence by Node Chart
- **Type**: Horizontal bar chart
- **Metric**: Average adherence score per script node
- **Color**:
  - Red: Critical bottlenecks (adherence <60% or failures >10)
  - Yellow: Warning nodes (moderate issues)

#### B. Compliance Failures by Node
- **Type**: Horizontal bar chart
- **Metric**: Count of compliance failures per node
- **Color**: Red (all bars)

#### C. Detailed Bottleneck Table
Shows all problematic nodes with:
- Node ID (script identifier)
- Calls Reached (volume at this node)
- Avg Adherence (percentage)
- Failures (compliance violation count)
- Status badge (Critical/Warning)

#### D. Coaching Recommendations
Auto-generated list of top 3 critical issues with suggested actions:
- "Review {node_id} - agents struggling with adherence"
- "Review {node_id} - high compliance failure rate"

**Status Definitions**:
- **Critical**: Adherence <60% OR failures >10
- **Warning**: Adherence 60-80% OR failures >5

**Use Cases**:
- Identify which script nodes need rewriting
- Focus training on specific script sections
- Prioritize script improvements
- Track script version effectiveness

---

### 4. Date Range Filtering

**Location**: Top of Analytics view (below header)

**Preset Options**:
- 7 Days: Weekly trends
- 14 Days: Bi-weekly comparison
- 30 Days: Monthly analysis (default)
- 90 Days: Quarterly trends

**Behavior**:
- Clicking a preset updates all charts and tables
- Shows data from last N complete days
- Updates "Showing data from the last X days" indicator

**Performance**:
- 7 Days: ~1-2 seconds load time
- 30 Days: ~3-5 seconds load time
- 90 Days: ~10-15 seconds load time (fetches 90 daily summaries)

**Use Cases**:
- Weekly performance reviews
- Monthly reporting
- Quarterly business reviews
- Trend analysis over different periods

---

## Navigation

**Accessing Analytics**:
1. Click "Analytics & Reports" in top navigation bar
2. Dashboard loads with 30-day default view

**Switching Views**:
- "Real-Time Dashboard": Live supervisor monitoring
- "Analytics & Reports": Historical BI analysis

---

## Data Sources

### Primary Endpoints

1. **Call Trends**: `GET /api/analytics/reports/daily-summary`
   - Called once per day in date range
   - Returns: calls, sales, conversion, adherence for that day

2. **Agent Performance**: `GET /api/analytics/supervisor/team-summary`
   - Returns: Top performers with aggregate metrics

3. **Script Bottlenecks**: `GET /api/analytics/script/bottlenecks`
   - Parameters: client_id, days, min_calls
   - Returns: Nodes with low adherence or high failures

### Data Refresh

- **Manual**: Click "Refresh" button (top-right)
- **Automatic**: None (analytics are historical, no auto-refresh)
- **On Date Change**: Automatically refetches when date range changes

---

## Interpreting Metrics

### Adherence Score

**Definition**: How closely the agent followed the script

**Calculation**:
- Per-segment scoring (0.0-1.0)
- Averaged across all segments in a call
- Team average: Mean of all agent averages

**Targets**:
- ≥80%: On target
- 60-79%: Needs coaching
- <60%: Critical issue

**Factors**:
- Key points covered vs missed
- Structure and flow
- Professionalism and tone
- SA accent baseline (not NZ!)

### Conversion Rate

**Definition**: Percentage of calls resulting in sales

**Calculation**: (Sales ÷ Total Calls) × 100

**Targets** (Sky TV NZ):
- ≥30%: High performer
- 20-29%: Average
- <20%: Needs improvement

**Note**: Varies by campaign type (sales vs service vs appointments)

### Compliance Violations

**Definition**: Count of compliance failures (e.g., skipped disclosures)

**Types**:
- Skipped compliance nodes (legal disclosures)
- Forbidden phrases detected
- Missing required confirmations

**Severity**:
- 0 violations: Compliant
- 1-4: Monitor
- ≥5: Urgent

**Action**: Review specific calls to identify patterns

---

## Best Practices

### Weekly Reviews
1. Check 7-day trends for recent performance
2. Identify top 3 performers and bottom 3
3. Review script bottlenecks flagged as "critical"
4. Set coaching priorities for the week

### Monthly Reporting
1. Use 30-day view for monthly metrics
2. Export agent comparison table (manual copy for now)
3. Compare to previous month trends
4. Update script based on bottleneck analysis

### Quarterly Analysis
1. Use 90-day view for long-term trends
2. Identify seasonal patterns
3. Evaluate script version effectiveness
4. Plan training programs based on adherence gaps

### Coaching Sessions
1. Use agent comparison to identify targets
2. Review their specific bottleneck nodes
3. Show adherence trend over time
4. Set measurable improvement goals

---

## Troubleshooting

### "No trend data available"

**Cause**: No calls in database for selected date range

**Fix**:
- Verify date range includes calls
- Check database has data for client
- Ensure backend is connected to PostgreSQL

### Charts not loading

**Cause**: API endpoint failure

**Fix**:
1. Check browser console for errors
2. Verify backend is running (port 8006)
3. Check CORS configuration allows dashboard origin
4. Click "Refresh" button to retry

### Slow loading (>30 seconds)

**Cause**: Large date range (90 days) or high call volume

**Fix**:
- Reduce date range (use 30 days instead of 90)
- Backend optimization: Add database indexing
- Consider caching daily summaries

### Agent names missing in comparison table

**Cause**: Current endpoint (`team-summary`) returns top performers only

**Fix**: Update to use full agent list endpoint when available

---

## Performance Optimization

### Recommended Date Ranges

| Use Case | Recommended Range | Load Time |
|----------|-------------------|-----------|
| Daily check-ins | 7 days | <2 seconds |
| Weekly reviews | 14 days | ~3 seconds |
| Monthly reporting | 30 days | ~5 seconds |
| Quarterly analysis | 90 days | ~15 seconds |

### Caching Strategy

Currently: **No caching** (fresh data on each load)

Future enhancement:
- Cache daily summaries (invalidate at midnight)
- Cache agent metrics (refresh every 5 minutes)
- Cache bottleneck analysis (refresh every 15 minutes)

---

## Export & Reporting

**Current Status**: Not yet implemented

**Planned Features**:
- Export agent comparison as CSV
- Export charts as PNG
- Generate PDF reports
- Schedule automated email reports

**Workaround**:
- Take screenshots of charts
- Manually copy table data
- Use browser print to PDF

---

## Integration with Real-Time Dashboard

The Analytics Dashboard complements the Supervisor real-time view:

| Real-Time Dashboard | Analytics Dashboard |
|---------------------|---------------------|
| Current active calls | Historical call trends |
| Live adherence scores | Adherence over time |
| Team metrics (7 days) | Team metrics (7-90 days) |
| Compliance warnings | Compliance violation analysis |
| Agent tiles (active now) | Agent comparison (all agents) |

**Workflow**:
1. Use Real-Time for live monitoring and interventions
2. Use Analytics for weekly/monthly reviews and training planning
3. Switch between views using navigation bar

---

## Technical Details

### Libraries Used

- **Recharts**: Chart visualization
- **date-fns**: Date formatting and manipulation
- **Tailwind CSS**: Styling

### Data Flow

1. User selects date range (e.g., 30 days)
2. `useAnalytics` hook fetches data:
   - Loops through each day, calls `daily-summary` endpoint
   - Fetches `team-summary` for agent performance
   - Fetches `script/bottlenecks` for node analysis
3. Components receive data and render charts/tables
4. User interactions (sort, hover) update UI

### State Management

- Local React state (useState)
- No global state (Redux/Context) needed
- Each hook manages its own data fetching

---

## Future Enhancements

### Planned Features
- [ ] Custom date range picker (calendar widget)
- [ ] Export to CSV/PDF
- [ ] Scheduled email reports
- [ ] Drill-down to individual calls from charts
- [ ] Agent filter in comparison table
- [ ] Script version comparison (A/B testing)
- [ ] Predictive analytics (forecasting)
- [ ] Alerts for declining trends

### API Improvements Needed
- Full agent list endpoint (not just top performers)
- Aggregated metrics endpoint (avoid 90 API calls for 90-day view)
- Cached daily summaries for performance

---

**Last Updated**: 2026-01-24
**Version**: 1.0.0
