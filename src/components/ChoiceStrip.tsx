import { useRef, useEffect } from "react";

export interface ChoiceItem {
  index: number;
  label: string;
  targetNodeId: string;
  targetNode: {
    id: string;
    type: string;
    config: {
      text?: string;
      keywords?: string[];
    };
  } | undefined;
  triggerType: string;
  keywords: string[];
}

interface ChoiceStripProps {
  choices: ChoiceItem[];
  focusedIndex: number;
  showPreview: boolean;
  onFocus: (index: number) => void;
  onSelect: (index: number) => void;
  getNodeTypeColor: (type: string) => string;
}

export default function ChoiceStrip({
  choices,
  focusedIndex,
  showPreview,
  onFocus,
  onSelect,
  getNodeTypeColor,
}: ChoiceStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scroll focused pill into view
  useEffect(() => {
    const pill = pillRefs.current[focusedIndex];
    if (pill) {
      pill.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [focusedIndex]);

  if (choices.length === 0) return null;

  const focusedChoice = choices[focusedIndex];
  const targetNode = focusedChoice?.targetNode;

  return (
    <div className="mt-4 border-t border-border/50 pt-3" ref={stripRef}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-heading font-bold text-mutedForeground uppercase tracking-wide">
          Choices ({choices.length})
        </span>
      </div>

      {/* Pill strip */}
      <div className="flex flex-wrap gap-2 relative">
        {choices.map((choice, idx) => {
          const isFocused = idx === focusedIndex;

          return (
            <button
              key={choice.targetNodeId}
              ref={(el) => { pillRefs.current[idx] = el; }}
              onClick={() => onSelect(idx)}
              onMouseEnter={() => onFocus(idx)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm
                text-xs font-body transition-all duration-100 cursor-pointer
                ${
                  isFocused
                    ? "bg-accent/20 border-2 border-accent opacity-100 shadow-pop-active"
                    : "bg-muted/60 border border-border/50 opacity-60 hover:opacity-80"
                }
              `}
            >
              {/* Number badge */}
              <span
                className={`
                  inline-flex items-center justify-center w-5 h-5 rounded-sm
                  text-[10px] font-heading font-bold shrink-0
                  ${
                    isFocused
                      ? "bg-accent text-accentForeground"
                      : "bg-muted border border-border text-mutedForeground"
                  }
                `}
              >
                {idx + 1}
              </span>

              {/* Label */}
              <span className={`truncate max-w-[140px] ${
                choice.triggerType === "AUTO" ? "italic text-mutedForeground" : "text-foreground"
              }`}>
                {choice.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Preview card */}
      {showPreview && targetNode && (
        <div className="mt-2 bg-card border-2 border-accent/50 rounded-sm p-3 shadow-pop-active animate-popIn max-h-[160px] overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 border rounded-sm text-[10px] font-heading font-bold shrink-0 ${getNodeTypeColor(targetNode.type)}`}>
              {targetNode.type}
            </span>
            <span className="text-[10px] font-mono text-mutedForeground truncate">
              {targetNode.id}
            </span>
          </div>

          {targetNode.config.text && (
            <p className="text-xs font-body text-foreground leading-relaxed">
              {targetNode.config.text.substring(0, 120)}
              {targetNode.config.text.length > 120 && "..."}
            </p>
          )}

          {focusedChoice.keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {focusedChoice.keywords.slice(0, 5).map((kw, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-muted border border-border/50 text-mutedForeground rounded-sm text-[10px] font-body"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
