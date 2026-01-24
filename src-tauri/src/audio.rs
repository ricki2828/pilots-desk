use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, SampleFormat, SampleRate, Stream, StreamConfig};
use crossbeam_channel::{bounded, Receiver, Sender};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::Mutex;

/// Audio configuration for capture
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000, // Whisper expects 16kHz
            channels: 1,        // Mono for STT
            buffer_size: 4096,
        }
    }
}

/// Audio levels for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioLevels {
    pub mic_level: f32,
    pub system_level: f32,
    pub combined_level: f32,
}

/// Audio capture manager
pub struct AudioCapture {
    config: AudioConfig,
    mic_stream: Option<Stream>,
    system_stream: Option<Stream>,
    audio_sender: Option<Sender<Vec<f32>>>,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    is_capturing: Arc<Mutex<bool>>,
    current_levels: Arc<Mutex<AudioLevels>>,
}

impl AudioCapture {
    pub fn new(config: AudioConfig) -> Self {
        let (sender, receiver) = bounded(100); // Buffer up to 100 audio chunks

        Self {
            config,
            mic_stream: None,
            system_stream: None,
            audio_sender: Some(sender),
            audio_receiver: Some(receiver),
            is_capturing: Arc::new(Mutex::new(false)),
            current_levels: Arc::new(Mutex::new(AudioLevels {
                mic_level: 0.0,
                system_level: 0.0,
                combined_level: 0.0,
            })),
        }
    }

    /// Get default input device (microphone)
    fn get_mic_device() -> Result<Device, String> {
        let host = cpal::default_host();
        host.default_input_device()
            .ok_or_else(|| "No default input device found".to_string())
    }

    /// Get loopback device (system audio) - Windows WASAPI specific
    #[cfg(target_os = "windows")]
    fn get_loopback_device() -> Result<Device, String> {
        let host = cpal::default_host();

        // On Windows with WASAPI, we can use loopback mode
        // This requires finding the default output device and using its loopback
        let output_device = host.default_output_device()
            .ok_or_else(|| "No default output device found".to_string())?;

        info!("Found output device: {:?}", output_device.name());

        // For WASAPI, loopback is accessed via the same device in a special mode
        // We'll return the output device and configure it for loopback later
        Ok(output_device)
    }

    /// Get loopback device fallback for non-Windows platforms
    #[cfg(not(target_os = "windows"))]
    fn get_loopback_device() -> Result<Device, String> {
        Err("System audio loopback is only supported on Windows".to_string())
    }

    /// Calculate RMS (Root Mean Square) for audio level
    fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        let sum: f32 = samples.iter().map(|s| s * s).sum();
        (sum / samples.len() as f32).sqrt()
    }

    /// Start capturing from microphone
    pub fn start_mic_capture(&mut self) -> Result<(), String> {
        let device = Self::get_mic_device()?;
        info!("Starting microphone capture from: {:?}", device.name());

        let config = StreamConfig {
            channels: self.config.channels,
            sample_rate: SampleRate(self.config.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size as u32),
        };

        let sender = self.audio_sender.as_ref().unwrap().clone();
        let levels = self.current_levels.clone();
        let is_capturing = self.is_capturing.clone();

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if *is_capturing.lock().unwrap() {
                        // Calculate mic level
                        let mic_level = Self::calculate_rms(data);

                        // Update levels
                        {
                            let mut current = levels.lock().unwrap();
                            current.mic_level = mic_level;
                        }

                        // Send to processing buffer
                        let samples: Vec<f32> = data.to_vec();
                        if let Err(e) = sender.try_send(samples) {
                            warn!("Failed to send mic audio to buffer: {}", e);
                        }
                    }
                },
                move |err| {
                    error!("Microphone stream error: {}", err);
                },
                None,
            )
            .map_err(|e| format!("Failed to build mic stream: {}", e))?;

        stream.play().map_err(|e| format!("Failed to play mic stream: {}", e))?;
        self.mic_stream = Some(stream);

        info!("Microphone capture started successfully");
        Ok(())
    }

    /// Start capturing system audio (WASAPI loopback)
    #[cfg(target_os = "windows")]
    pub fn start_system_capture(&mut self) -> Result<(), String> {
        let device = Self::get_loopback_device()?;
        info!("Starting system audio capture (loopback mode)");

        // For WASAPI loopback, we need to use the output device's config
        // but configure it for input (loopback recording)
        let supported_config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default output config: {}", e))?;

        info!("System audio config: {:?}", supported_config);

        let config = StreamConfig {
            channels: self.config.channels,
            sample_rate: SampleRate(self.config.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size as u32),
        };

        let sender = self.audio_sender.as_ref().unwrap().clone();
        let levels = self.current_levels.clone();
        let is_capturing = self.is_capturing.clone();

        // Note: This is a simplified version. Full WASAPI loopback requires
        // platform-specific code using windows-rs or similar
        // For MVP, we'll implement basic version and enhance later

        warn!("System audio loopback requires platform-specific WASAPI implementation");
        warn!("Using fallback to mic-only mode for initial testing");

        // TODO: Implement full WASAPI loopback using windows-rs crate
        // For now, return Ok but don't actually capture system audio

        Ok(())
    }

    /// Fallback for non-Windows platforms
    #[cfg(not(target_os = "windows"))]
    pub fn start_system_capture(&mut self) -> Result<(), String> {
        warn!("System audio capture not supported on this platform");
        Ok(())
    }

    /// Start both microphone and system audio capture
    pub fn start(&mut self) -> Result<(), String> {
        *self.is_capturing.lock().unwrap() = true;

        // Start mic capture
        self.start_mic_capture()?;

        // Attempt system capture (will warn if not fully supported yet)
        if let Err(e) = self.start_system_capture() {
            warn!("System audio capture failed: {}. Continuing with mic only.", e);
        }

        info!("Audio capture started");
        Ok(())
    }

    /// Stop all audio capture
    pub fn stop(&mut self) {
        *self.is_capturing.lock().unwrap() = false;

        if let Some(stream) = self.mic_stream.take() {
            drop(stream);
            info!("Microphone capture stopped");
        }

        if let Some(stream) = self.system_stream.take() {
            drop(stream);
            info!("System audio capture stopped");
        }
    }

    /// Get current audio levels for UI
    pub fn get_levels(&self) -> AudioLevels {
        self.current_levels.lock().unwrap().clone()
    }

    /// Get audio receiver for processing
    pub fn get_receiver(&mut self) -> Option<Receiver<Vec<f32>>> {
        self.audio_receiver.take()
    }

    /// Check if currently capturing
    pub fn is_capturing(&self) -> bool {
        *self.is_capturing.lock().unwrap()
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_rms() {
        let samples = vec![0.5, -0.5, 0.3, -0.3];
        let rms = AudioCapture::calculate_rms(&samples);
        assert!(rms > 0.0 && rms < 1.0);
    }

    #[test]
    fn test_audio_config_default() {
        let config = AudioConfig::default();
        assert_eq!(config.sample_rate, 16000);
        assert_eq!(config.channels, 1);
    }
}
