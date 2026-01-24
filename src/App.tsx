import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface AudioLevels {
  mic_level: number;
  system_level: number;
  combined_level: number;
}

interface Transcript {
  text: string;
  confidence: number;
  timestamp: number;
  is_final: boolean;
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({
    mic_level: 0,
    system_level: 0,
    combined_level: 0,
  });
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [status, setStatus] = useState<string>("Not initialized");
  const [error, setError] = useState<string | null>(null);

  // Initialize audio and whisper on mount
  useEffect(() => {
    const init = async () => {
      await initializeAudio();
      await initializeWhisper();
    };
    init();

    // Listen for transcript events
    const unlisten = listen<Transcript>("transcript", (event) => {
      console.log("Received transcript:", event.payload);
      setTranscripts((prev) => [...prev, event.payload]);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
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
      setStatus("Initializing audio...");
      const result = await invoke<string>("init_audio");
      setIsInitialized(true);
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err as string);
      setStatus("Audio initialization failed");
    }
  };

  const initializeWhisper = async () => {
    try {
      setStatus("Initializing Whisper...");
      const result = await invoke<string>("init_whisper");
      setStatus(result);
    } catch (err) {
      console.error("Whisper init failed:", err);
      setError(err as string);
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

      // Stop transcription first if running
      if (isTranscribing) {
        await handleStopTranscription();
      }

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

  const handleStartTranscription = async () => {
    try {
      setStatus("Starting transcription...");
      const result = await invoke<string>("start_transcription");
      setIsTranscribing(true);
      setStatus(result + " (mock mode)");
      setError(null);
    } catch (err) {
      setError(err as string);
      setStatus("Failed to start transcription");
    }
  };

  const handleStopTranscription = async () => {
    try {
      setStatus("Stopping transcription...");
      const result = await invoke<string>("stop_transcription");
      setIsTranscribing(false);
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err as string);
      setStatus("Failed to stop transcription");
    }
  };

  const handleClearTranscripts = () => {
    setTranscripts([]);
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

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Pilot's Desk</h1>
          <p className="text-gray-300">Phase 1: Audio Capture + Transcription Test</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Audio & Controls */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">System Status</h2>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isTranscribing
                        ? "bg-green-500 animate-pulse"
                        : isCapturing
                        ? "bg-yellow-500 animate-pulse"
                        : isInitialized
                        ? "bg-yellow-500"
                        : "bg-gray-500"
                    }`}
                  />
                  <span className="text-sm">
                    {isTranscribing
                      ? "Transcribing"
                      : isCapturing
                      ? "Recording"
                      : isInitialized
                      ? "Ready"
                      : "Offline"}
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
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
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

              <div className="space-y-3">
                {/* Audio Controls */}
                <div className="flex space-x-3">
                  {!isCapturing ? (
                    <button
                      onClick={handleStartCapture}
                      disabled={!isInitialized}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
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
                      className="flex-1 px-6 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 transition-all"
                    >
                      Stop Capture
                    </button>
                  )}
                </div>

                {/* Transcription Controls */}
                <div className="flex space-x-3">
                  {!isTranscribing ? (
                    <button
                      onClick={handleStartTranscription}
                      disabled={!isCapturing}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                        isCapturing
                          ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                          : "bg-gray-600 cursor-not-allowed"
                      }`}
                    >
                      Start Transcription
                    </button>
                  ) : (
                    <button
                      onClick={handleStopTranscription}
                      className="flex-1 px-6 py-3 rounded-lg font-semibold bg-orange-600 hover:bg-orange-700 active:bg-orange-800 transition-all"
                    >
                      Stop Transcription
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-700">
                <h3 className="text-sm font-semibold mb-2 text-gray-300">
                  Development Notes:
                </h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Microphone capture using cpal (working)</li>
                  <li>• Whisper in MOCK MODE - simulates transcription</li>
                  <li>• WASAPI loopback requires Windows + windows-rs crate</li>
                  <li>• South African accent testing needed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Transcript Display */}
          <div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Live Transcript</h2>
                <button
                  onClick={handleClearTranscripts}
                  disabled={transcripts.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    transcripts.length > 0
                      ? "bg-gray-700 hover:bg-gray-600 active:bg-gray-500"
                      : "bg-gray-700 opacity-50 cursor-not-allowed"
                  }`}
                >
                  Clear
                </button>
              </div>

              {transcripts.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <p className="text-lg mb-2">No transcripts yet</p>
                    <p className="text-sm">
                      Start capture and transcription to see live text
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {transcripts.map((transcript, index) => (
                    <div
                      key={index}
                      className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs text-gray-400">
                          {formatTime(transcript.timestamp)}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            transcript.confidence > 0.8
                              ? "bg-green-900 text-green-300"
                              : transcript.confidence > 0.6
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-red-900 text-red-300"
                          }`}
                        >
                          {(transcript.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-white">{transcript.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {transcripts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    {transcripts.length} transcript{transcripts.length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
