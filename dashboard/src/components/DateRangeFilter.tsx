/**
 * DateRangeFilter Component
 *
 * Allows users to select date ranges for analytics
 * Provides preset options (7, 14, 30, 90 days) and custom range
 */

import React from 'react';

interface DateRangeFilterProps {
  selectedDays: number;
  onDaysChange: (days: number) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  selectedDays,
  onDaysChange,
}) => {
  const presets = [
    { label: '7 Days', days: 7 },
    { label: '14 Days', days: 14 },
    { label: '30 Days', days: 30 },
    { label: '90 Days', days: 90 },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        Date Range
      </label>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.days}
            onClick={() => onDaysChange(preset.days)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDays === preset.days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-600">
        Showing data from the last <span className="font-semibold">{selectedDays}</span>{' '}
        days
      </div>
    </div>
  );
};
