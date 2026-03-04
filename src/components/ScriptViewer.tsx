import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PackageCalculator from "./PackageCalculator";
import ChoiceStrip, { type ChoiceItem } from "./ChoiceStrip";
import { useChoiceNavigation } from "../hooks/useChoiceNavigation";

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

function deriveLabel(transition: ScriptNode["transitions"][0]): string {
  switch (transition.trigger_type) {
    case "KEYWORD": {
      const val = transition.value;
      if (Array.isArray(val)) {
        return val.slice(0, 2).join(" / ");
      }
      return val ? String(val) : "Continue";
    }
    case "INTENT":
      return typeof transition.value === "string" ? transition.value : "Intent";
    case "AUTO":
      return "Continue \u2192";
    default:
      return typeof transition.value === "string"
        ? transition.value
        : Array.isArray(transition.value)
        ? transition.value.slice(0, 2).join(" / ")
        : "Continue";
  }
}

function getKeywords(transition: ScriptNode["transitions"][0]): string[] {
  if (!transition.value) return [];
  return Array.isArray(transition.value) ? transition.value : [transition.value];
}

export default function ScriptViewer() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [currentNode, setCurrentNode] = useState<ScriptNode | null>(null);
  const [allNodes, setAllNodes] = useState<ScriptNode[]>([]);
  const [scriptName, setScriptName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
  const [previousTranscript, setPreviousTranscript] = useState<string>("");
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Manual navigation to specific node
  const navigateToNode = useCallback(async (nodeId: string) => {
    try {
      await invoke("navigate_to_node", { nodeId });
      const current = await invoke<ScriptNode | null>("get_current_node");
      setCurrentNode(current);
    } catch (err) {
      console.error("Navigation failed:", err);
    }
  }, []);

  // Derive choice items from transitions
  const { choices, allAuto } = useMemo(() => {
    if (!currentNode || currentNode.transitions.length === 0) {
      return { choices: [] as ChoiceItem[], allAuto: false };
    }

    const allAutoTransitions = currentNode.transitions.every(
      (t) => t.trigger_type === "AUTO"
    );

    // Filter out AUTO transitions from mixed sets
    const visibleTransitions = allAutoTransitions
      ? currentNode.transitions
      : currentNode.transitions.filter((t) => t.trigger_type !== "AUTO");

    const items: ChoiceItem[] = visibleTransitions.map((t, idx) => ({
      index: idx,
      label: deriveLabel(t),
      targetNodeId: t.next_node,
      targetNode: allNodes.find((n) => n.id === t.next_node),
      triggerType: t.trigger_type,
      keywords: getKeywords(t),
    }));

    return { choices: items, allAuto: allAutoTransitions };
  }, [currentNode, allNodes]);

  // Handle choice selection
  const handleChoiceSelect = useCallback(
    (index: number) => {
      if (index >= 0 && index < choices.length) {
        navigateToNode(choices[index].targetNodeId);
      }
    },
    [choices, navigateToNode]
  );

  // Choice navigation hook
  const { focusedIndex, setFocusedIndex, showPreview } =
    useChoiceNavigation({
      choiceCount: choices.length,
      currentNodeId: currentNode?.id,
      onSelect: handleChoiceSelect,
      enabled: scriptLoaded && !!currentNode && !allAuto,
    });

  // ArrowUp for back navigation (separate from choice nav)
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!currentNode || !scriptLoaded) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
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

  // AUTO-advance: if all transitions are AUTO, advance after 500ms
  useEffect(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }

    if (allAuto && currentNode && currentNode.transitions.length > 0) {
      autoAdvanceTimer.current = setTimeout(() => {
        navigateToNode(currentNode.transitions[0].next_node);
      }, 500);
    }

    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, [allAuto, currentNode, navigateToNode]);

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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Script Header */}
      <div className="bg-accent border-b-2 border-foreground px-4 py-2 shadow-pop">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-heading font-bold text-accentForeground">{scriptName}</h2>
            <span className="text-accentForeground/60 text-xs font-mono">{currentNode.id}</span>
          </div>
          <button
            onClick={resetScript}
            className="px-3 py-1 bg-accentForeground text-accent border-2 border-foreground rounded-sm font-heading font-bold text-xs shadow-pop-active hover:shadow-pop hover:-translate-y-0.5 transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Current Node */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 animate-popIn">
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-3 py-1 border-2 rounded-sm text-xs font-heading font-bold ${getNodeTypeColor(currentNode.type)}`}>
              {currentNode.type}
            </span>
            {currentNode.config.verbatim_match && (
              <span className="px-3 py-1 border-2 border-secondary rounded-sm text-xs font-heading font-bold bg-secondary/20 text-foreground">
                COMPLIANCE {(currentNode.config.verbatim_match * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {currentNode.config.text && (
            <div className="bg-card border-2 border-foreground rounded-md p-5 shadow-pop">
              <p className="text-lg leading-normal text-foreground font-body whitespace-pre-wrap">
                {currentNode.config.text}
              </p>
            </div>
          )}

          {currentNode.config.display_notes && (
            <div className="mt-3 bg-tertiary/20 border-2 border-tertiary rounded-sm px-3 py-2">
              <p className="text-xs text-foreground font-body">
                <strong className="font-bold">Notes:</strong> {currentNode.config.display_notes}
              </p>
            </div>
          )}

          {currentNode.config.keywords && currentNode.config.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-mutedForeground font-body font-semibold">Listening:</span>
              {currentNode.config.keywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-muted border border-foreground/30 text-foreground rounded-sm text-xs font-body"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}

          {/* Widget Display */}
          {widgetConfig && widgetConfig.type === "SKY_TV_PACKAGES" && (
            <div className="mt-4">
              <PackageCalculator
                packages={widgetConfig.config.packages || []}
                onSelectionChange={(selectedIds, total) => {
                  console.log("Package selection changed:", selectedIds, total);
                }}
              />
            </div>
          )}
        </div>

        {/* Choice Strip — replaces old Next Steps */}
        {!allAuto && choices.length > 0 && (
          <ChoiceStrip
            choices={choices}
            focusedIndex={focusedIndex}
            showPreview={showPreview}
            onFocus={setFocusedIndex}
            onSelect={handleChoiceSelect}
            getNodeTypeColor={getNodeTypeColor}
          />
        )}
      </div>

      {/* Keyboard Hints */}
      <div className="bg-muted border-t border-foreground/30 px-4 py-1.5">
        <div className="flex items-center justify-between text-xs text-mutedForeground">
          <div className="flex items-center gap-3">
            <span className="font-body">
              <kbd className="px-1.5 py-0.5 bg-card border border-foreground/50 rounded-sm font-heading font-bold text-foreground">1</kbd>-<kbd className="px-1.5 py-0.5 bg-card border border-foreground/50 rounded-sm font-heading font-bold text-foreground">8</kbd> Jump
            </span>
            <span className="font-body">
              <kbd className="px-1.5 py-0.5 bg-card border border-foreground/50 rounded-sm font-heading font-bold text-foreground">↓</kbd> Cycle
            </span>
            <span className="font-body">
              <kbd className="px-1.5 py-0.5 bg-card border border-foreground/50 rounded-sm font-heading font-bold text-foreground">⏎</kbd> Go
            </span>
            <span className="font-body">
              <kbd className="px-1.5 py-0.5 bg-card border border-foreground/50 rounded-sm font-heading font-bold text-foreground">␣</kbd> Preview
            </span>
            <span className="font-body">
              <kbd className="px-1.5 py-0.5 bg-card border border-foreground/50 rounded-sm font-heading font-bold text-foreground">↑</kbd> Back
            </span>
          </div>
          <span className="font-mono text-[10px]">v3</span>
        </div>
      </div>

    </div>
  );
}
