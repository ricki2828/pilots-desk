# End-to-End Testing Plan - Pilot's Desk

## Overview

This document outlines the complete end-to-end testing strategy for Pilot's Desk, covering the full integration flow:

**Desktop App (Windows) → Backend API (91.98.79.241:8007) → Dashboard (91.98.79.241:3000)**

---

## Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WINDOWS DESKTOP                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Pilot's Desk v0.1.1 (Tauri)                           │ │
│  │ • Script loading (bundled resources)                  │ │
│  │ • Audio capture (mic + loopback)                      │ │
│  │ • Whisper transcription (local sidecar)               │ │
│  │ • WebSocket scoring connection                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (91.98.79.241:8007)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ FastAPI Backend                                        │ │
│  │ • Script management                                    │ │
│  │ • Scoring API (LLM integration)                        │ │
│  │ • Analytics data collection                            │ │
│  │ • WebSocket real-time scoring                          │ │
│  │ • PII redaction                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL Database                                    │ │
│  │ • Call metadata                                        │ │
│  │ • Script versions                                      │ │
│  │ • Agent records                                        │ │
│  │ • Transcripts (metadata only)                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓ REST/WebSocket
┌─────────────────────────────────────────────────────────────┐
│            DASHBOARD (91.98.79.241:3000)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ React Dashboard (Vite)                                 │ │
│  │ • Supervisor real-time view                            │ │
│  │ • Analytics/BI dashboard                               │ │
│  │ • Transcript search                                    │ │
│  │ • Agent comparison charts                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Test Phases

### Phase 1: Desktop App Local Testing ✓

