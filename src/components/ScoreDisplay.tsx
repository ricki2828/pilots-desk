interface AdherenceScore {
  score: number;
  explanation: string;
  key_points_covered: string[];
  key_points_missed: string[];
  recommendations: string[];
}

interface ScoreDisplayProps {
  score: AdherenceScore | null;
  nodeId: string;
  showDetails?: boolean;
}

export default function ScoreDisplay({
  score,
  nodeId,
  showDetails = false,
}: ScoreDisplayProps) {
  if (!score) {
    return null;
  }

  const getScoreColor = (value: number): string => {
    if (value >= 0.9) return "text-green-600";
    if (value >= 0.75) return "text-blue-600";
    if (value >= 0.6) return "text-yellow-600";
    if (value >= 0.4) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBgColor = (value: number): string => {
    if (value >= 0.9) return "bg-green-100 border-green-300";
    if (value >= 0.75) return "bg-blue-100 border-blue-300";
    if (value >= 0.6) return "bg-yellow-100 border-yellow-300";
    if (value >= 0.4) return "bg-orange-100 border-orange-300";
    return "bg-red-100 border-red-300";
  };

  const getScoreLabel = (value: number): string => {
    if (value >= 0.9) return "Excellent";
    if (value >= 0.75) return "Good";
    if (value >= 0.6) return "Acceptable";
    if (value >= 0.4) return "Needs Improvement";
    return "Poor";
  };

  return (
    <div
      className={`rounded-lg border-2 p-4 ${getScoreBgColor(score.score)}`}
    >
      {/* Score Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-700">
            Adherence Score
          </h4>
          <p className="text-xs text-gray-600">Node: {nodeId}</p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${getScoreColor(score.score)}`}>
            {(score.score * 100).toFixed(0)}%
          </div>
          <div className={`text-xs font-semibold ${getScoreColor(score.score)}`}>
            {getScoreLabel(score.score)}
          </div>
        </div>
      </div>

      {/* Explanation */}
      {score.explanation && (
        <div className="mb-3">
          <p className="text-sm text-gray-700">{score.explanation}</p>
        </div>
      )}

      {/* Details (collapsible) */}
      {showDetails && (
        <div className="space-y-3 pt-3 border-t border-gray-300">
          {/* Points Covered */}
          {score.key_points_covered.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">
                ✓ Points Covered:
              </p>
              <ul className="text-xs text-gray-700 space-y-1">
                {score.key_points_covered.map((point, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-green-600 mr-1">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Points Missed */}
          {score.key_points_missed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1">
                ✗ Points Missed:
              </p>
              <ul className="text-xs text-gray-700 space-y-1">
                {score.key_points_missed.map((point, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-red-600 mr-1">✗</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {score.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">
                💡 Recommendations:
              </p>
              <ul className="text-xs text-gray-700 space-y-1">
                {score.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-blue-600 mr-1">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
