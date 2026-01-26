use crossbeam_channel::{Receiver, Sender};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use std::path::PathBuf;
use transcribe_rs::{
    engines::whisper::{WhisperEngine, WhisperInferenceParams},
    TranscriptionEngine,
};

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
            language: "en".to_string(),
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

/// Whisper engine using transcribe-rs crate (proven Windows compatibility)
pub struct WhisperEngineWrapper {
    config: WhisperConfig,
    engine: Option<Arc<Mutex<WhisperEngine>>>,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    transcript_sender: Option<Sender<Transcript>>,
    transcript_receiver: Option<Receiver<Transcript>>,
    is_running: Arc<Mutex<bool>>,
}

impl WhisperEngineWrapper {
    pub fn new(config: WhisperConfig) -> Self {
        let (transcript_tx, transcript_rx) = crossbeam_channel::bounded(100);

        Self {
            config,
            engine: None,
            audio_receiver: None,
            transcript_sender: Some(transcript_tx),
            transcript_receiver: Some(transcript_rx),
            is_running: Arc::new(Mutex::new(false)),
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

    /// Check if engine is running
    pub fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }

    /// Stop transcription
    pub fn stop(&mut self) {
        *self.is_running.lock().unwrap() = false;
        info!("Whisper engine stopped");
    }

    /// Start Whisper processing using transcribe-rs
    pub fn start(&mut self) -> Result<(), String> {
        if self.audio_receiver.is_none() {
            return Err("Audio receiver not set".to_string());
        }

        // Check if model exists
        if !std::path::Path::new(&self.config.model_path).exists() {
            return Err(format!(
                "Whisper model not found at {}. Please ensure the model is bundled correctly.",
                self.config.model_path
            ));
        }

        info!("Loading Whisper model from: {}", self.config.model_path);

        // Create and load Whisper engine
        let mut engine = WhisperEngine::new();
        let model_path = PathBuf::from(&self.config.model_path);

        engine.load_model(&model_path)
            .map_err(|e| format!("Failed to load Whisper model with transcribe-rs: {:?}", e))?;

        self.engine = Some(Arc::new(Mutex::new(engine)));
        *self.is_running.lock().unwrap() = true;

        info!("Whisper model loaded successfully with transcribe-rs");

        // Start audio processing thread
        self.start_audio_thread();

        Ok(())
    }

    /// Start thread to process audio chunks
    fn start_audio_thread(&mut self) {
        let audio_rx = self.audio_receiver.take().unwrap();
        let transcript_tx = self.transcript_sender.clone().unwrap();
        let engine = self.engine.clone().unwrap();
        let language = self.config.language.clone();
        let is_running = self.is_running.clone();

        thread::spawn(move || {
            info!("Whisper audio processing thread started (transcribe-rs)");

            let mut buffer: Vec<f32> = Vec::new();
            const CHUNK_SIZE: usize = 16000 * 3; // 3 seconds of audio at 16kHz

            loop {
                if !*is_running.lock().unwrap() {
                    info!("Whisper thread stopping (is_running = false)");
                    break;
                }

                match audio_rx.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(samples) => {
                        buffer.extend_from_slice(&samples);

                        // Process when we have enough samples
                        if buffer.len() >= CHUNK_SIZE {
                            let chunk: Vec<f32> = buffer.drain(..CHUNK_SIZE).collect();

                            // Transcribe using transcribe-rs
                            let mut engine_guard = engine.lock().unwrap();

                            // Create inference params with language
                            let params = WhisperInferenceParams {
                                language: Some(language.clone()),
                                ..Default::default()
                            };

                            match engine_guard.transcribe_samples(chunk, Some(params)) {
                                Ok(result) => {
                                    let text = result.text.trim().to_string();

                                    if !text.is_empty() {
                                        let transcript = Transcript {
                                            text,
                                            confidence: 0.85, // transcribe-rs doesn't return confidence
                                            timestamp: chrono::Utc::now().timestamp() as f64,
                                            is_final: true,
                                        };

                                        if let Err(e) = transcript_tx.try_send(transcript) {
                                            warn!("Failed to send transcript: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Transcription error with transcribe-rs: {:?}", e);
                                }
                            }
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        // Continue loop
                        continue;
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                        info!("Audio receiver closed, stopping Whisper thread");
                        break;
                    }
                }
            }

            info!("Whisper audio processing thread stopped");
        });
    }
}
