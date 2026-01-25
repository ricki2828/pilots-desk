# Windows Testing Guide

**Purpose:** Validate Phase 1 completion on Windows with real hardware
**Target:** Windows 10/11 workstation with microphone and speakers
**Focus:** WASAPI, Whisper.cpp, and South African accent validation

---

## Pre-Test Setup

### 1. Environment Preparation

```powershell
# Clone repository
git clone <repository-url>
cd pilots-desk

# Install dependencies
npm install

# Verify Rust toolchain
rustc --version
cargo --version
```

### 2. Install Whisper.cpp Binary

**Download pre-built binary**:
```powershell
# Create sidecars directory
New-Item -ItemType Directory -Force -Path src-tauri\sidecars

# Download from GitHub releases or build from source
# Place whisper.exe in src-tauri\sidecars\
```

**Download model**:
```powershell
# Create models directory
New-Item -ItemType Directory -Force -Path models

# Download ggml-small.bin (recommended for SA accents)
curl -L -o models\ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

### 3. Prepare Test Audio

**Option A: Live Testing with SA Agents**
- Recruit 3-5 South African speakers from different regions:
  - Gauteng (Johannesburg accent)
  - Western Cape (Cape Town accent)
  - KwaZulu-Natal (Durban accent)

**Option B: Pre-recorded SA Audio**
- Record sample conversations in .wav format (16kHz, mono)
- Include common Sky TV phrases:
  - "Hi, this is calling from Sky TV"
  - "I love rugby"
  - "I'm interested in the sport package"
  - "What's the monthly cost?"

---

## Test Suite

### Test 1: Build Verification

**Objective:** Ensure application compiles and runs on Windows

```powershell
# Development build
npm run tauri dev
```

**Expected Result:**
- Application window opens
- No compilation errors
- UI displays correctly
- Status shows "Ready"

**Pass Criteria:**
- [x] Application starts
- [x] No errors in console
- [x] UI renders properly

---

### Test 2: Microphone Capture

**Objective:** Verify cpal microphone capture on Windows

**Steps:**
1. Start application
2. Click "Start Capture"
3. Speak into microphone
4. Observe microphone level meter

**Expected Result:**
- Microphone bar shows green/yellow activity
- Level percentage updates in real-time
- Combined level reflects mic input

**Pass Criteria:**
- [x] Microphone detected automatically
- [x] Audio levels display correctly
- [x] No crackling or dropouts
- [x] RMS calculation accurate

**Troubleshooting:**
```powershell
# List audio devices
# In Rust, cpal will enumerate automatically
# Check Windows Settings → Sound → Input
```

---

### Test 3: WASAPI System Audio Loopback

**Objective:** Capture system audio (customer voice from dialer)

**Setup:**
1. Play audio through speakers (YouTube video, test tone)
2. Or run dialer software with active call

**Steps:**
1. Start application
2. Click "Start Capture"
3. Play audio through system
4. Observe "System Audio (WASAPI)" meter

**Expected Result:**
- System audio bar shows activity
- Combined level = mic + system
- No echo feedback

**Pass Criteria:**
- [x] WASAPI detects loopback device
- [x] System audio levels display
- [x] Both sources mix correctly
- [x] No audio routing issues

**Known Issue:**
If WASAPI shows 0%, the loopback implementation is not yet complete. See `docs/WASAPI_TODO.md` for implementation steps.

---

### Test 4: Whisper Transcription (English Baseline)

**Objective:** Verify Whisper.cpp integration works correctly

**Steps:**
1. Start capture
2. Click "Start Transcription"
3. Speak clear English phrases:
   - "Hello, this is a test"
   - "The quick brown fox jumps over the lazy dog"
   - "Testing one two three"

**Expected Result:**
- Transcripts appear within 400ms
- Text is accurate (>95%)
- Confidence scores >80%
- No "[MOCK]" prefix

**Pass Criteria:**
- [x] Real transcription (not mock mode)
- [x] Latency < 400ms
- [x] Accuracy > 95%
- [x] Timestamps correct

**Metrics:**
```powershell
# Measure latency
# Time from speaking to transcript appearing in UI
# Target: <400ms
```

---

### Test 5: South African Accent Validation

**Objective:** Validate >95% accuracy for SA accents

**Test Phrases (SA-specific):**
1. "Hi, I'm calling from Sky TV New Zealand"
2. "We have special packages for rugby fans"
3. "The All Blacks are playing this weekend"
4. "Would you like to hear about our sport package?"
5. "The monthly cost is twenty-nine ninety-nine"

**Test Accents:**
- **Gauteng**: "rugby" → "ragby" pronunciation
- **Western Cape**: Flatter vowels
- **KwaZulu-Natal**: Zulu-influenced pronunciation

**Steps:**
1. Have SA speaker read each phrase
2. Record transcription result
3. Calculate accuracy per phrase
4. Test with multiple speakers

**Pass Criteria:**
- [x] Accuracy ≥ 95% across all phrases
- [x] All three accent regions ≥ 95%
- [x] Key words ("rugby", "sport", "package") transcribed correctly
- [x] Numbers transcribed accurately

**Accuracy Calculation:**
```
Accuracy = (Correct Words / Total Words) × 100%

