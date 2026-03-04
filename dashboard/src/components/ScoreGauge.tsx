/**
 * ScoreGauge Component
 *
 * Semi-circular SVG gauge for displaying overall coaching scores
 * Color-coded: green 80%+, blue 65%+, yellow 50%+, red <50%
 */

import React from 'react';

interface ScoreGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'lg';
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#3b82f6';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Acceptable';
  return 'Needs Work';
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, size = 'sm' }) => {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  if (size === 'lg') {
    // Large semi-circular gauge for expanded view
    const radius = 70;
    const circumference = Math.PI * radius; // semi-circle
    const progress = (score / 100) * circumference;
    const offset = circumference - progress;

    return (
      <div className="flex flex-col items-center">
        <svg width="180" height="100" viewBox="0 0 180 100">
          {/* Background arc */}
          <path
            d="M 10 90 A 70 70 0 0 1 170 90"
            fill="none"
            stroke="#334155"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d="M 10 90 A 70 70 0 0 1 170 90"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
          {/* Score text */}
          <text
            x="90"
            y="78"
            textAnchor="middle"
            className="fill-slate-50 text-3xl font-bold"
            style={{ fontSize: '32px', fontWeight: 700 }}
          >
            {score}
          </text>
          <text
            x="90"
            y="95"
            textAnchor="middle"
            className="fill-slate-400"
            style={{ fontSize: '11px' }}
          >
            / 100
          </text>
        </svg>
        <span
          className="text-sm font-semibold mt-1"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    );
  }

  // Small inline gauge
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="#334155"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
};
