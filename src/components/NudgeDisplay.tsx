import { useEffect, useState } from "react";

interface Nudge {
  nudge_type: "adherence" | "compliance" | "pace" | "energy" | "keyword";
  severity: "info" | "warning" | "critical";
  message: string;
  node_id: string;
  timestamp: string;
}

interface NudgeDisplayProps {
  nudges: Nudge[];
  onDismiss?: (index: number) => void;
  maxVisible?: number;
}

export default function NudgeDisplay({
  nudges,
  onDismiss,
  maxVisible = 3,
}: NudgeDisplayProps) {
  const [visibleNudges, setVisibleNudges] = useState<Nudge[]>([]);

  useEffect(() => {
    // Show only the most recent nudges
    setVisibleNudges(nudges.slice(-maxVisible));
  }, [nudges, maxVisible]);

  const handleDismiss = (index: number) => {
    onDismiss?.(index);
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-400 text-red-800";
      case "warning":
        return "bg-yellow-100 border-yellow-400 text-yellow-800";
      case "info":
        return "bg-blue-100 border-blue-400 text-blue-800";
      default:
        return "bg-gray-100 border-gray-400 text-gray-800";
    }
  };

  const getNudgeIcon = (type: string): string => {
    switch (type) {
      case "adherence":
        return "📋";
      case "compliance":
        return "⚠️";
      case "pace":
        return "⏱️";
      case "energy":
        return "⚡";
      case "keyword":
        return "🔑";
      default:
        return "💡";
    }
  };

  if (visibleNudges.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-md">
      {visibleNudges.map((nudge, index) => (
        <div
          key={`${nudge.timestamp}-${index}`}
          className={`
            border-2 rounded-lg p-4 shadow-lg
            animate-slide-up
            ${getSeverityColor(nudge.severity)}
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <span className="text-2xl">{getNudgeIcon(nudge.nudge_type)}</span>
              <div className="flex-1">
                <p className="font-medium text-sm">{nudge.message}</p>
                <p className="text-xs opacity-75 mt-1">
                  {nudge.nudge_type.charAt(0).toUpperCase() +
                    nudge.nudge_type.slice(1)}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(index)}
              className="ml-2 text-gray-600 hover:text-gray-800 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
