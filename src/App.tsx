import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import ScriptViewer from "./components/ScriptViewer";

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
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({
    mic_level: 0,
    system_level: 0,
    combined_level: 0,
  });
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [_status, setStatus] = useState<string>("Not initialized");
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

  const handlePause = async () => {
    if (!isTranscribing) return;

    try {
      await handleStopTranscription();
      setIsPaused(true);
      setStatus("Paused - Customer on hold");
    } catch (err) {
      console.error("Failed to pause:", err);
    }
  };

  const handleResume = async () => {
    if (!isPaused) return;

    try {
      await handleStartTranscription();
      setIsPaused(false);
      setStatus("Resumed - Live transcription");
    } catch (err) {
      console.error("Failed to resume:", err);
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

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-[1920px]">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Pilot's Desk</h1>
          <p className="text-gray-300">Phase 2: Script Navigation + Voice Guidance</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 h-[calc(100vh-12rem)]">
          {/* Left Column (70%): Script Viewer */}
          <div className="lg:col-span-7 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <ScriptViewer />
          </div>

          {/* Right Column (30%): Audio Controls & Transcripts */}
          <div className="lg:col-span-3 space-y-4 overflow-y-auto">
            {/* Status Card */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Status</h3>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isPaused
                        ? "bg-yellow-500"
                        : isTranscribing
                        ? "bg-green-500 animate-pulse"
                        : isCapturing
                        ? "bg-yellow-500 animate-pulse"
                        : isInitialized
                        ? "bg-yellow-500"
                        : "bg-gray-500"
                    }`}
                  />
                  <span className="text-xs">
                    {isPaused
                      ? "Paused"
                      : isTranscribing
                      ? "Live"
                      : isCapturing
                      ? "Recording"
                      : isInitialized
                      ? "Ready"
                      : "Offline"}
                  </span>
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-300 mb-2 p-2 bg-red-900/30 rounded">
                  {error}
                </div>
              )}
            </div>

            {/* Audio Levels */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Audio Levels</h3>

              <div className="space-y-3">
                {/* Microphone Level */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-300 text-xs">Mic</span>
                    <span className="text-gray-400 font-mono text-xs">
                      {(audioLevels.mic_level * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${getLevelColor(
                        audioLevels.mic_level
                      )}`}
                      style={{ width: getLevelWidth(audioLevels.mic_level) }}
                    />
                  </div>
                </div>

                {/* Combined Level */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-300 text-xs font-semibold">Combined</span>
                    <span className="text-gray-400 font-mono text-xs">
                      {(audioLevels.combined_level * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
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
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Controls</h3>

              <div className="space-y-2">
                {/* Audio Controls */}
                {!isCapturing ? (
                  <button
                    onClick={handleStartCapture}
                    disabled={!isInitialized}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
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
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 transition-all"
                  >
                    Stop Capture
                  </button>
                )}

                {/* Transcription Controls */}
                {!isTranscribing && !isPaused ? (
                  <button
                    onClick={handleStartTranscription}
                    disabled={!isCapturing}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isCapturing
                        ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                        : "bg-gray-600 cursor-not-allowed"
                    }`}
                  >
                    Start Transcription
                  </button>
                ) : isPaused ? (
                  <button
                    onClick={handleResume}
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 active:bg-green-800 transition-all"
                  >
                    Resume (Customer Back)
                  </button>
                ) : (
                  <button
                    onClick={handleStopTranscription}
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 active:bg-orange-800 transition-all"
                  >
                    Stop Transcription
                  </button>
                )}

                {/* Pause/Resume for Hold */}
                {isTranscribing && !isPaused && (
                  <button
                    onClick={handlePause}
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800 transition-all"
                  >
                    Pause (Customer on Hold)
                  </button>
                )}
              </div>
            </div>

            {/* Transcript Display */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex flex-col max-h-[calc(100vh-32rem)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Transcripts</h3>
                <button
                  onClick={handleClearTranscripts}
                  disabled={transcripts.length === 0}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    transcripts.length > 0
                      ? "bg-gray-700 hover:bg-gray-600"
                      : "bg-gray-700 opacity-50 cursor-not-allowed"
                  }`}
                >
                  Clear
                </button>
              </div>

              {transcripts.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <p className="text-xs text-center">
                    Start transcription<br />to see live text
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {transcripts.map((transcript, index) => (
                    <div
                      key={index}
                      className="bg-gray-900 rounded p-3 border border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs text-gray-400">
                          {formatTime(transcript.timestamp)}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
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
                      <p className="text-sm text-white">{transcript.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {transcripts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="text-xs text-gray-400">
                    {transcripts.length} total
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
