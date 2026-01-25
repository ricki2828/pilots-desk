# Whisper API Quick Validation Test - README

**Purpose**: Quickly validate that Whisper can handle South African accents using OpenAI's Whisper API, before setting up local Whisper.cpp.

**Time Required**: 5-10 minutes
**Cost**: ~$0.12 (about 12 cents for all 5 audio samples)

---

## What This Test Does

1. ✅ Transcribes all 5 SA accent audio samples using OpenAI's Whisper API (same model as local Whisper.cpp)
2. ✅ Shows you the transcripts immediately
3. ✅ Helps you assess accuracy visually
4. ✅ Validates that Whisper can handle SA accents (Johannesburg, Cape Town, Pretoria)
5. ✅ Gives you confidence to proceed with local Whisper.cpp setup

**If the API handles SA accents well, local Whisper.cpp will too** (same model, same accuracy).

---

## Prerequisites

### 1. Get an OpenAI API Key

**New to OpenAI?** It's quick:

1. Visit: https://platform.openai.com/signup
2. Create account (free, takes 2 minutes)
3. Add payment method (you'll only be charged for usage: ~$0.12)
4. Go to: https://platform.openai.com/api-keys
5. Click "Create new secret key"
6. Copy the key (looks like: `sk-proj-...`)

**Cost**: ~$0.006 per minute of audio
- Our 5 samples = ~20 minutes
- **Total cost: ~$0.12** (12 cents)

### 2. Have the Audio Samples

Already downloaded! Located in this directory:
- `sa_sample_johannesburg.mp3` (Female, Johannesburg)
- `sa_sample_cape_town.mp3` (Female, Cape Town)
- `sa_sample_pretoria.mp3` (Male, Pretoria)
- `sa_sample_male_germiston.mp3` (Male, Germiston)
- `sa_sample_male_johannesburg.mp3` (Male, Johannesburg)

---

## How to Run the Test

### Option A: Simple One-Command Run (Recommended)

```bash
cd /home/ricki28/pilots-desk/tauri-client/test_audio
./run_whisper_api_test.sh
```

**That's it!** The script will:
1. Create a Python virtual environment (if needed)
2. Install the OpenAI library (if needed)
3. Prompt you for your API key (if not set)
4. Transcribe all 5 samples
5. Show you the results

### Option B: Manual Run (if Option A doesn't work)

```bash
cd /home/ricki28/pilots-desk/tauri-client/test_audio

# Set your API key
export OPENAI_API_KEY='your-api-key-here'

# Run the test
./whisper_test_env/bin/python test_whisper_api.py
```

---

## What You'll See

The test will output something like:

```
==================================================
WHISPER API SA ACCENT VALIDATION TEST
==================================================

Transcribing: sa_sample_johannesburg.mp3
  Speaker: Female, Johannesburg, bilingual
  Region: Gauteng
  Duration: ~4 minutes
  ✅ Success!

Transcribing: sa_sample_cape_town.mp3
  Speaker: Female, 31, speech teacher, Cape Town
  Region: Western Cape
  Duration: ~4.5 minutes
  ✅ Success!

[... more samples ...]

==================================================
ANALYSIS: SA ACCENT HANDLING
==================================================

✅ Successful: 5/5

--------------------------------------------------
TRANSCRIPTS (first 200 characters each):
--------------------------------------------------

sa_sample_johannesburg.mp3
  Speaker: Female, Johannesburg, bilingual
  Transcript: I grew up speaking only Afrikaans until
  the age of 5, when I learned English from British
  neighbors who acted as babysitters...

[... more transcripts ...]

--------------------------------------------------
RECOMMENDATIONS
--------------------------------------------------

✅ ALL SAMPLES TRANSCRIBED SUCCESSFULLY

Next Steps:
  1. Manually review the transcripts above
  2. Listen to the audio files and compare with transcripts
  3. Estimate accuracy (rough WER)
  4. If accuracy looks good → Proceed with local Whisper.cpp

💰 Actual cost: ~$0.120
   (20.0 minutes × $0.006/min)

📄 Full results saved to: whisper_api_results.json
```

---

## How to Interpret Results

### Excellent (Proceed with Confidence)
- All 5 samples transcribed successfully ✅
- Transcripts look 85%+ accurate when you read them
- SA pronunciation captured well (e.g., vowel shifts, R sounds)
- No major gibberish or nonsense words

**→ Proceed with local Whisper.cpp setup** - it will work great!

### Good (Acceptable)
- 4-5 samples transcribed successfully ✅
- Transcripts look 70-85% accurate
- Some minor errors but generally understandable
- Specific SA words may be misspelled but phonetically close

**→ Still proceed with local Whisper.cpp** - accuracy is acceptable for production.

### Concerning (Need Investigation)
- <4 samples successful ❌
- Transcripts look <70% accurate
- Major errors, gibberish, or complete nonsense
- SA accents not captured at all

**→ Investigate further** - may need Whisper Medium model or alternative STT.

---

## Next Steps After Testing

### If Results are Good

1. **Review the saved results**:
   ```bash
   cat whisper_api_results.json
   ```

2. **Listen and compare**:
   - Play each audio file
   - Read the transcript
   - Roughly estimate accuracy

3. **Proceed with local Whisper.cpp**:
   - See: `WHISPER_TEST_PLAN.md` for full setup guide
   - See: `SA_TESTING_STATUS.md` for Windows build instructions
   - Expected: Local Whisper.cpp will have **same or better** accuracy

4. **Calculate precise WER** (later, with local Whisper):
   - Create `ground_truth.json` by manually transcribing samples
   - Run `calculate_wer.py` (see `WHISPER_TEST_PLAN.md`)
   - Target: <15% WER for production

### If Results are Concerning

1. **Check the errors**:
   - Review failed samples in `whisper_api_results.json`
   - Common issues: network errors, file format, API limits

2. **Try again**:
   - Fix any errors (API key, network)
   - Re-run the test

3. **If accuracy is poor**:
   - Try Whisper Medium model (better accuracy, slower)
   - Consider alternative STT services with SA accent support
   - Collect more diverse SA audio samples

---

## Files Created by This Test

After running, you'll have:

```
test_audio/
├── whisper_test_env/          # Python virtual environment (can delete after)
├── test_whisper_api.py        # Test script (keep)
├── run_whisper_api_test.sh    # Runner script (keep)
├── whisper_api_results.json   # TEST RESULTS (REVIEW THIS!)
└── API_TEST_README.md         # This file
```

---

## Troubleshooting

### "API key is invalid"
- Double-check your API key (starts with `sk-proj-...`)
- Ensure you've added payment method to OpenAI account
- Try creating a new API key

### "Rate limit exceeded"
- Wait 1 minute and try again
- OpenAI has rate limits for new accounts

### "Audio file not found"
- Ensure you're in `/home/ricki28/pilots-desk/tauri-client/test_audio/`
- Check audio files exist: `ls -la sa_sample_*.mp3`

### "ImportError: No module named 'openai'"
- Run: `./run_whisper_api_test.sh` (it auto-installs)
- Or manually: `./whisper_test_env/bin/pip install openai`

### Script won't run
- Make executable: `chmod +x run_whisper_api_test.sh test_whisper_api.py`
- Check Python 3: `python3 --version` (should be 3.7+)

---

## FAQ

**Q: Is this the same Whisper model as local Whisper.cpp?**
A: Yes! OpenAI's API uses the same Whisper model. If the API works well, local will too.

**Q: Will this test cost me anything?**
A: Yes, ~$0.12 for all 5 samples. Very cheap validation.

**Q: Do I need to do this if I have Windows access?**
A: No, but it's faster! API test = 10 minutes vs Windows setup = 2-3 hours.

**Q: Can I test just 1-2 samples to save money?**
A: Yes! Edit `test_whisper_api.py` and comment out samples you don't want.

**Q: What if I don't want to pay for the API?**
A: Go to Windows machine and use local Whisper.cpp (free but takes longer to set up).

**Q: Will my audio be stored by OpenAI?**
A: Per OpenAI's policy: API data is not used for training and is deleted after 30 days. See: https://openai.com/policies/api-data-usage-policies

---

## Summary

**Run this test to**:
- ✅ Validate Whisper can handle SA accents
- ✅ See actual transcripts in 10 minutes
- ✅ Decide if local Whisper.cpp will work
- ✅ Save time before full setup

**After successful test**:
- Proceed with local Whisper.cpp integration
- Build Windows installer
- Deploy to production

---

**Ready to run?**

```bash
cd /home/ricki28/pilots-desk/tauri-client/test_audio
./run_whisper_api_test.sh
```

Good luck! 🚀
