use crossbeam_channel::{Receiver, Sender};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

/// Whisper model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperConfig {
    pub model_path: String,
    pub language: String,
    pub num_threads: u32,
    pub sample_rate: u32,
}

impl Default for WhisperConfig {
    fn default() -> Self {
        Self {
            model_path: "models/ggml-small.bin".to_string(),
            language: "en".to_string(), // English for SA accents
            num_threads: 4,
            sample_rate: 16000,
        }
    }
}

/// Transcript result from Whisper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub text: String,
    pub confidence: f32,
    pub timestamp: f64,
    pub is_final: bool,
}

/// Whisper engine state
pub enum WhisperState {
    Idle,
    Running(Child),
    Failed(String),
}

/// Whisper sidecar manager
pub struct WhisperEngine {
    config: WhisperConfig,
    state: Arc<Mutex<WhisperState>>,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    transcript_sender: Option<Sender<Transcript>>,
    transcript_receiver: Option<Receiver<Transcript>>,
}

impl WhisperEngine {
    pub fn new(config: WhisperConfig) -> Self {
        let (transcript_tx, transcript_rx) = crossbeam_channel::bounded(100);

        Self {
            config,
            state: Arc::new(Mutex::new(WhisperState::Idle)),
            audio_receiver: None,
            transcript_sender: Some(transcript_tx),
            transcript_receiver: Some(transcript_rx),
        }
    }

    /// Set audio input receiver
    pub fn set_audio_receiver(&mut self, receiver: Receiver<Vec<f32>>) {
        self.audio_receiver = Some(receiver);
    }

    /// Get transcript output receiver
    pub fn get_transcript_receiver(&mut self) -> Option<Receiver<Transcript>> {
        self.transcript_receiver.take()
    }

    /// Start Whisper processing
    pub fn start(&mut self) -> Result<(), String> {
        if self.audio_receiver.is_none() {
            return Err("Audio receiver not set".to_string());
        }

        // Check if model exists
        if !std::path::Path::new(&self.config.model_path).exists() {
            return Err(format!(
                "Whisper model not found at {}. Please download it first.",
                self.config.model_path
            ));
        }

        info!("Starting Whisper engine with config: {:?}", self.config);

        // For MVP, we'll use whisper.cpp as external process
        // In production, consider using whisper-rs for better integration
        self.start_whisper_process()?;

        // Start audio processing thread
        self.start_audio_thread();

        Ok(())
    }

    /// Start whisper.cpp as external process
    fn start_whisper_process(&mut self) -> Result<(), String> {
        // Path to whisper.cpp executable (should be in sidecars/)
        let whisper_path = if cfg!(target_os = "windows") {
            "sidecars/whisper.exe"
        } else {
            "sidecars/whisper"
        };

        if !std::path::Path::new(whisper_path).exists() {
            warn!("Whisper executable not found at {}. Using mock mode.", whisper_path);
            return self.start_mock_mode();
        }

        let child = Command::new(whisper_path)
            .arg("-m")
            .arg(&self.config.model_path)
            .arg("-l")
            .arg(&self.config.language)
            .arg("-t")
            .arg(self.config.num_threads.to_string())
            .arg("--stream")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn whisper process: {}", e))?;

        let mut state = self.state.lock().unwrap();
        *state = WhisperState::Running(child);

        info!("Whisper process started successfully");
        Ok(())
    }

    /// Start mock mode for development without whisper binary
    fn start_mock_mode(&self) -> Result<(), String> {
        warn!("Running in MOCK MODE - no actual transcription");
        warn!("To enable real transcription:");
        warn!("1. Download whisper.cpp: git clone https://github.com/ggerganov/whisper.cpp");
        warn!("2. Compile: cd whisper.cpp && make");
        warn!("3. Download model: bash ./models/download-ggml-model.sh small");
        warn!("4. Copy to pilots-desk: cp main ../pilots-desk/src-tauri/sidecars/whisper");
        warn!("5. Copy model: cp models/ggml-small.bin ../pilots-desk/models/");

        let mut state = self.state.lock().unwrap();
        *state = WhisperState::Idle;

        Ok(())
    }

