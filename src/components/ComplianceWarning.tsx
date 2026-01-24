import { useEffect, useState } from "react";

interface ComplianceCheck {
  is_compliant: boolean;
  violation_type?: string;
  severity: "low" | "medium" | "high" | "critical";
  message?: string;
  required_text?: string;
}

interface ComplianceWarningProps {
  compliance: ComplianceCheck | null;
  nodeId: string;
  onAcknowledge?: () => void;
}

export default function ComplianceWarning({
  compliance,
  nodeId,
  onAcknowledge,
}: ComplianceWarningProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (compliance && !compliance.is_compliant) {
      setIsVisible(true);
      setIsPulsing(true);

      // Stop pulsing after 3 seconds
      const pulseTimer = setTimeout(() => setIsPulsing(false), 3000);

      return () => clearTimeout(pulseTimer);
    } else {
      setIsVisible(false);
      setIsPulsing(false);
    }
  }, [compliance]);

  const handleAcknowledge = () => {
    setIsVisible(false);
    onAcknowledge?.();
  };

  if (!isVisible || !compliance || compliance.is_compliant) {
    return null;
  }

  const getSeverityStyles = (): string => {
    switch (compliance.severity) {
      case "critical":
        return "bg-red-600 border-red-700 text-white";
      case "high":
        return "bg-orange-600 border-orange-700 text-white";
      case "medium":
        return "bg-yellow-500 border-yellow-600 text-gray-900";
      case "low":
        return "bg-yellow-200 border-yellow-400 text-yellow-900";
      default:
        return "bg-gray-600 border-gray-700 text-white";
    }
  };

  return (
    <>
      {/* Overlay for critical violations */}
      {compliance.severity === "critical" && (
        <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
      )}

      {/* Warning Modal */}
      <div
        className={`
          fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
          z-50 max-w-2xl w-full mx-4
          border-4 rounded-xl p-6 shadow-2xl
          ${getSeverityStyles()}
          ${isPulsing ? "animate-pulse" : ""}
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-4xl">⚠️</span>
            <div>
              <h3 className="text-2xl font-bold">
                {compliance.severity === "critical"
                  ? "CRITICAL COMPLIANCE VIOLATION"
                  : "Compliance Warning"}
              </h3>
              <p className="text-sm opacity-90">Node: {nodeId}</p>
            </div>
          </div>
        </div>

        {/* Message */}
        {compliance.message && (
          <div className="mb-4">
            <p className="text-lg font-semibold">{compliance.message}</p>
          </div>
        )}

        {/* Required Text */}
        {compliance.required_text && (
          <div className="bg-black/20 rounded p-4 mb-4">
            <p className="text-sm font-semibold mb-2">Required Statement:</p>
            <p className="font-mono text-sm">{compliance.required_text}</p>
          </div>
        )}

        {/* Violation Type */}
        {compliance.violation_type && (
          <div className="mb-4">
            <p className="text-sm">
              <strong>Violation Type:</strong>{" "}
              {compliance.violation_type.replace(/_/g, " ").toUpperCase()}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/30">
          <p className="text-sm opacity-90">
            {compliance.severity === "critical"
              ? "You must re-read the required statement before continuing."
              : "Please ensure compliance before proceeding."}
          </p>
          <button
            onClick={handleAcknowledge}
            className={`
              px-6 py-2 rounded-lg font-semibold transition-all
              ${
                compliance.severity === "critical"
                  ? "bg-white text-red-600 hover:bg-gray-100"
                  : "bg-white/20 hover:bg-white/30"
              }
            `}
          >
            {compliance.severity === "critical" ? "I Understand" : "Acknowledge"}
          </button>
        </div>
      </div>
    </>
  );
}
