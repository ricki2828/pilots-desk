#!/usr/bin/env python3
"""
Whisper API SA Accent Validation Test

Quick validation of Whisper's SA accent support using OpenAI's API.
This helps us determine if local Whisper.cpp will work well before
investing time in compilation and setup.

Cost: ~$0.006 per minute of audio = ~$0.12 for all 5 samples (~20 mins)
"""

import os
import sys
import json
from pathlib import Path
from openai import OpenAI

# Sample metadata
SAMPLES = {
    "sa_sample_johannesburg.mp3": {
        "speaker": "Female, Johannesburg, bilingual (Afrikaans/English)",
        "duration_est": "~4 minutes",
        "region": "Gauteng"
    },
    "sa_sample_cape_town.mp3": {
        "speaker": "Female, 31, speech teacher, Cape Town",
        "duration_est": "~4.5 minutes",
        "region": "Western Cape"
    },
    "sa_sample_pretoria.mp3": {
        "speaker": "Male, 18, Zulu background, Pretoria",
        "duration_est": "~3.5 minutes",
        "region": "Gauteng"
    },
    "sa_sample_male_germiston.mp3": {
        "speaker": "Male, 22, White English SA, Germiston",
        "duration_est": "~4 minutes",
        "region": "Gauteng"
    },
    "sa_sample_male_johannesburg.mp3": {
        "speaker": "Male, 18, Black, Johannesburg",
        "duration_est": "~4 minutes",
        "region": "Gauteng"
    }
}

def get_api_key():
    """Get OpenAI API key from environment or prompt user"""
    api_key = os.environ.get('OPENAI_API_KEY')

    if not api_key:
        print("=" * 70)
        print("OPENAI API KEY REQUIRED")
        print("=" * 70)
        print()
        print("To use this test, you need an OpenAI API key.")
        print()
        print("Get your API key:")
        print("  1. Visit: https://platform.openai.com/signup")
        print("  2. Create account (or login)")
        print("  3. Go to: https://platform.openai.com/api-keys")
        print("  4. Click 'Create new secret key'")
        print("  5. Copy the key")
        print()
        print("Then either:")
        print("  - Set environment variable: export OPENAI_API_KEY='your-key-here'")
        print("  - Or enter it now:")
        print()

        api_key = input("Enter your OpenAI API key: ").strip()

        if not api_key:
            print("\nError: No API key provided. Exiting.")
            sys.exit(1)

    return api_key

def transcribe_audio(client, audio_path, metadata):
    """Transcribe a single audio file using Whisper API"""
    print(f"\nTranscribing: {audio_path.name}")
    print(f"  Speaker: {metadata['speaker']}")
    print(f"  Region: {metadata['region']}")
    print(f"  Duration: {metadata['duration_est']}")

    try:
        with open(audio_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="en",  # English (SA English)
                response_format="verbose_json"  # Get detailed response with timing
            )

        print(f"  ✅ Success!")
        return {
            "filename": audio_path.name,
            "speaker": metadata['speaker'],
            "region": metadata['region'],
            "text": transcript.text,
            "duration": transcript.duration if hasattr(transcript, 'duration') else None
        }

    except Exception as e:
        print(f"  ❌ Error: {e}")
        return {
            "filename": audio_path.name,
            "error": str(e)
        }