    /// Start thread to process audio chunks
    fn start_audio_thread(&mut self) {
        let audio_rx = self.audio_receiver.take().unwrap();
        let transcript_tx = self.transcript_sender.clone().unwrap();
        let state = self.state.clone();

        thread::spawn(move || {
            info!("Audio processing thread started");

            let mut sample_count = 0;
            let mut buffer: Vec<f32> = Vec::new();
            const CHUNK_SIZE: usize = 16000 * 3; // 3 seconds of audio at 16kHz

            loop {
                match audio_rx.recv() {
                    Ok(samples) => {
                        buffer.extend_from_slice(&samples);
                        sample_count += samples.len();

                        // Process when we have enough samples
                        if buffer.len() >= CHUNK_SIZE {
                            let chunk: Vec<f32> = buffer.drain(..CHUNK_SIZE).collect();

                            match Self::process_audio_chunk(&chunk, &state) {
                                Ok(Some(transcript)) => {
                                    if let Err(e) = transcript_tx.send(transcript) {
                                        error!("Failed to send transcript: {}", e);
                                        break;
                                    }
                                }
                                Ok(None) => {
                                    // No speech detected in chunk
                                    debug!("No speech in chunk");
                                }
                                Err(e) => {
                                    error!("Failed to process audio chunk: {}", e);
                                }
                            }
                        }

                        if sample_count % 160000 == 0 {
                            // Every 10 seconds
                            debug!("Processed {} samples", sample_count);
                        }
                    }
                    Err(e) => {
                        error!("Audio receiver error: {}", e);
                        break;
                    }
                }
            }

            info!("Audio processing thread stopped");
        });
    }

    /// Process a chunk of audio through Whisper
    fn process_audio_chunk(
        samples: &[f32],
        state: &Arc<Mutex<WhisperState>>,
    ) -> Result<Option<Transcript>, String> {
        let state_guard = state.lock().unwrap();

        match &*state_guard {
            WhisperState::Running(_child) => {
                // In real implementation, we would:
                // 1. Write samples to child process stdin
                // 2. Read transcript from child process stdout
                // 3. Parse and return

                // For now, mock implementation
                drop(state_guard);
                Ok(Self::mock_transcribe(samples))
            }
            WhisperState::Idle => {
                // Mock mode - generate fake transcript
                Ok(Self::mock_transcribe(samples))
            }
            WhisperState::Failed(err) => Err(format!("Whisper in failed state: {}", err)),
        }
    }

    /// Mock transcription for development
    fn mock_transcribe(samples: &[f32]) -> Option<Transcript> {
        // Calculate energy to detect speech
        let energy: f32 = samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32;
        let rms = energy.sqrt();

        // Only generate transcript if there's significant audio
        if rms > 0.01 {
            Some(Transcript {
                text: format!("[MOCK] Audio detected (level: {:.2})", rms),
                confidence: 0.85,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs_f64(),
                is_final: true,
            })
        } else {
            None
        }
    }

    /// Stop Whisper processing
    pub fn stop(&mut self) {
        let mut state = self.state.lock().unwrap();

        if let WhisperState::Running(mut child) = std::mem::replace(&mut *state, WhisperState::Idle) {
            if let Err(e) = child.kill() {
                error!("Failed to kill whisper process: {}", e);
            } else {
                info!("Whisper process stopped");
            }
        }
    }

    /// Check if Whisper is running
    pub fn is_running(&self) -> bool {
        let state = self.state.lock().unwrap();
        matches!(&*state, WhisperState::Running(_) | WhisperState::Idle)
    }
}

impl Drop for WhisperEngine {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_whisper_config_default() {
        let config = WhisperConfig::default();
        assert_eq!(config.sample_rate, 16000);
        assert_eq!(config.language, "en");
    }

    #[test]
    fn test_mock_transcribe() {
        // Silence should return None
        let silence = vec![0.0; 1000];
        assert!(WhisperEngine::mock_transcribe(&silence).is_none());

        // Audio should return Some
        let audio = vec![0.1; 1000];
        assert!(WhisperEngine::mock_transcribe(&audio).is_some());
    }
}