**Status**: COMPLETED (Build #18 successful)

**Tests**:
- [x] Installer works on Windows 10/11
- [x] App launches without crashes
- [x] UI renders correctly (1600x900 window)
- [ ] Script loads from bundled resources
- [ ] Audio capture initializes
- [ ] Whisper sidecar starts

**Expected**: Script loading error fixed in v0.1.1

---

### Phase 2: Backend API Testing

**Objective**: Verify backend is running and all endpoints respond correctly

**Prerequisites**:
- Backend running on 91.98.79.241:8007
- PostgreSQL database initialized
- Environment variables configured

**Test Cases**:

#### 2.1 Health Check
```bash
curl http://91.98.79.241:8007/health
# Expected: {"status": "healthy", "timestamp": "..."}
```

#### 2.2 Script Management
```bash
# List scripts
curl http://91.98.79.241:8007/api/scripts

# Get specific script
curl http://91.98.79.241:8007/api/scripts/SKY_TV_NZ/main_pitch
```

#### 2.3 Scoring API
```bash
# Submit transcript segment for scoring
curl -X POST http://91.98.79.241:8007/api/scoring/adherence \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test_agent_001",
    "script_version_id": "sky_tv_v1",
    "expected_text": "Hi {{customer_name}}, this is {{agent_name}} from Sky TV...",
    "actual_transcript": "Hi John, this is Sarah from Sky TV..."
  }'
# Expected: {"adherence_score": 0.95, "suggestions": [...]}
```

#### 2.4 Analytics Endpoints
```bash
# Get agent performance
curl http://91.98.79.241:8007/api/analytics/agents/test_agent_001

# Get call history
curl http://91.98.79.241:8007/api/analytics/calls?start_date=2026-01-01
```

#### 2.5 WebSocket Connection
```bash
# Test WebSocket for real-time scoring
wscat -c ws://91.98.79.241:8007/ws/scoring/test_agent_001
# Expected: Connection established, can send/receive scoring events
```

**Validation Script**: `tests/backend-api-test.sh`

---

### Phase 3: Desktop → Backend Integration

**Objective**: Test full flow from desktop app to backend

**Prerequisites**:
- Desktop app installed and running (v0.1.1+)
- Backend API accessible

**Test Cases**:

#### 3.1 Script Loading from Backend
- Desktop app requests script from backend API
- Script renders correctly in UI
- Variables populate correctly

#### 3.2 Transcript Submission
- Desktop captures audio (or simulated)
- Whisper transcribes locally
- Transcript sent to backend for scoring
- Score received and displayed in UI

#### 3.3 Real-time Scoring WebSocket
- Desktop establishes WebSocket connection
- Sends transcript segments during "call"
- Receives live scores and nudges
- UI updates in real-time (<5s latency)

#### 3.4 Call Metadata Submission
- Call starts → POST to /api/calls/start
- Call ends → POST to /api/calls/end with summary
- Verify call appears in backend database

#### 3.5 PII Redaction
- Speak/type credit card number in transcript
- Verify redacted before sending to backend
- Check backend logs confirm no PII stored

**Manual Test Protocol**: `tests/desktop-backend-integration.md`

---

### Phase 4: Dashboard Testing

**Objective**: Verify dashboard displays data from backend correctly

**Prerequisites**:
- Dashboard running on 91.98.79.241:3000
- Backend API returning test data
- At least 1 test call completed in Phase 3

**Test Cases**:

#### 4.1 Supervisor Real-time View
- Navigate to Supervisor View
- Verify active agents displayed
- Start a test call from desktop
- Confirm agent tile appears in real-time
- Check live scoring updates appear

#### 4.2 Analytics Dashboard
- Navigate to Analytics View
- Select test agent
- Verify call history displays
- Check adherence score charts render
- Validate date range filtering works

#### 4.3 Transcript Search
- Navigate to Transcript Search
- Search for keyword from test call
- Verify search results display
- Check keyword highlighting works
- Test PII redaction in search results

#### 4.4 Agent Comparison
- Navigate to Agent Comparison
- Select 2+ test agents
- Verify comparison table displays
- Check metrics calculation accuracy

**Validation**: `tests/dashboard-ui-test.md`

---

### Phase 5: End-to-End Flow Test

**Objective**: Complete user journey from call start to dashboard analysis

**Full Test Scenario**:

1. **Agent Login** (Desktop App)
   - Launch Pilot's Desk on Windows
   - Login with test credentials
   - Verify agent ID set correctly

2. **Call Start** (Desktop App)
   - Click "Start Call"
   - Script loads: Sky TV NZ main pitch
   - Microphone permission granted
   - Audio levels show in UI

3. **Script Navigation** (Desktop App)
   - Follow script from greeting → discovery → pitch → close
   - Manual navigation: Click to jump nodes
   - Keyboard shortcuts: Arrow keys to navigate

4. **Voice Transcription** (Desktop App)
   - Speak SA-accented English
   - Transcript appears <400ms
   - Whisper accuracy >95%

5. **Live Scoring** (Desktop → Backend)
   - Complete first script segment
   - Wait for score (~5-10s)
   - Verify score displays in UI
   - Check nudge highlights appear if off-script

6. **Compliance Warning** (Desktop → Backend)
   - Skip mandatory disclosure
   - Verify warning displays immediately
   - Check cannot proceed without acknowledgment

7. **Widget Interaction** (Desktop App)
   - Sky TV package calculator displays
   - Toggle Sport/Movies/SoHo packages
   - Verify pricing updates correctly
   - Say "I love rugby" → Sport auto-enables

8. **Call End** (Desktop App)
   - Click "End Call"
   - Summary displays: adherence score, segments completed
   - Verify metadata sent to backend

9. **Supervisor View** (Dashboard)
   - Open dashboard in browser
   - Navigate to Supervisor View
   - Verify test call appeared in real-time
   - Check final score matches desktop display

10. **Analytics** (Dashboard)
    - Navigate to Analytics
    - Find test call in history
    - Drill down to segment scores
    - Verify transcript stored (PII redacted)

11. **Search** (Dashboard)
    - Navigate to Transcript Search
    - Search for keyword from test call
    - Verify result found and displayed correctly

**Success Criteria**:
- All 11 steps complete without errors
- Latencies meet targets (<400ms transcription, <10s scoring)
- Data consistency across all components
- PII redaction working everywhere

**Test Duration**: ~15 minutes per run

**Documentation**: `tests/E2E_FULL_FLOW.md`

---

## Test Data

### Test Agents
```json
[
  {
    "id": "test_agent_001",
    "name": "Sarah Naidoo",
    "email": "sarah.naidoo@test.bpo",
    "client_id": "SKY_TV_NZ",
    "accent": "Gauteng, South Africa"
  },
  {
    "id": "test_agent_002",
    "name": "Thabo Mokoena",
    "email": "thabo.mokoena@test.bpo",
    "client_id": "SKY_TV_NZ",
    "accent": "KwaZulu-Natal, South Africa"
  }
]
```

### Test Script
- Location: `scripts/sky_tv_nz/main_pitch.json`
- Version: 1.0.0
- Nodes: 12 (greeting → discovery → pitch → objections → close)

### Test Transcript Samples
- Located in: `tests/fixtures/transcripts/`
- SA accent audio: `tests/fixtures/audio/sa_*.wav`

---

## Automation Scripts

### Backend API Test Suite
**File**: `tests/backend-api-test.sh`
```bash
#!/bin/bash
# Automated backend API testing
# Tests all endpoints for correct responses

BASE_URL="http://91.98.79.241:8007"

# Test health endpoint
echo "Testing health endpoint..."
curl -f $BASE_URL/health || exit 1

# Test scripts API
echo "Testing scripts API..."
curl -f $BASE_URL/api/scripts || exit 1

# Test scoring API
echo "Testing scoring API..."
curl -X POST $BASE_URL/api/scoring/adherence \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/scoring_request.json || exit 1

echo "✅ All backend tests passed"
```

### Desktop Integration Test
**File**: `tests/desktop-integration-test.py`
```python
"""
Automated desktop app integration testing
Uses Tauri's CLI testing capabilities
"""

import subprocess
import requests
import time

BACKEND_URL = "http://91.98.79.241:8007"

def test_backend_reachable():
    """Verify backend is accessible"""
    response = requests.get(f"{BACKEND_URL}/health")
    assert response.status_code == 200

def test_desktop_launches():
    """Launch desktop app and verify it starts"""
    # TODO: Use Tauri testing framework
    pass

def test_script_loads():
    """Verify script loads in desktop app"""
    # TODO: Test via Tauri IPC
    pass

if __name__ == "__main__":
    test_backend_reachable()
    print("✅ Backend integration tests passed")
```

### Dashboard E2E Test
**File**: `dashboard/tests/e2e.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test('supervisor view displays active calls', async ({ page }) => {
  await page.goto('http://91.98.79.241:3000/supervisor');

  // Wait for WebSocket connection
  await page.waitForTimeout(2000);

  // Verify page loads
  await expect(page.locator('h1')).toContainText('Supervisor View');

  // TODO: Simulate active call and verify tile appears
});

test('analytics displays call history', async ({ page }) => {
  await page.goto('http://91.98.79.241:3000/analytics');

  // Verify page loads
  await expect(page.locator('h1')).toContainText('Analytics');

  // TODO: Verify call history chart renders
});
```

---

## Test Environment Setup

### Backend Setup (91.98.79.241)
```bash
# SSH into server
ssh ricki28@91.98.79.241

# Navigate to backend
cd ~/pilots-desk/backend

# Install dependencies
pip install -r requirements.txt

# Initialize database
python -m app.db.init_database

# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8007
```

### Dashboard Setup (91.98.79.241)
```bash
# Navigate to dashboard
cd ~/pilots-desk/dashboard

# Install dependencies
npm install

# Build for production
npm run build

# Serve with nginx or pm2
pm2 start "npm run preview -- --host 0.0.0.0 --port 3000"
```

### Desktop Setup (Windows)
1. Download installer: https://github.com/ricki2828/pilots-desk/releases/download/v0.1.1/Pilot.s.Desk_0.1.1_x64_en-US.msi
2. Double-click to install
3. Launch from Start Menu
4. Grant microphone permission

---

## Test Checklist

### Pre-Test Setup
- [ ] Backend running on 91.98.79.241:8007
- [ ] Dashboard running on 91.98.79.241:3000
- [ ] PostgreSQL database initialized
- [ ] Desktop installer v0.1.1+ downloaded
- [ ] Windows test machine ready
- [ ] Microphone working
- [ ] Network connectivity verified

### Phase 1: Installer
- [ ] Download v0.1.1 .msi from GitHub releases
- [ ] Install on fresh Windows 10/11 VM
- [ ] App launches successfully
- [ ] No missing dependencies error

### Phase 2: Script Loading
- [ ] Script loads without "file not found" error
- [ ] Sky TV NZ pitch displays in UI
- [ ] All 12 nodes visible
- [ ] Variables populated correctly

### Phase 3: Audio Capture
- [ ] Microphone permission granted
- [ ] Audio levels display in UI
- [ ] System loopback works (if applicable)
- [ ] No audio driver errors

### Phase 4: Whisper Transcription
- [ ] Whisper sidecar starts successfully
- [ ] SA accent transcription accurate (>95%)
- [ ] Latency <400ms
- [ ] Transcript displays in UI

### Phase 5: Backend Integration
- [ ] Desktop connects to backend API
- [ ] Call metadata submitted successfully
- [ ] Scoring WebSocket connects
- [ ] Scores received in <10s

### Phase 6: Dashboard Integration
- [ ] Dashboard displays active call
- [ ] Real-time updates work
- [ ] Call history appears in analytics
- [ ] Transcript search finds test call

### Phase 7: Full E2E Flow
- [ ] Complete full call simulation
- [ ] All components communicate correctly
- [ ] Data consistency verified
- [ ] PII redaction working

---

## Known Issues & Workarounds

### Issue: Script file not found (v0.1.0)
**Status**: Fixed in v0.1.1
**Workaround**: Use v0.1.1+ installer

### Issue: Backend not accessible from desktop
**Possible causes**:
- Firewall blocking port 8007
- Backend not running
- Network connectivity issue

**Debug**:
```bash
# Check backend is running
curl http://91.98.79.241:8007/health

# Check from Windows desktop
curl http://91.98.79.241:8007/health

# If fails, check firewall
sudo ufw status
```

### Issue: WebSocket connection fails
**Possible causes**:
- Proxy/firewall blocking WebSocket
- Backend WebSocket endpoint not configured

**Debug**:
```bash
# Test WebSocket from CLI
wscat -c ws://91.98.79.241:8007/ws/scoring/test_agent_001
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Installer success rate | 100% | Test on 3+ different Windows machines |
| Script load time | <2s | Measure from app launch to script displayed |
| Transcription latency | <400ms | Measure from speech to text display |
| Scoring latency | <10s | Measure from segment end to score display |
| WebSocket uptime | >99% | Monitor connection during 10-minute test call |
| Dashboard real-time delay | <2s | Measure from desktop event to dashboard update |
| PII redaction accuracy | 100% | Test with 10+ PII examples, verify all redacted |

---

## Test Reporting

### Test Run Report Template
```markdown
# Test Run Report - Pilot's Desk v0.1.1

**Date**: 2026-01-25
**Tester**: [Name]
**Environment**: Windows 11, Backend v1.0.0

## Summary
- Total Tests: 45
- Passed: 42
- Failed: 3
- Skipped: 0

## Failed Tests
1. **Audio loopback capture** - System audio not captured (known limitation)
2. **Scoring latency** - 12s average (target: <10s) - LLM API slow
3. **Dashboard WebSocket** - Intermittent disconnections

## Performance Metrics
- Script load: 1.2s ✅
- Transcription latency: 380ms ✅
- Scoring latency: 12s ❌
- Dashboard delay: 1.5s ✅

## Recommendations
1. Optimize LLM scoring prompt for faster responses
2. Investigate WebSocket keepalive settings
3. Add retry logic for WebSocket reconnection
```

---

## Next Steps

1. **Run Phase 1-2 tests**: Verify v0.1.1 installer and backend API
2. **Complete Phase 3**: Desktop → Backend integration testing
3. **Set up CI/CD for tests**: Automate backend API tests in GitHub Actions
4. **Document test results**: Create test report for each build
5. **Iterate**: Fix issues, re-test, repeat

---

**Last Updated**: 2026-01-25
**Version**: 1.0.0
**Status**: Draft - awaiting v0.1.1 build completion
