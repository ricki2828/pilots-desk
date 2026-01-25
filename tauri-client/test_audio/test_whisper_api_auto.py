#!/usr/bin/env python3
"""
Whisper API SA Accent Validation Test (Non-Interactive)
Automatically runs without prompts - for automated testing
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
    """Get OpenAI API key from environment"""
    api_key = os.environ.get('OPENAI_API_KEY')

    if not api_key:
        print("❌ Error: OPENAI_API_KEY environment variable not set")
        print()
        print("Please set it:")
        print("  export OPENAI_API_KEY='your-key-here'")
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
                language="en",
                response_format="verbose_json"
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

def main():
    """Main test execution"""
    print("=" * 70)
    print("WHISPER API SA ACCENT VALIDATION TEST (AUTO)")
    print("=" * 70)
    print()

    # Get API key
    api_key = get_api_key()
    client = OpenAI(api_key=api_key)

    # Find audio files
    test_dir = Path(__file__).parent
    audio_files = []

    print("Finding audio samples...")
    for filename in SAMPLES.keys():
        audio_path = test_dir / filename
        if audio_path.exists():
            audio_files.append((audio_path, SAMPLES[filename]))
            print(f"  ✅ {filename}")

    if not audio_files:
        print("\n❌ No audio files found!")
        sys.exit(1)

    print(f"\n✅ Found {len(audio_files)} audio files")
    print("\n" + "=" * 70)
    print("STARTING TRANSCRIPTION")
    print("=" * 70)

    # Transcribe all samples
    results = []
    for audio_path, metadata in audio_files:
        result = transcribe_audio(client, audio_path, metadata)
        results.append(result)

    # Analyze results
    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)

    successful = [r for r in results if 'text' in r]
    failed = [r for r in results if 'error' in r]

    print(f"\n✅ Successful: {len(successful)}/{len(results)}")
    if failed:
        print(f"❌ Failed: {len(failed)}/{len(results)}")
        for f in failed:
            print(f"  - {f['filename']}: {f['error']}")

    if successful:
        print("\n" + "-" * 70)
        print("TRANSCRIPTS (first 200 characters each):")
        print("-" * 70)

        for result in successful:
            print(f"\n{result['filename']}")
            print(f"  Speaker: {result['speaker']}")
            text_preview = result['text'][:200] + "..." if len(result['text']) > 200 else result['text']
            print(f"  Transcript: {text_preview}")

        # Calculate cost
        if any('duration' in r and r['duration'] for r in successful):
            total_minutes = sum(r.get('duration', 0) for r in successful) / 60
            cost = total_minutes * 0.006
            print(f"\n💰 Cost: ~${cost:.3f} ({total_minutes:.1f} minutes)")

    # Save results
    output_file = test_dir / "whisper_api_results.json"
    with open(output_file, 'w') as f:
        json.dump({
            "test_date": "2026-01-24",
            "model": "whisper-1",
            "samples_tested": len(results),
            "successful": len(successful),
            "results": results
        }, f, indent=2)

    print(f"\n📄 Results saved to: {output_file.name}")

    # Final assessment
    print("\n" + "=" * 70)
    print("ASSESSMENT")
    print("=" * 70)

    if len(successful) == len(results):
        print("\n✅ ALL SAMPLES TRANSCRIBED SUCCESSFULLY!")
        print()
        print("Next Steps:")
        print("  1. Review transcripts above")
        print("  2. Listen to audio files and compare")
        print("  3. If accuracy looks good (85%+):")
        print("     → Proceed with local Whisper.cpp setup")
        print("  4. See: SA_TESTING_STATUS.md for Windows instructions")
    else:
        print("\n⚠️  SOME SAMPLES FAILED")
        print("Review errors above and retry.")

    print()

if __name__ == "__main__":
    main()
