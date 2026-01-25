#!/bin/bash

# Whisper API Test Runner
# Automatically uses the virtual environment to run the test

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/whisper_test_env"
TEST_SCRIPT="$SCRIPT_DIR/test_whisper_api.py"

echo "========================================="
echo "Whisper API SA Accent Test Runner"
echo "========================================="
echo ""

# Check if venv exists
if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Virtual environment not found at: $VENV_DIR"
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"

    echo "Installing openai library..."
    "$VENV_DIR/bin/pip" install -q openai

    echo "✅ Environment setup complete"
    echo ""
fi

# Check if test script exists
if [ ! -f "$TEST_SCRIPT" ]; then
    echo "❌ Test script not found at: $TEST_SCRIPT"
    exit 1
fi

# Check for API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY environment variable not set"
    echo ""
    echo "You'll be prompted to enter your API key when the test starts."
    echo ""
    echo "To avoid this prompt in the future, set the environment variable:"
    echo "  export OPENAI_API_KEY='your-api-key-here'"
    echo ""
fi

# Run the test
echo "Starting test..."
echo ""

"$VENV_DIR/bin/python" "$TEST_SCRIPT"

echo ""
echo "========================================="
echo "Test complete!"
echo "========================================="
