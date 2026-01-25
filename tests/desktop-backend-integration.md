# Desktop → Backend Integration Test Protocol

## Prerequisites

- [ ] Windows machine with v0.1.1 installer
- [ ] Backend running on 91.98.79.241:8007
- [ ] Network connectivity verified
- [ ] Microphone available (optional for this test)

---

## Test 1: Script Loading from Backend

**Objective**: Verify desktop app can load scripts from bundled resources

### Steps:

1. Launch Pilot's Desk on Windows
2. Wait for app to fully load
3. Observe script loading screen

### Expected Behavior:
- Script loads within 2 seconds
- No "file not found" error
- Sky TV NZ pitch displays in UI
- All 12 nodes visible in script tree

### Pass Criteria:
- [x] Script loads successfully
- [x] No errors in console
- [x] All nodes visible

---

## Test 2: Backend Connectivity

**Objective**: Verify desktop can reach backend API

### Steps:

1. In desktop app, check Settings → Backend Configuration
2. Verify backend URL is set to: http://91.98.79.241:8007
3. Click "Test Connection" button

### Expected Behavior:
- Connection test succeeds
- Backend version displays
- Latency <500ms

### Pass Criteria:
- [x] Connection successful
- [x] Backend responds
- [x] Latency acceptable

---

## Test 3: Call Metadata Submission

**Objective**: Verify desktop sends call data to backend

### Steps:

1. Click "Start Call" in desktop app
2. Navigate through 3-4 script nodes
3. Click "End Call"
4. Check backend logs or database

### Expected Behavior:
- POST to `/api/calls/start` succeeds
- Metadata includes: agent_id, script_version, timestamp
- POST to `/api/calls/end` succeeds
- Call record appears in database

### Verification:
```bash
# Check backend logs
ssh ricki28@91.98.79.241
tail -f ~/pilots-desk/backend/logs/app.log | grep "call"

# Or query database
sqlite3 ~/pilots-desk/backend/data/pilot.db "SELECT * FROM call_metadata ORDER BY created_at DESC LIMIT 1;"
```

### Pass Criteria:
- [x] Call start recorded
- [x] Call end recorded
- [x] Metadata correct

---

## Test 4: Transcript Submission

**Objective**: Verify desktop sends transcripts to backend for scoring

### Steps:

1. Start call in desktop app
2. Type or speak test transcript: "Hi John, this is Sarah from Sky TV. How are you today?"
3. Wait for scoring

### Expected Behavior:
- Transcript sent to backend via WebSocket
- Score received within 10 seconds
- Score displays in UI

### Verification:
```bash
# Monitor WebSocket traffic in browser DevTools
# Or check backend logs
tail -f ~/pilots-desk/backend/logs/app.log | grep "scoring"
```

### Pass Criteria:
- [x] Transcript sent
- [x] Score received <10s
- [x] Score accurate (>0.9 for exact match)

---

## Test 5: Real-time Scoring WebSocket

**Objective**: Verify persistent WebSocket connection for live scoring

### Steps:

1. Start call in desktop app
2. Open browser DevTools → Network → WS tab
3. Observe WebSocket connection
4. Send multiple transcript segments during call

### Expected Behavior:
- WebSocket connects on call start
- Connection persists throughout call
- Real-time score updates appear
- Connection closes gracefully on call end

### Pass Criteria:
- [x] WebSocket establishes
- [x] Connection stable (no disconnects)
- [x] Real-time updates work
- [x] Graceful close

---

## Test 6: PII Redaction

**Objective**: Verify sensitive data is redacted before sending to backend

### Steps:

1. Start call in desktop app
2. Type transcript with PII:
   - "My credit card is 4532-1234-5678-9010"
   - "Email me at john.doe@gmail.com"
   - "My phone is 021-555-1234"
3. Check backend logs and database

### Expected Behavior:
- Desktop redacts PII before sending
- Backend receives: "My credit card is [REDACTED]"
- No PII stored in database or logs

### Verification:
```bash
# Check backend logs - should NOT contain actual PII
grep "4532-1234-5678-9010" ~/pilots-desk/backend/logs/app.log
# Expected: No matches

# Check database
sqlite3 ~/pilots-desk/backend/data/pilot.db "SELECT * FROM transcript_metadata WHERE pii_redaction_count > 0;"
# Expected: Record exists with redaction count
```

### Pass Criteria:
- [x] Credit card redacted
- [x] Email redacted
- [x] Phone redacted
- [x] No PII in backend

---

## Test 7: Error Handling

**Objective**: Verify desktop handles backend errors gracefully

### Steps:

1. Stop backend service
   ```bash
   ssh ricki28@91.98.79.241
   pkill -f "uvicorn app.main:app"
   ```
2. Try to start call in desktop app
3. Observe error handling

### Expected Behavior:
- Desktop detects backend unavailable
- User-friendly error message displays
- App doesn't crash
- Offers retry option

### Pass Criteria:
- [x] Error detected
- [x] Friendly error message
- [x] App stable
- [x] Can retry

---

## Test 8: Offline Mode

**Objective**: Verify degraded functionality when backend unavailable

### Steps:

1. Disconnect network or stop backend
2. Launch desktop app
3. Try to use app features

### Expected Behavior:
- App launches successfully
- Script navigation works (local mode)
- Scoring unavailable (shows "Offline" badge)
- Transcription still works (local Whisper)

### Pass Criteria:
- [x] App launches offline
- [x] Navigation works
- [x] Clear offline indicator
- [x] Transcription functional

---

## Test Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Script Loading | ⬜ | |
| 2. Backend Connectivity | ⬜ | |
| 3. Call Metadata | ⬜ | |
| 4. Transcript Submission | ⬜ | |
| 5. WebSocket Scoring | ⬜ | |
| 6. PII Redaction | ⬜ | |
| 7. Error Handling | ⬜ | |
| 8. Offline Mode | ⬜ | |

**Overall Result**: ⬜ PASS / ⬜ FAIL

**Tester**: ________________
**Date**: ________________
**App Version**: v0.1.1
**Backend Version**: ________________

---

## Known Issues

*Document any issues found during testing*

1.
2.
3.

---

## Notes

*Additional observations*