Example:
Spoken: "Hi I'm calling from Sky TV"
Transcribed: "Hi I'm calling from Sky TV"
Accuracy: 6/6 = 100%

Spoken: "The All Blacks are playing"
Transcribed: "The All Blacks are playing"
Accuracy: 5/5 = 100%
```

**Failure Threshold:**
- If accuracy < 95%, consider:
  - Fine-tuning Whisper model
  - Using larger model (medium)
  - Pre-processing audio (noise reduction)
  - Adjusting RMS thresholds

---

### Test 6: Script Navigation with Voice

**Objective:** Verify voice-triggered script navigation

**Steps:**
1. Load Sky TV script (auto-loads on start)
2. Start capture + transcription
3. Read script nodes aloud:
   - "Hi, I'm calling from Sky TV" → should advance to needs discovery
   - "I love rugby" → should trigger Sport package
   - "Not interested" → should branch to objection handling

**Expected Result:**
- Script auto-navigates when keywords detected
- Current node highlights
- Next nodes preview updates
- Widget appears on sport pitch node

**Pass Criteria:**
- [x] Keyword matching works
- [x] Auto-navigation reliable
- [x] No false positives
- [x] Latency acceptable (<2s from speech to navigation)

---

### Test 7: Package Calculator Voice Trigger

**Objective:** Test "I love rugby" → Sport package auto-enable

**Steps:**
1. Navigate to sport pitch node (manually or via voice)
2. Say "I love rugby"
3. Observe package calculator

**Expected Result:**
- Sport package checkbox automatically enables
- Total updates to $29.99
- Visual feedback shows selection

**Pass Criteria:**
- [x] Trigger keywords work ("rugby", "all blacks", "super rugby")
- [x] Auto-selection happens immediately
- [x] Multiple triggers work (say "cricket" for movies)

---

### Test 8: Manual Navigation

**Objective:** Verify keyboard and click navigation

**Steps:**
1. Press ↓ arrow key → should advance to next node
2. Press ↑ arrow key → should go back
3. Click a "Next Steps" card → should jump to that node
4. Click Reset → should return to greeting node

**Pass Criteria:**
- [x] Arrow keys navigate sequentially
- [x] Click-to-jump works
- [x] Back button maintains history
- [x] Reset clears history

---

### Test 9: Hold/Pause Functionality

**Objective:** Test pause during customer hold

**Steps:**
1. Start transcription
2. Click "Pause (Customer on Hold)"
3. Speak → should not transcribe
4. Click "Resume (Customer Back)"
5. Speak → should transcribe again

**Expected Result:**
- Pause stops transcription immediately
- Status indicator shows "Paused"
- Resume restarts transcription
- No audio lost on resume

**Pass Criteria:**
- [x] Pause stops transcription
- [x] Resume restarts correctly
- [x] Status indicators accurate
- [x] No memory leaks on pause/resume cycles

---

### Test 10: Stress Testing

**Objective:** Validate stability under load

**Long Call Test:**
```powershell
# Run for 30 minutes continuously
# Monitor:
# - Memory usage (Task Manager)
# - CPU usage
# - Transcript accuracy over time
# - No crashes
```

**Rapid Speech Test:**
- Speak continuously without pauses
- Verify transcripts keep up
- No buffer overflows

**Pass Criteria:**
- [x] Runs for 30+ minutes without crash
- [x] Memory usage stable (<500 MB)
- [x] CPU usage reasonable (<30% average)
- [x] Accuracy doesn't degrade over time

---

### Test 11: Multiple Call Cycles

**Objective:** Test reset and multi-call workflow

**Steps:**
1. Complete full Sky TV pitch (start to close)
2. Click Reset
3. Start new pitch
4. Repeat 10 times

**Expected Result:**
- Each reset clears state
- No data leaks between calls
- Script navigation consistent

**Pass Criteria:**
- [x] Reset clears all variables
- [x] Script returns to greeting node
- [x] No orphaned state
- [x] 10 consecutive calls complete successfully

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Test Method |
|--------|--------|-------------|
| Whisper Latency | < 400ms | Stopwatch from speech to transcript |
| UI Responsiveness | 60 fps | Task Manager GPU usage |
| Memory Usage | < 500 MB | Task Manager during 30-min call |
| CPU Usage | < 30% avg | Task Manager during transcription |
| Startup Time | < 5 sec | Stopwatch from launch to ready |
| Script Load Time | < 1 sec | Stopwatch from file select to display |

### Measurement Tools

```powershell
# Monitor performance
Get-Process "pilots-desk" | Select-Object CPU, WorkingSet, Handles

