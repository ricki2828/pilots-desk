import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PermissionsHelperProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PermissionsHelper({ isOpen, onClose }: PermissionsHelperProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleAutoRequest = async () => {
    setIsRequesting(true);
    setRequestStatus("idle");
    setErrorMessage("");

    try {
      const result = await invoke<string>("request_microphone_access");
      console.log("Permission request result:", result);
      setRequestStatus("success");
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Permission request failed:", error);
      setRequestStatus("error");
      setErrorMessage(String(error));
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 animate-popIn p-4">
      <div className="bg-background border-2 border-foreground rounded-md shadow-pop-purple max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-secondary border-b-2 border-foreground p-6 flex-shrink-0">
          <h2 className="text-3xl font-heading font-bold text-foreground">
            🎤 Microphone Permissions Required
          </h2>
        </div>

        {/* Content - Scrollable */}
        <div className="p-8 space-y-6 overflow-y-auto flex-1">
          {/* Issue */}
          <div className="bg-secondary/20 border-2 border-secondary rounded-sm p-6">
            <h3 className="text-xl font-heading font-bold text-foreground mb-3">
              ⚠️ Why You're Seeing This
            </h3>
            <p className="text-base font-body text-foreground">
              Pilot's Desk needs microphone access to transcribe your calls and provide
              real-time coaching. Windows is currently blocking microphone access.
            </p>
          </div>

          {/* Auto-Open Settings Button (Primary Solution) */}
          <div className="bg-accent/10 border-2 border-accent rounded-sm p-6">
            <h3 className="text-xl font-heading font-bold text-foreground mb-3">
              🚀 Easiest Fix - Try This First!
            </h3>
            <p className="text-sm font-body text-foreground mb-4">
              Click the button below to automatically open Windows Settings to the microphone permissions page.
              Then enable all three toggles and restart the app.
            </p>

            <button
              onClick={handleAutoRequest}
              disabled={isRequesting}
              className={`w-full px-6 py-4 font-heading font-bold text-lg border-2 border-foreground rounded-sm shadow-pop hover:shadow-pop-hover active:shadow-pop-active transition-all hover:-translate-y-0.5 active:translate-y-0 ${
                isRequesting
                  ? "bg-muted text-mutedForeground cursor-not-allowed"
                  : requestStatus === "success"
                  ? "bg-quaternary text-quaternaryForeground"
                  : requestStatus === "error"
                  ? "bg-destructive text-destructiveForeground"
                  : "bg-accent text-accentForeground"
              }`}
            >
              {isRequesting && "⏳ Opening Settings..."}
              {!isRequesting && requestStatus === "success" && "✅ Settings Opened!"}
              {!isRequesting && requestStatus === "error" && "❌ Failed - Use Manual Steps Below"}
              {!isRequesting && requestStatus === "idle" && "🔧 Open Microphone Settings"}
            </button>

            {requestStatus === "success" && (
              <p className="mt-3 text-sm font-body text-quaternary text-center animate-popIn">
                ✅ Windows Settings opened! Enable all microphone permissions, then close and restart Pilot's Desk.
              </p>
            )}

            {requestStatus === "error" && errorMessage && (
              <p className="mt-3 text-xs font-body text-destructive bg-destructive/10 border border-destructive rounded-sm p-2">
                Could not auto-open Settings. Please use manual steps below.
              </p>
            )}
          </div>

          {/* Manual Solution Steps (Fallback) */}
          <div className="border-t-2 border-border pt-4">
            <p className="text-sm font-body text-mutedForeground mb-4 text-center">
              If the automatic request doesn't work, follow these manual steps:
            </p>
          </div>

          {/* Solution Steps */}
          <div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-4">
              ✅ How to Fix (2 Simple Steps)
            </h3>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="bg-card border-2 border-foreground rounded-sm p-6 shadow-pop">
                <div className="flex items-start gap-4">
                  <div className="bg-accent text-accentForeground border-2 border-foreground rounded-full w-10 h-10 flex items-center justify-center font-heading font-bold text-xl flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-heading font-bold text-foreground mb-2">
                      Open Windows Settings
                    </h4>
                    <p className="text-sm font-body text-foreground mb-3">
                      Press <kbd className="px-2 py-1 bg-muted border-2 border-foreground rounded-sm font-mono font-bold">Windows Key</kbd> + <kbd className="px-2 py-1 bg-muted border-2 border-foreground rounded-sm font-mono font-bold">I</kbd>
                    </p>
                    <p className="text-sm font-body text-mutedForeground">
                      Or search for "Settings" in the Start Menu
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-card border-2 border-foreground rounded-sm p-6 shadow-pop">
                <div className="flex items-start gap-4">
                  <div className="bg-accent text-accentForeground border-2 border-foreground rounded-full w-10 h-10 flex items-center justify-center font-heading font-bold text-xl flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-heading font-bold text-foreground mb-2">
                      Enable Microphone Access
                    </h4>
                    <div className="text-sm font-body text-foreground space-y-2">
                      <p>Navigate to:</p>
                      <div className="bg-muted border-2 border-foreground rounded-sm p-3 font-mono text-sm">
                        Privacy & Security → Microphone
                      </div>
                      <p className="mt-3">Then:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Turn ON "Microphone access"</li>
                        <li>Turn ON "Let apps access your microphone"</li>
                        <li>Turn ON "Let desktop apps access your microphone"</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 - Restart */}
              <div className="bg-tertiary/20 border-2 border-tertiary rounded-sm p-4">
                <p className="text-sm font-body text-foreground">
                  <strong className="font-bold">💡 After enabling permissions:</strong> Close and relaunch Pilot's Desk, then click "Start Capture" again.
                </p>
              </div>
            </div>
          </div>

          {/* Alternative: Windows 11 Quick Settings */}
          <div className="bg-muted border-2 border-border rounded-sm p-4">
            <h4 className="text-sm font-heading font-bold text-foreground mb-2">
              🚀 Quick Alternative (Windows 11)
            </h4>
            <p className="text-sm font-body text-foreground">
              Click the <strong>speaker/volume icon</strong> in your taskbar → Click the <strong>microphone icon</strong> to unmute system-wide microphone access
            </p>
          </div>
        </div>

        {/* Footer - Always visible at bottom */}
        <div className="border-t-2 border-border p-6 flex-shrink-0 bg-background">
          <button
            onClick={onClose}
            className="w-full btn-primary"
          >
            I've Enabled Permissions - Close This
          </button>
        </div>
      </div>
    </div>
  );
}
