import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import ScriptViewer from "./components/ScriptViewer";
import AudioSettings from "./components/AudioSettings";
import PermissionsHelper from "./components/PermissionsHelper";

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
  const [showSettings, setShowSettings] = useState(false);
  const [showPermissionsHelp, setShowPermissionsHelp] = useState(false);

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
    if (level > 0.7) return "bg-secondary"; // Pink for high
    if (level > 0.4) return "bg-tertiary"; // Yellow for medium
    if (level > 0.1) return "bg-quaternary"; // Green for good
    return "bg-muted"; // Muted for silent
  };

  const getLevelWidth = (level: number): string => {
    return `${Math.min(level * 100, 100)}%`;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-[1920px]">
        {/* Header */}
        <div className="mb-8 animate-popIn flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-heading font-bold mb-2 text-foreground">
              Pilot's Desk 🎯
            </h1>
            <p className="text-mutedForeground font-body text-lg">
              Phase 2: Script Navigation + Voice Guidance
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-6 py-3 bg-muted border-2 border-foreground rounded-sm font-heading font-bold shadow-pop hover:shadow-pop-hover active:shadow-pop-active transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            ⚙️ Settings
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 h-[calc(100vh-12rem)]">
          {/* Left Column (70%): Script Viewer */}
          <div className="lg:col-span-7 card overflow-hidden shadow-pop-purple hover:shadow-pop-hover transition-all">
            <ScriptViewer />
          </div>

          {/* Right Column (30%): Audio Controls & Transcripts */}
          <div className="lg:col-span-3 space-y-6 overflow-y-auto">
            {/* Status Card */}
            <div className="card shadow-pop-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-heading font-bold text-foreground">Status</h3>
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-sm border-2 border-foreground bg-muted">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isPaused
                        ? "bg-tertiary"
                        : isTranscribing
                        ? "bg-quaternary animate-pulse"
                        : isCapturing
                        ? "bg-tertiary animate-pulse"
                        : isInitialized
                        ? "bg-tertiary"
                        : "bg-mutedForeground"
                    }`}
                  />
                  <span className="text-sm font-body font-semibold text-foreground">
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
                <div className="text-sm font-body p-3 bg-secondary/20 border-2 border-secondary rounded-sm mb-3">
                  {error}
                </div>
              )}

              {/* Permissions Help Button */}
              <button
                onClick={() => setShowPermissionsHelp(true)}
                className="w-full text-left bg-muted hover:bg-card border-2 border-border hover:border-foreground rounded-sm px-4 py-3 transition-all"
              >
                <p className="text-sm font-body font-semibold text-foreground">
                  ❓ Need help with microphone permissions?
                </p>
                <p className="text-xs font-body text-mutedForeground mt-1">
                  Click here for step-by-step instructions
                </p>
              </button>
            </div>

            {/* Audio Levels - PROMINENT */}
            <div className={`card ${isCapturing ? 'shadow-pop-purple border-accent' : 'shadow-pop-soft'} transition-all`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-heading font-bold text-foreground">Audio Levels</h3>
                {isCapturing && (
                  <span className="px-3 py-1 bg-quaternary border-2 border-foreground rounded-sm text-xs font-heading font-bold animate-pulse">
                    🎤 RECORDING
                  </span>
                )}
              </div>

              {!isCapturing && (
                <div className="bg-tertiary/20 border-2 border-tertiary rounded-sm p-4 mb-4">
                  <p className="text-sm font-body text-foreground text-center">
                    <strong className="font-bold">Click "Start Capture"</strong> to begin recording audio
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {/* Microphone Level - BIG */}
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-foreground font-heading font-bold text-lg">🎤 Microphone</span>
                    <span className={`font-mono text-2xl font-bold ${
                      audioLevels.mic_level > 0.1 ? 'text-foreground' : 'text-mutedForeground'
                    }`}>
                      {(audioLevels.mic_level * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted border-2 border-foreground rounded-sm h-8 overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-75 ${getLevelColor(
                        audioLevels.mic_level
                      )}`}
                      style={{ width: getLevelWidth(audioLevels.mic_level) }}
                    />
                    {/* Visual notches for reference */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-1/4 h-full border-r border-foreground/20"></div>
                      <div className="w-1/4 h-full border-r border-foreground/20"></div>
                      <div className="w-1/4 h-full border-r border-foreground/20"></div>
                    </div>
                  </div>
                  {audioLevels.mic_level === 0 && isCapturing && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm text-secondary font-body font-bold">
                        ⚠️ No microphone input detected!
                      </p>
                      <button
                        onClick={() => setShowPermissionsHelp(true)}
                        className="w-full bg-secondary text-foreground border-2 border-foreground rounded-sm px-4 py-3 font-heading font-bold shadow-pop hover:shadow-pop-hover active:shadow-pop-active transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm"
                      >
                        🔧 Fix Microphone Permissions
                      </button>
                    </div>
                  )}
                  {audioLevels.mic_level > 0 && audioLevels.mic_level < 0.1 && isCapturing && (
                    <p className="text-xs text-tertiary font-body font-semibold mt-2">
                      🔉 Speak louder or move closer to microphone
                    </p>
                  )}
                  {audioLevels.mic_level >= 0.1 && audioLevels.mic_level < 0.7 && isCapturing && (
                    <p className="text-xs text-quaternary font-body font-semibold mt-2">
                      ✓ Good level - keep speaking like this!
                    </p>
                  )}
                  {audioLevels.mic_level >= 0.7 && isCapturing && (
                    <p className="text-xs text-secondary font-body font-semibold mt-2">
                      🔊 Too loud - move back or reduce gain
                    </p>
                  )}
                </div>

                {/* Combined Level */}
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-foreground font-body font-bold text-base">📊 Combined Signal</span>
                    <span className="text-mutedForeground font-mono text-lg font-bold">
                      {(audioLevels.combined_level * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted border-2 border-foreground rounded-sm h-6 overflow-hidden">
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
            <div className="card shadow-pop-soft">
              <h3 className="text-xl font-heading font-bold mb-4 text-foreground">Controls</h3>

              <div className="space-y-3">
                {/* Audio Controls */}
                {!isCapturing ? (
                  <button
                    onClick={handleStartCapture}
                    disabled={!isInitialized}
                    className={`w-full transition-all ${
                      isInitialized
                        ? "bg-quaternary text-foreground border-2 border-foreground rounded-sm px-6 py-3 font-heading font-bold shadow-pop hover:shadow-pop-hover active:shadow-pop-active hover:-translate-y-0.5 active:translate-y-0"
                        : "bg-muted text-mutedForeground border-2 border-border rounded-sm px-6 py-3 font-heading font-bold cursor-not-allowed opacity-50"
                    }`}
                  >
                    Start Capture
                  </button>
                ) : (
                  <button
                    onClick={handleStopCapture}
                    className="btn-secondary w-full"
                  >
                    Stop Capture
                  </button>
                )}

                {/* Transcription Controls */}
                {!isTranscribing && !isPaused ? (
                  <button
                    onClick={handleStartTranscription}
                    disabled={!isCapturing}
                    className={`w-full transition-all ${
                      isCapturing
                        ? "btn-primary"
                        : "bg-muted text-mutedForeground border-2 border-border rounded-sm px-6 py-3 font-heading font-bold cursor-not-allowed opacity-50"
                    }`}
                  >
                    Start Transcription
                  </button>
                ) : isPaused ? (
                  <button
                    onClick={handleResume}
                    className="w-full bg-quaternary text-foreground border-2 border-foreground rounded-sm px-6 py-3 font-heading font-bold shadow-pop hover:shadow-pop-hover active:shadow-pop-active transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Resume (Customer Back)
                  </button>
                ) : (
                  <button
                    onClick={handleStopTranscription}
                    className="btn-tertiary w-full"
                  >
                    Stop Transcription
                  </button>
                )}

                {/* Pause/Resume for Hold */}
                {isTranscribing && !isPaused && (
                  <button
                    onClick={handlePause}
                    className="btn-tertiary w-full"
                  >
                    Pause (Customer on Hold)
                  </button>
                )}
              </div>
            </div>

            {/* Transcript Display */}
            <div className="card shadow-pop-soft flex flex-col max-h-[calc(100vh-32rem)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-heading font-bold text-foreground">Transcripts</h3>
                <button
                  onClick={handleClearTranscripts}
                  disabled={transcripts.length === 0}
                  className={`px-4 py-1.5 rounded-sm text-sm font-heading font-bold transition-all ${
                    transcripts.length > 0
                      ? "bg-muted border-2 border-foreground hover:shadow-pop-active hover:-translate-y-0.5"
                      : "bg-muted border-2 border-border opacity-50 cursor-not-allowed"
                  }`}
                >
                  Clear
                </button>
              </div>

              {transcripts.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-mutedForeground">
                  <p className="text-sm text-center font-body">
                    Start transcription<br />to see live text
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3">
                  {transcripts.map((transcript, index) => (
                    <div
                      key={index}
                      className="bg-card border-2 border-foreground rounded-sm p-4 shadow-pop-active animate-popIn"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-mono text-mutedForeground">
                          {formatTime(transcript.timestamp)}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-sm font-bold border-2 ${
                            transcript.confidence > 0.8
                              ? "bg-quaternary/20 border-quaternary text-foreground"
                              : transcript.confidence > 0.6
                              ? "bg-tertiary/20 border-tertiary text-foreground"
                              : "bg-secondary/20 border-secondary text-foreground"
                          }`}
                        >
                          {(transcript.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-sm font-body text-foreground">{transcript.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {transcripts.length > 0 && (
                <div className="mt-3 pt-3 border-t-2 border-border">
                  <div className="text-xs font-body font-semibold text-mutedForeground">
                    {transcripts.length} total
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audio Settings Modal */}
        <AudioSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />

        {/* Permissions Helper Modal */}
        <PermissionsHelper
          isOpen={showPermissionsHelp}
          onClose={() => setShowPermissionsHelp(false)}
        />
      </div>
    </div>
  );
}

export default App;