# Or use Task Manager:
# Performance tab → CPU, Memory, GPU
```

---

## SA Accent Test Results Template

```markdown
### Test Session: [Date]

**Speaker Profile:**
- Region: [Gauteng / Western Cape / KwaZulu-Natal]
- Age: [Range]
- First Language: [English / Afrikaans / Zulu / Other]

**Test Phrases:**

| # | Phrase | Transcribed | Accuracy | Notes |
|---|--------|-------------|----------|-------|
| 1 | Hi I'm calling from Sky TV | [Result] | [%] | [Any issues] |
| 2 | We have rugby packages | [Result] | [%] | |
| 3 | The All Blacks are playing | [Result] | [%] | |
| 4 | Would you like the sport package | [Result] | [%] | |
| 5 | Twenty-nine ninety-nine per month | [Result] | [%] | |

**Overall Accuracy:** [Average %]
**Pass/Fail:** [PASS if ≥95%]
**Recommendations:** [If failed, what to improve]
```

---

## Bug Reporting

If tests fail, report with:

1. **Environment:**
   - Windows version (10/11)
   - Hardware specs (CPU, RAM)
   - Audio hardware (mic, speakers)

2. **Repro Steps:**
   - Exact steps to reproduce
   - Expected vs actual behavior

3. **Logs:**
   ```powershell
   # Collect logs
   Get-Content $env:APPDATA\com.cosauce.pilotsdesk\logs\*.log
   ```

4. **Audio Samples:**
   - If transcription issue, include .wav recording

---

## Phase 1 Completion Checklist

All tests must pass before Phase 1 is considered complete:

**Audio System:**
- [ ] Microphone capture works
- [ ] WASAPI system audio works
- [ ] Audio levels accurate
- [ ] No distortion or dropouts

**Transcription:**
- [ ] Whisper.cpp integrated
- [ ] Latency < 400ms
- [ ] SA accent accuracy ≥ 95%
- [ ] All three SA regions tested

**Script System:**
- [ ] Script loads correctly
- [ ] Voice navigation works
- [ ] Manual navigation works
- [ ] Hold/pause functional

**Stability:**
- [ ] 30-minute call completes
- [ ] No memory leaks
- [ ] No crashes
- [ ] 10 consecutive calls work

**Installer:**
- [ ] MSI builds successfully
- [ ] Installs on clean Windows
- [ ] Uninstalls cleanly
- [ ] Upgrade path works

---

## Next Steps After Testing

1. **If all tests pass:**
   - Mark Phase 1 complete
   - Document any caveats
   - Proceed to Phase 3 (Scoring & Coaching)

2. **If tests fail:**
   - Fix blocking issues
   - Re-test failed scenarios
   - Update documentation

3. **Performance optimization:**
   - Profile bottlenecks
   - Optimize hot paths
   - Reduce memory footprint

---

**Testing Contact:** [Your contact info]
**Expected Test Duration:** 4-6 hours (full suite)
**Required Resources:** Windows PC, SA speakers, headset
