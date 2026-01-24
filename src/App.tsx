import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AudioLevels {
  mic_level: number;
  system_level: number;
  combined_level: number;
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({
    mic_level: 0,
    system_level: 0,
    combined_level: 0,
  });
  const [status, setStatus] = useState<string>("Not initialized");
  const [error, setError] = useState<string | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    initializeAudio();
  }, []);

  // Poll audio levels while capturing
  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(async () => {
      try {
        const levels = await invoke<AudioLevels>("get_audio_levels");
        setAudioLevels(levels);
      } catch (err) {
        console.error("Failed to get audio levels:", err);
      }
    }, 100); // Update every 100ms for smooth visualization

    return () => clearInterval(interval);
  }, [isCapturing]);

  const initializeAudio = async () => {
    try {
      setStatus("Initializing...");
      const result = await invoke<string>("init_audio");
      setIsInitialized(true);
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err as string);
      setStatus("Initialization failed");
    }
  };

  const handleStartCapture = async () => {
    try {
      setStatus("Starting capture...");
      const result = await invoke<string>("start_capture");
      setIsCapturing(true);
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err as string);
      setStatus("Failed to start capture");
    }
  };

  const handleStopCapture = async () => {
    try {
      setStatus("Stopping capture...");
      const result = await invoke<string>("stop_capture");
      setIsCapturing(false);
      setStatus(result);
      setAudioLevels({
        mic_level: 0,
        system_level: 0,
        combined_level: 0,
      });
      setError(null);
    } catch (err) {
      setError(err as string);
      setStatus("Failed to stop capture");
    }
  };

  const getLevelColor = (level: number): string => {
    if (level > 0.7) return "bg-red-500";
    if (level > 0.4) return "bg-yellow-500";
    if (level > 0.1) return "bg-green-500";
    return "bg-gray-300";
  };

  const getLevelWidth = (level: number): string => {
    return `${Math.min(level * 100, 100)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Pilot's Desk</h1>
          <p className="text-gray-300">Phase 1: Audio Capture Test</p>
        </div>

        {/* Status Card */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">System Status</h2>
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isCapturing
                    ? "bg-green-500 animate-pulse"
                    : isInitialized
                    ? "bg-yellow-500"
                    : "bg-gray-500"
                }`}
              />
              <span className="text-sm">
                {isCapturing ? "Recording" : isInitialized ? "Ready" : "Offline"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 w-24">Status:</span>
              <span className="text-white font-mono text-sm">{status}</span>
            </div>
            {error && (
              <div className="flex items-center space-x-2">
                <span className="text-red-400 w-24">Error:</span>
                <span className="text-red-300 font-mono text-sm">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Audio Levels */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">Audio Levels</h2>

          <div className="space-y-6">
            {/* Microphone Level */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">Microphone</span>
                <span className="text-gray-400 font-mono text-sm">
                  {(audioLevels.mic_level * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${getLevelColor(
                    audioLevels.mic_level
                  )}`}
                  style={{ width: getLevelWidth(audioLevels.mic_level) }}
                />
              </div>
            </div>

            {/* System Audio Level */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">System Audio (WASAPI)</span>
                <span className="text-gray-400 font-mono text-sm">
                  {(audioLevels.system_level * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${getLevelColor(
                    audioLevels.system_level
                  )}`}
                  style={{ width: getLevelWidth(audioLevels.system_level) }}
                />
              </div>
              {audioLevels.system_level === 0 && isCapturing && (
                <p className="text-xs text-yellow-400 mt-1">
                  WASAPI loopback not yet implemented. See docs/WASAPI_TODO.md
                </p>
              )}
            </div>

            {/* Combined Level */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-300 font-semibold">Combined Output</span>
                <span className="text-gray-400 font-mono text-sm">
                  {(audioLevels.combined_level * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${getLevelColor(
                    audioLevels.combined_level
                  )}`}
                  style={{ width: getLevelWidth(audioLevels.combined_level) }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">Controls</h2>

          <div className="flex space-x-4">
            {!isCapturing ? (
              <button
                onClick={handleStartCapture}
                disabled={!isInitialized}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  isInitialized
                    ? "bg-green-600 hover:bg-green-700 active:bg-green-800"
                    : "bg-gray-600 cursor-not-allowed"
                }`}
              >
                Start Capture
              </button>
            ) : (
              <button
                onClick={handleStopCapture}
                className="px-6 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 transition-all"
              >
                Stop Capture
              </button>
            )}

            <button
              onClick={initializeAudio}
              disabled={isCapturing}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                !isCapturing
                  ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
            >
              Reinitialize
            </button>
          </div>

          <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-700">
            <h3 className="text-sm font-semibold mb-2 text-gray-300">
              Development Notes:
            </h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Microphone capture using cpal (working)</li>
              <li>• WASAPI loopback requires Windows + windows-rs crate</li>
              <li>• South African accent testing needed</li>
              <li>• Next: Whisper.cpp integration for STT</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
