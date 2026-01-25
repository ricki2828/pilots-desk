# Pilot's Desk - Testing Suite

Comprehensive testing framework for end-to-end validation of the Pilot's Desk platform.

## Quick Start

### 1. Backend API Tests (Automated)

Test all backend endpoints:

```bash
cd /home/ricki28/pilots-desk
./tests/backend-api-test.sh http://91.98.79.241:8007
```

**Expected Output**:
```
================================================
  Pilot's Desk - Backend API Test Suite
  Testing: http://91.98.79.241:8007
================================================

[1] Testing Health Check... ✓ PASS (HTTP 200)
[2] Testing List Scripts... ✓ PASS (HTTP 200)
...
✅ All tests passed!
```

### 2. Desktop Integration Tests (Manual)

Follow the manual test protocol:

```bash
cat tests/desktop-backend-integration.md
```

This covers:
- Script loading from bundled resources
- Backend connectivity
- Call metadata submission
- Real-time scoring
- PII redaction
- Error handling

### 3. Full E2E Test (Manual)

Complete user journey test:

```bash
cat E2E_TEST_PLAN.md
```

## Test Structure

```
tests/
├── README.md                           # This file
├── backend-api-test.sh                 # Automated backend API tests
├── desktop-backend-integration.md      # Manual desktop test protocol
├── fixtures/
│   ├── scoring_request.json            # Test data for scoring API
│   └── (more test fixtures)
└── (future: automated Playwright/Selenium tests)
```

## Test Phases

### Phase 1: Installer ✅
- [x] Windows installer works
- [x] App launches successfully
- [ ] Script loads from bundled resources (testing v0.1.1)

### Phase 2: Backend API
- [ ] All endpoints respond correctly
- [ ] Scoring API returns accurate results
- [ ] WebSocket connections work
- [ ] Database operations succeed

### Phase 3: Desktop → Backend
- [ ] Script loading from backend
- [ ] Transcript submission
- [ ] Real-time scoring via WebSocket
- [ ] Call metadata submission
- [ ] PII redaction working

### Phase 4: Dashboard
- [ ] Supervisor view displays active calls
- [ ] Analytics shows call history
- [ ] Transcript search works
- [ ] Agent comparison accurate

### Phase 5: Full E2E
- [ ] Complete call simulation
- [ ] All components working together
- [ ] Data consistency verified

## Prerequisites

### Backend Setup
```bash
ssh ricki28@91.98.79.241
cd ~/pilots-desk/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8007
```

### Dashboard Setup
```bash
ssh ricki28@91.98.79.241
cd ~/pilots-desk/dashboard
npm install
npm run build
npm run preview -- --host 0.0.0.0 --port 3000
```

### Desktop Setup
1. Download: https://github.com/ricki2828/pilots-desk/releases/latest
2. Install .msi on Windows
3. Launch and grant microphone permission

## Running Tests

### Quick Validation (2 minutes)

```bash
# 1. Check backend health
curl http://91.98.79.241:8007/health

# 2. Run automated API tests
./tests/backend-api-test.sh

# 3. Check dashboard accessible
curl http://91.98.79.241:3000
```

### Full Integration Test (15 minutes)

1. Run backend API tests: `./tests/backend-api-test.sh`
2. Follow desktop integration protocol: `tests/desktop-backend-integration.md`
3. Complete full E2E flow: `E2E_TEST_PLAN.md`

## Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Installer success rate | 100% | ✅ v0.1.0 |
| Script load time | <2s | 🔄 Testing v0.1.1 |
| Transcription latency | <400ms | ⬜ |
| Scoring latency | <10s | ⬜ |
| WebSocket uptime | >99% | ⬜ |
| Dashboard delay | <2s | ⬜ |
| PII redaction accuracy | 100% | ⬜ |

## Known Issues

### v0.1.0
- ❌ Script file not found error (hardcoded Linux path)
- **Fixed in v0.1.1**: Bundled scripts, cross-platform paths

### Current (v0.1.1)
- 🔄 Build in progress, awaiting testing

## Test Reports

Test run reports are saved in:
- `tests/reports/YYYY-MM-DD_vX.X.X.md`

## CI/CD Integration

Future: Automated tests in GitHub Actions

```yaml
# .github/workflows/test.yml
name: Run Tests
on: [push, pull_request]
jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run backend API tests
        run: ./tests/backend-api-test.sh http://localhost:8007
```

## Contributing

When adding new tests:
1. Add test case to appropriate file
2. Update this README
3. Update E2E_TEST_PLAN.md if needed
4. Run full test suite before committing

---

**Last Updated**: 2026-01-25
**Current Version**: v0.1.1 (building)
