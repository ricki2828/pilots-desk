import { useState, useEffect, useCallback } from "react";

interface UseChoiceNavigationOptions {
  choiceCount: number;
  currentNodeId: string | undefined;
  onSelect: (index: number) => void;
  enabled: boolean;
}

export function useChoiceNavigation({
  choiceCount,
  currentNodeId,
  onSelect,
  enabled,
}: UseChoiceNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Reset on node change
  useEffect(() => {
    setFocusedIndex(0);
    setShowPreview(false);
  }, [currentNodeId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || choiceCount === 0) return;

      // Number keys 1-8: direct select
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8 && num <= choiceCount) {
        e.preventDefault();
        onSelect(num - 1);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % choiceCount);
          break;

        case " ":
          e.preventDefault();
          setShowPreview((prev) => !prev);
          break;

        case "Enter":
          e.preventDefault();
          onSelect(focusedIndex);
          break;

        case "Escape":
          e.preventDefault();
          setShowPreview(false);
          setFocusedIndex(0);
          break;
      }
    },
    [enabled, choiceCount, focusedIndex, onSelect]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    focusedIndex,
    setFocusedIndex,
    showPreview,
    setShowPreview,
  };
}
