# Quick Testing Guide - v0.6.4

## Download & Install

**Download Link**: https://github.com/ricki2828/pilots-desk/releases/download/v0.6.4/Pilot.s.Desk_0.6.3_x64_en-US.msi

**Size**: 431.3 MB

---

## What Was Fixed

✅ Audio channel overflow (thousands of "Failed to send audio samples" errors)
✅ Sample rate mismatch (48kHz → 16kHz forced)
✅ Channel buffer increased 20x (100 → 2000)

---

## Quick Verification

### 1. Check Logs on Startup

**Look for this (GOOD ✅):**
```
Forcing audio config: 16000 Hz, 1 channels (required for Whisper)
```

**NOT this (BAD ❌):**
```
Using device's default config: 48000 Hz
Failed to send audio samples: sending on a full channel
```

### 2. Test Transcription

- Start capture
- Start transcription
- Speak continuously for 5+ minutes
- **Expected**: Smooth transcription, no channel overflow errors
- **Old behavior**: Thousands of overflow errors, choppy transcription

---

## What to Report

### If It Works ✅
- Confirm: "No channel overflow errors"
- Note any improvements in transcription quality
- Test duration (how long you tested)

### If Issues Persist ❌
- Paste full logs (first 100 lines + any errors)
- Note when errors start appearing
- System info (Windows version, microphone model)

---

## Rollback if Needed

If v0.6.4 has new issues, install previous version:
https://github.com/ricki2828/pilots-desk/releases/tag/v0.6.3

---

## Technical Details

Full documentation: `docs/AUDIO_CHANNEL_FIX_v0.6.4.md`

**Build Info**:
- Release: v0.6.4
- Date: 2026-01-26
- Commit: 7e64a8b
- Build time: 11 minutes