def analyze_results(results):
    """Analyze transcription results for SA accent handling"""
    print("\n" + "=" * 70)
    print("ANALYSIS: SA ACCENT HANDLING")
    print("=" * 70)

    successful = [r for r in results if 'text' in r]
    failed = [r for r in results if 'error' in r]

    print(f"\n✅ Successful: {len(successful)}/{len(results)}")
    if failed:
        print(f"❌ Failed: {len(failed)}/{len(results)}")

    if not successful:
        print("\n⚠️  No successful transcriptions to analyze.")
        return

    print("\n" + "-" * 70)
    print("TRANSCRIPTS (first 200 characters each):")
    print("-" * 70)

    for result in successful:
        print(f"\n{result['filename']}")
        print(f"  Speaker: {result['speaker']}")
        text_preview = result['text'][:200] + "..." if len(result['text']) > 200 else result['text']
        print(f"  Transcript: {text_preview}")

    print("\n" + "-" * 70)
    print("INITIAL ASSESSMENT")
    print("-" * 70)

    # Look for common SA pronunciation patterns
    all_text = " ".join([r['text'].lower() for r in successful])

    observations = []

    # Check if transcripts look reasonable
    avg_length = sum(len(r['text']) for r in successful) / len(successful)
    observations.append(f"Average transcript length: {avg_length:.0f} characters")

    # Check for complete sentences
    sentences_count = sum(text.count('.') for text in [r['text'] for r in successful])
    observations.append(f"Total sentences: {sentences_count}")

    # Look for common SA terms that might appear
    sa_indicators = ['afrikaans', 'braai', 'ag', 'lekker', 'rugby', 'cape town', 'johannesburg']
    found_indicators = [term for term in sa_indicators if term in all_text]
    if found_indicators:
        observations.append(f"SA-related terms found: {', '.join(found_indicators)}")

    for obs in observations:
        print(f"  • {obs}")

    print("\n" + "-" * 70)
    print("RECOMMENDATIONS")
    print("-" * 70)

    if len(successful) == len(results):
        print("\n✅ ALL SAMPLES TRANSCRIBED SUCCESSFULLY")
        print()
        print("Next Steps:")
        print("  1. Manually review the transcripts above")
        print("  2. Listen to the audio files and compare with transcripts")
        print("  3. Estimate accuracy (rough WER):")
        print("     - If transcripts look 85%+ accurate → Excellent!")
        print("     - If transcripts look 70-85% accurate → Good (acceptable)")
        print("     - If transcripts look <70% accurate → Concerning")
        print()
        print("  4. If accuracy looks good:")
        print("     → Proceed with local Whisper.cpp setup")
        print("     → Expected: Similar or better accuracy with local model")
        print()
        print("  5. Create ground_truth.json (see WHISPER_TEST_PLAN.md)")
        print("     → For precise WER calculation later with local Whisper")
    else:
        print("\n⚠️  SOME SAMPLES FAILED")
        print()
        print("Review the errors and try again.")
        print("Common issues:")
        print("  - Invalid API key")
        print("  - Rate limiting")
        print("  - Network issues")
        print("  - Audio file format issues")

def estimate_cost(results):
    """Estimate API usage cost"""
    successful = [r for r in results if 'duration' in r and r['duration']]

    if not successful:
        print("\n💰 Estimated cost: ~$0.12 (based on ~20 minutes total audio)")
        return

    total_minutes = sum(r['duration'] for r in successful) / 60
    cost = total_minutes * 0.006  # $0.006 per minute

    print(f"\n💰 Actual cost: ~${cost:.3f}")
    print(f"   ({total_minutes:.1f} minutes × $0.006/min)")

def main():
    """Main test execution"""
    print("=" * 70)
    print("WHISPER API SA ACCENT VALIDATION TEST")
    print("=" * 70)
    print()
    print("This script will:")
    print("  1. Transcribe all 5 SA accent audio samples using OpenAI Whisper API")
    print("  2. Display the transcripts")
    print("  3. Provide initial accuracy assessment")
    print("  4. Help you decide if local Whisper.cpp will work well")
    print()
    print("Estimated cost: ~$0.12 for all samples (~20 minutes of audio)")
    print()

    # Get API key
    api_key = get_api_key()

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)

    # Find audio files
    test_dir = Path(__file__).parent
    audio_files = []

    print("\n" + "=" * 70)
    print("FINDING AUDIO SAMPLES")
    print("=" * 70)

    for filename in SAMPLES.keys():
        audio_path = test_dir / filename
        if audio_path.exists():
            audio_files.append((audio_path, SAMPLES[filename]))
            print(f"  ✅ Found: {filename}")
        else:
            print(f"  ❌ Missing: {filename}")

    if not audio_files:
        print("\n❌ No audio files found!")
        print(f"\nExpected location: {test_dir}")
        print("\nPlease ensure SA audio samples are in the same directory as this script.")
        sys.exit(1)

    print(f"\nFound {len(audio_files)} audio file(s) to test")

    # Confirm before proceeding
    print("\n" + "=" * 70)
    response = input(f"Proceed with testing {len(audio_files)} samples? (y/n): ").strip().lower()
    if response not in ['y', 'yes']:
        print("Test cancelled.")
        sys.exit(0)

    # Transcribe all samples
    print("\n" + "=" * 70)
    print("TRANSCRIBING SAMPLES")
    print("=" * 70)

    results = []
    for audio_path, metadata in audio_files:
        result = transcribe_audio(client, audio_path, metadata)
        results.append(result)

    # Analyze results
    analyze_results(results)

    # Estimate cost
    estimate_cost(results)

    # Save results
    output_file = test_dir / "whisper_api_results.json"
    with open(output_file, 'w') as f:
        json.dump({
            "test_date": "2026-01-24",
            "model": "whisper-1",
            "samples_tested": len(results),
            "successful": len([r for r in results if 'text' in r]),
            "results": results
        }, f, indent=2)

    print(f"\n📄 Full results saved to: {output_file}")
    print("\nTo calculate precise WER:")
    print("  1. Listen to each audio file")
    print("  2. Create ground_truth.json (see WHISPER_TEST_PLAN.md)")
    print("  3. Run calculate_wer.py")
    print()

if __name__ == "__main__":
    main()
