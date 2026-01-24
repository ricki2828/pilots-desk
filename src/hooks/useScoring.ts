import { useState, useEffect, useRef } from "react";

interface AdherenceScore {
  score: number;
  explanation: string;
  key_points_covered: string[];
  key_points_missed: string[];
  recommendations: string[];
}

interface ComplianceCheck {
  is_compliant: boolean;
  violation_type?: string;
  severity: "low" | "medium" | "high" | "critical";
  message?: string;
  required_text?: string;
}

interface Nudge {
  nudge_type: "adherence" | "compliance" | "pace" | "energy" | "keyword";
  severity: "info" | "warning" | "critical";
  message: string;
  node_id: string;
  timestamp: string;
}

interface ScoreResponse {
  segment_id: string;
  adherence: AdherenceScore;
  compliance: ComplianceCheck;
  nudges: Nudge[];
  processing_time_ms: number;
  model_used: string;
  timestamp: string;
}

interface UseScoring {
  connected: boolean;
  scoreSegment: (
    segmentId: string,
    nodeId: string,
    expectedText: string,
    actualTranscript: string
  ) => Promise<ScoreResponse | null>;
  latestScore: ScoreResponse | null;
  latestNudges: Nudge[];
  latestCompliance: ComplianceCheck | null;
  clearNudge: (index: number) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8006";

export function useScoring(agentId: string, enabled: boolean = true): UseScoring {
  const [connected, setConnected] = useState(false);
  const [latestScore, setLatestScore] = useState<ScoreResponse | null>(null);
  const [latestNudges, setLatestNudges] = useState<Nudge[]>([]);
  const [latestCompliance, setLatestCompliance] = useState<ComplianceCheck | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    if (!enabled || !agentId) return;

    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/ws/${agentId}`);

    ws.onopen = () => {
      console.log("WebSocket connected to scoring service");
      setConnected(true);

      // Send ping every 30 seconds
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);

      ws.onclose = () => {
        clearInterval(pingInterval);
      };
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "pong") {
          // Keepalive response
          return;
        }

        if (data.type === "score") {
          // Real-time score update from server
          setLatestScore(data.score);
          setLatestNudges((prev) => [...prev, ...data.score.nudges]);
          setLatestCompliance(data.score.compliance);
        }

        if (data.type === "nudge") {
          // Real-time nudge
          setLatestNudges((prev) => [...prev, data.nudge]);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnected(false);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [agentId, enabled]);

  // Score a segment via REST API
  const scoreSegment = async (
    segmentId: string,
    nodeId: string,
    expectedText: string,
    actualTranscript: string
  ): Promise<ScoreResponse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/scoring/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agentId,
          call_id: `call_${Date.now()}`, // Should come from call session
          segment_id: segmentId,
          script_node_id: nodeId,
          expected_text: expectedText,
          actual_transcript: actualTranscript,
          client_id: "SKY_TV_NZ",
        }),
      });

      if (!response.ok) {
        console.error("Scoring failed:", response.statusText);
        return null;
      }

      const scoreData: ScoreResponse = await response.json();

      // Update local state
      setLatestScore(scoreData);
      setLatestNudges((prev) => [...prev, ...scoreData.nudges]);
      setLatestCompliance(scoreData.compliance);

      return scoreData;
    } catch (error) {
      console.error("Failed to score segment:", error);
      return null;
    }
  };

  const clearNudge = (index: number) => {
    setLatestNudges((prev) => prev.filter((_, i) => i !== index));
  };

  return {
    connected,
    scoreSegment,
    latestScore,
    latestNudges,
    latestCompliance,
    clearNudge,
  };
}
