import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PackageCalculator from "./PackageCalculator";

interface ScriptNode {
  id: string;
  type: string;
  config: {
    text?: string;
    keywords?: string[];
    wait_for_response?: boolean;
    display_notes?: string;
    widget?: string;
    auto_trigger?: {
      listen_for: string[];
      action: string;
    };
    verbatim_match?: number;
    on_skip?: string;
    alert_message?: string;
    action?: string;
    disposition?: string;
  };
  transitions: Array<{
    trigger_type: string;
    value?: string | string[];
    next_node: string;
    confidence_threshold?: number;
  }>;
}

interface Transcript {
  text: string;
  confidence: number;
  timestamp: number;
  is_final: boolean;
}

interface WidgetConfig {
  type: string;
  config: {
    packages?: Array<{
      id: string;
      name: string;
      price: number;
    }>;
  };
}

export default function ScriptViewer() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [currentNode, setCurrentNode] = useState<ScriptNode | null>(null);
  const [allNodes, setAllNodes] = useState<ScriptNode[]>([]);
  const [scriptName, setScriptName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
  const [previousTranscript, setPreviousTranscript] = useState<string>("");

  // Load script on mount
  useEffect(() => {
    const loadScript = async () => {
      try {
        const scriptPath = "scripts/sky_tv_nz/main_pitch_v2.json";
        const result = await invoke<string>("load_script", { scriptPath });
        setScriptName(result);
        setScriptLoaded(true);
        setError(null);

        // Get all nodes for reference
        const nodes = await invoke<ScriptNode[]>("get_all_nodes");
        setAllNodes(nodes);

        // Get current node
        const current = await invoke<ScriptNode | null>("get_current_node");
        setCurrentNode(current);
      } catch (err) {
        setError(String(err));
        console.error("Failed to load script:", err);
      }
    };

    loadScript();
  }, []);

  // Load widget when current node changes
  useEffect(() => {
    const loadWidget = async () => {
      if (!currentNode || !currentNode.config.widget) {
        setWidgetConfig(null);
        return;
      }

      try {
        const widget = await invoke<WidgetConfig>("get_widget", {
          widgetId: currentNode.config.widget,
        });
        setWidgetConfig(widget);
      } catch (err) {
        console.error("Failed to load widget:", err);
        setWidgetConfig(null);
      }
    };

    loadWidget();
  }, [currentNode]);

  // Listen for transcript events and process them
  useEffect(() => {
    const unlisten = listen<Transcript>("transcript", async (event) => {
      if (!scriptLoaded) return;

      const newTranscript = event.payload.text;

      try {
        // Accumulate transcript for current node
        const fullTranscript = previousTranscript + " " + newTranscript;
        setPreviousTranscript(fullTranscript);

        // Process transcript through script engine
        const navigatedTo = await invoke<string | null>(
          "process_script_transcript",
          { transcript: newTranscript }
        );

        if (navigatedTo) {
          console.log("Auto-navigated to:", navigatedTo);

          // Clear transcript accumulator for new node
          setPreviousTranscript("");

          // Refresh current node
          const current = await invoke<ScriptNode | null>("get_current_node");
          setCurrentNode(current);
        }

        // Check for auto-trigger keywords in widget
        if (currentNode?.config.auto_trigger && widgetConfig) {
          const transcript_lower = newTranscript.toLowerCase();
          for (const keyword of currentNode.config.auto_trigger.listen_for) {
            if (transcript_lower.includes(keyword.toLowerCase())) {
              console.log("Auto-trigger detected:", keyword);
              // Trigger action based on auto_trigger.action
              // For now, enable the package (hardcoded to "sport" for rugby example)
              if (currentNode.config.auto_trigger.action === "enable_sport_package") {
                (window as any).enablePackage?.("sport");
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to process transcript:", err);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [scriptLoaded, currentNode, widgetConfig, previousTranscript]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!currentNode || !scriptLoaded) return;

      // Arrow keys for navigation through transitions
      if (e.key === "ArrowDown" && currentNode.transitions.length > 0) {
        try {
          const nextNodeId = currentNode.transitions[0].next_node;
          await invoke("navigate_to_node", { nodeId: nextNodeId });
          const current = await invoke<ScriptNode | null>("get_current_node");
          setCurrentNode(current);
        } catch (err) {
          console.error("Navigation failed:", err);
        }
      } else if (e.key === "ArrowUp") {
        try {
          await invoke("navigate_back");
          const current = await invoke<ScriptNode | null>("get_current_node");
          setCurrentNode(current);
        } catch (err) {
          console.error("Navigate back failed:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentNode, scriptLoaded]);

  // Manual navigation to specific node
  const navigateToNode = async (nodeId: string) => {
    try {
      await invoke("navigate_to_node", { nodeId });
      const current = await invoke<ScriptNode | null>("get_current_node");
      setCurrentNode(current);
    } catch (err) {
      console.error("Navigation failed:", err);
    }
  };

  // Reset script to beginning
  const resetScript = async () => {
    try {
      await invoke("reset_script");
      const current = await invoke<ScriptNode | null>("get_current_node");
      setCurrentNode(current);
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  // Get next possible nodes
  const getNextNodes = (): ScriptNode[] => {
    if (!currentNode) return [];
    return currentNode.transitions
      .map((t) => allNodes.find((n) => n.id === t.next_node))
      .filter((n): n is ScriptNode => n !== undefined);
  };

  // Get node type badge color (CoSauce style)
  const getNodeTypeColor = (type: string): string => {
    switch (type) {
      case "SCRIPT":
        return "bg-accent/20 text-foreground border-accent";
      case "BRANCH":
        return "bg-tertiary/20 text-foreground border-tertiary";
      case "WIDGET":
        return "bg-secondary/20 text-foreground border-secondary";
      case "COMPLIANCE":
        return "bg-secondary/30 text-foreground border-secondary";
      case "SCRIPT_AND_WIDGET":
        return "bg-accent/30 text-foreground border-accent";
      case "ACTION":
        return "bg-quaternary/20 text-foreground border-quaternary";
      default:
        return "bg-muted text-foreground border-border";
    }
  };

  if (error) {
    return (
      <div className="p-8 bg-secondary/20 border-2 border-secondary rounded-md shadow-pop-pink">
        <h3 className="text-2xl font-heading font-bold text-foreground mb-3">Script Load Error</h3>
        <p className="text-foreground font-body">{error}</p>
      </div>
    );
  }

  if (!scriptLoaded || !currentNode) {
    return (
      <div className="p-8 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted border-2 border-border rounded w-3/4 mx-auto"></div>
          <div className="h-6 bg-muted border-2 border-border rounded w-1/2 mx-auto"></div>
        </div>
        <p className="mt-6 text-foreground font-body font-semibold text-lg">Loading script...</p>
      </div>
    );
  }

  const nextNodes = getNextNodes();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Script Header */}
      <div className="bg-accent border-b-2 border-foreground p-6 shadow-pop">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-heading font-bold text-accentForeground">{scriptName}</h2>
            <p className="text-accentForeground/80 text-sm font-body font-semibold mt-1">Node: {currentNode.id}</p>
          </div>
          <button
            onClick={resetScript}
            className="px-4 py-2 bg-accentForeground text-accent border-2 border-foreground rounded-sm font-heading font-bold text-sm shadow-pop-active hover:shadow-pop hover:-translate-y-0.5 transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Current Node */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 animate-popIn">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-4 py-2 border-2 rounded-sm text-sm font-heading font-bold ${getNodeTypeColor(currentNode.type)}`}>
              {currentNode.type}
            </span>
            {currentNode.config.verbatim_match && (
              <span className="px-4 py-2 border-2 border-secondary rounded-sm text-sm font-heading font-bold bg-secondary/20 text-foreground">
                COMPLIANCE: {(currentNode.config.verbatim_match * 100).toFixed(0)}% Match Required
              </span>
            )}
          </div>

          {currentNode.config.text && (
            <div className="bg-card border-2 border-foreground rounded-md p-8 shadow-pop">
              <p className="text-xl leading-relaxed text-foreground font-body whitespace-pre-wrap">
                {currentNode.config.text}
              </p>
            </div>
          )}

          {currentNode.config.display_notes && (
            <div className="mt-4 bg-tertiary/20 border-2 border-tertiary rounded-sm p-4">
              <p className="text-sm text-foreground font-body">
                <strong className="font-bold">Notes:</strong> {currentNode.config.display_notes}
              </p>
            </div>
          )}

          {currentNode.config.keywords && currentNode.config.keywords.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-mutedForeground font-body font-semibold mb-2">Listening for keywords:</p>
              <div className="flex flex-wrap gap-2">
                {currentNode.config.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-muted border-2 border-foreground text-foreground rounded-sm text-sm font-body font-semibold"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Widget Display */}
          {widgetConfig && widgetConfig.type === "SKY_TV_PACKAGES" && (
            <div className="mt-6">
              <PackageCalculator
                packages={widgetConfig.config.packages || []}
                onSelectionChange={(selectedIds, total) => {
                  console.log("Package selection changed:", selectedIds, total);
                }}
              />
            </div>
          )}
        </div>

        {/* Next Possible Nodes (Dimmed Preview) */}
        {nextNodes.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-heading font-bold text-mutedForeground mb-4 uppercase tracking-wide">
              Next Steps ({nextNodes.length})
            </h3>
            <div className="space-y-4">
              {nextNodes.map((node, idx) => (
                <button
                  key={node.id}
                  onClick={() => navigateToNode(node.id)}
                  className="w-full text-left bg-muted hover:bg-card border-2 border-border hover:border-foreground rounded-sm p-5 opacity-60 hover:opacity-100 transition-all hover:shadow-pop-active"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 border-2 rounded-sm text-xs font-heading font-bold ${getNodeTypeColor(node.type)}`}>
                      {node.type}
                    </span>
                    <span className="text-xs text-mutedForeground font-mono font-semibold">{node.id}</span>
                  </div>
                  {node.config.text && (
                    <p className="text-sm text-foreground font-body line-clamp-2">
                      {node.config.text.substring(0, 150)}...
                    </p>
                  )}
                  {/* Show trigger info */}
                  {currentNode.transitions[idx] && (
                    <div className="mt-2 text-xs text-mutedForeground font-body">
                      Trigger: {currentNode.transitions[idx].trigger_type}
                      {currentNode.transitions[idx].value && (
                        <span className="ml-2">
                          (
                          {Array.isArray(currentNode.transitions[idx].value)
                            ? (currentNode.transitions[idx].value as string[]).join(", ")
                            : currentNode.transitions[idx].value}
                          )
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Hints */}
      <div className="bg-muted border-t-2 border-foreground p-4">
        <div className="flex items-center justify-between text-sm text-foreground">
          <div className="flex items-center gap-6">
            <span className="font-body font-semibold">
              <kbd className="px-3 py-1.5 bg-card border-2 border-foreground rounded-sm font-heading font-bold shadow-pop-active">↓</kbd> Next
            </span>
            <span className="font-body font-semibold">
              <kbd className="px-3 py-1.5 bg-card border-2 border-foreground rounded-sm font-heading font-bold shadow-pop-active">↑</kbd> Back
            </span>
            <span className="font-body font-semibold">Click card to jump</span>
          </div>
          <span className="font-body font-semibold text-mutedForeground">v2</span>
        </div>
      </div>

    </div>
  );
}
