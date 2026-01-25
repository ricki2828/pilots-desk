# Quick Start: Get SA Accent Audio for Testing

## ✅ COMPLETED - Audio Successfully Sourced!

**Status**: 5 South African accent audio samples successfully downloaded from IDEA archive
**Location**: `/home/ricki28/pilots-desk/tauri-client/test_audio/`
**Details**: See `SA_SAMPLES_SOURCED.md` for complete documentation

---

## What Was Done

Successfully downloaded 5 SA accent audio samples from the International Dialects of English Archive (IDEA):
1. **Johannesburg (Female)** - `sa_sample_johannesburg.mp3` (1.6M)
2. **Cape Town (Female)** - `sa_sample_cape_town.mp3` (1.7M)
3. **Pretoria (Male)** - `sa_sample_pretoria.mp3` (1.4M)
4. **Germiston (Male)** - `sa_sample_male_germiston.mp3` (1.5M)
5. **Johannesburg (Male)** - `sa_sample_male_johannesburg.mp3` (1.5M)

**Total Duration**: ~20 minutes of authentic SA English speech
**Coverage**: Multiple accents (Johannesburg, Cape Town, Pretoria), both male and female speakers

---

## Original Situation (For Reference)

I initially tried to download SA accent audio automatically but ran into some limitations:
- `yt-dlp` requires installation with elevated permissions
- Direct dataset downloads have access issues
- TTS tools aren't available on the system

**Solution**: Used web search to find IDEA archive, then downloaded samples directly with wget ✅

## **Fastest Solution: 3 Options**

### Option A: Manual YouTube Download (5 minutes)

**On your local machine with browser:**

1. Go to these YouTube videos with SA accents:
   - https://www.youtube.com/watch?v=_6v9olH-jdA (SA accent guide)
   - https://www.youtube.com/watch?v=1Vmo9fT7F_8 (SA business interview)
   - Search: "South African call center" for more

2. Use online converter:
   - Go to: https://ytmp3.nu/ or https://y2mate.com/
   - Paste YouTube URL
   - Download as MP3
   - Upload to server: `/home/ricki28/pilots-desk/tauri-client/test_audio/sa_samples/`

3. Convert to WAV 16kHz (on server):
```bash
cd /home/ricki28/pilots-desk/tauri-client/test_audio/sa_samples
# If you have ffmpeg:
ffmpeg -i downloaded.mp3 -ar 16000 -ac 1 sa_sample.wav
```

### Option B: Use Free TTS (Instant - Recommended for Quick Test)

**Generate SA accent test audio using online TTS:**

1. Visit: https://ttsfree.com/text-to-speech/english-south-africa
2. Paste this Sky TV sales pitch:
```
Hi, this is Sarah calling from Sky TV New Zealand. We have a special promotion on our Sky Sport package this month. It includes all rugby, cricket, and football coverage for only twenty nine dollars ninety nine per month. Would you be interested in signing up today? I'll need your email address to send you the details. Can I confirm your contact number as well?
```
3. Select "English (South Africa)" voice
4. Generate and download the audio
5. Upload to: `/home/ricki28/pilots-desk/tauri-client/test_audio/sa_samples/tts_sa_sample.wav`

**Repeat with these variations:**
- Different SA voices (male/female if available)
- Different sales phrases
- Sky TV specific terms

### Option C: I'll Create Synthetic Test Data

**Using text as proxy:**

Since we can't easily get real audio right now, I can:

1. Create test transcripts that simulate SA speech patterns
2. Use these to test the script navigation logic
3. Skip Whisper testing for now and come back to it later

**This lets us**:
- Test script engine immediately
- Test backend scoring
- Test dashboard integration
- Add real Whisper testing later

## What I Recommend

**For RIGHT NOW** (next 30 minutes):

1. Use **Option B (TTS)** to generate 3-5 SA accent audio files
2. I'll help you test Whisper with those
3. We'll see if accuracy is good enough

**For LATER** (when you have time):

1. Get real SA call center audio from a colleague or client
2. Run comprehensive testing
3. Optimize if needed

## How to Proceed

Tell me which option you want:

**A)** "Manual YouTube" - I'll give you exact videos to download
**B)** "Use TTS" - I'll guide you through generating test audio online (FASTEST)
**C)** "Skip audio for now" - We test everything except Whisper, come back to it later

**Or** if you have another way to get SA audio (colleague, client samples, etc.), let me know and I'll help you use that.

---

**Sources**:
- [AfriSpeech-200 Dataset](https://huggingface.co/datasets/intronhealth/afrispeech-200)
- [Mozilla Common Voice](https://commonvoice.mozilla.org/en/datasets)
- [OpenSLR SA Dataset](https://www.openslr.org/32/)
- [SA TTS Online Tool](https://ttsfree.com/text-to-speech/english-south-africa)
