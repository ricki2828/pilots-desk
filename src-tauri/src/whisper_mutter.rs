use crossbeam_channel::{Receiver, Sender};
use log::{error, info, warn};
use mutter::{TranscriptionBuilder, whisper_rs::WhisperContext};
use serde::{Deserialize, Serialize};
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

/// Whisper engine using mutter crate
pub struct WhisperEngine {
    config: WhisperConfig,
    context: Option<Arc<Mutex<WhisperContext>>>,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    transcript_sender: Option<Sender<Transcript>>,
    transcript_receiver: Option<Receiver<Transcript>>,
}

impl WhisperEngine {
    pub fn new(config: WhisperConfig) -> Self {
        let (transcript_tx, transcript_rx) = crossbeam_channel::bounded(100);

        Self {
            config,
            context: None,
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
                "Whisper model not found at {}. Please ensure the model is bundled correctly.",
                self.config.model_path
            ));
        }

        info!("Loading Whisper model from: {}", self.config.model_path);

        // Load Whisper model using mutter
        let ctx = WhisperContext::new(&self.config.model_path)
            .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

        self.context = Some(Arc::new(Mutex::new(ctx)));

        info!("Whisper model loaded successfully");

        // Start audio processing thread
        self.start_audio_thread();

        Ok(())
    }

    /// Start thread to process audio chunks
    fn start_audio_thread(&mut self) {
        let audio_rx = self.audio_receiver.take().unwrap();
        let transcript_tx = self.transcript_sender.clone().unwrap();
        let context = self.context.clone().unwrap();
        let language = self.config.language.clone();
        let num_threads = self.config.num_threads;

        thread::spawn(move || {
            info!("Whisper audio processing thread started");

            let mut buffer: Vec<f32> = Vec::new();
            const CHUNK_SIZE: usize = 16000 * 3; // 3 seconds of audio at 16kHz

            loop {
                match audio_rx.recv() {
                    Ok(samples) => {
                        buffer.extend_from_slice(&samples);

                        // Process when we have enough samples
                        if buffer.len() >= CHUNK_SIZE {
                            let chunk: Vec<f32> = buffer.drain(..CHUNK_SIZE).collect();

                            // Transcribe using mutter
                            let ctx = context.lock().unwrap();

                            let builder = TranscriptionBuilder::new(&ctx)
                                .set_language(&language)
                                .set_num_threads(num_threads as i32);

                            match builder.transcribe(&chunk) {
                                Ok(transcription) => {
                                    let text = transcription.text().trim().to_string();

                                    if !text.is_empty() {
                                        let transcript = Transcript {
                                            text,
                                            confidence: 0.85, // mutter doesn't expose confidence directly
                                            timestamp: chrono::Utc::now().timestamp() as f64,
                                            is_final: true,
                                        };

                                        if let Err(e) = transcript_tx.try_send(transcript) {
                                            warn!("Failed to send transcript: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Transcription error: {}", e);
                                }
                            }
                        }
                    }
                    Err(_) => {
                        info!("Audio receiver closed, stopping Whisper thread");
                        break;
                    }
                }
            }

            info!("Whisper audio processing thread stopped");
        });
    }
}
