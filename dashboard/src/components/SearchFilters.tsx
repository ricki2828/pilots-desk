/**
 * SearchFilters Component
 *
 * Provides filtering UI for transcript search
 * Includes text query, date range, agent, disposition, and adherence filters
 */

import React, { useState } from 'react';
import { SearchFilters as SearchFiltersType } from '../hooks/useTranscriptSearch';

interface SearchFiltersProps {
  clientId: string;
  onSearch: (filters: SearchFiltersType) => void;
  isSearching: boolean;
  onClear: () => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  clientId,
  onSearch,
  isSearching,
  onClear,
}) => {
  const [query, setQuery] = useState('');
  const [disposition, setDisposition] = useState('');
  const [minAdherence, setMinAdherence] = useState('');
  const [maxAdherence, setMaxAdherence] = useState('');
  const [complianceOnly, setComplianceOnly] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      return;
    }

    const filters: SearchFiltersType = {
      query: query.trim(),
      clientId,
    };

    if (disposition) {
      filters.disposition = disposition;
    }

    if (minAdherence) {
      filters.minAdherence = parseFloat(minAdherence) / 100;
    }

    if (maxAdherence) {
      filters.maxAdherence = parseFloat(maxAdherence) / 100;
    }

    if (complianceOnly) {
      filters.complianceOnly = true;
    }

    onSearch(filters);
  };

  const handleClear = () => {
    setQuery('');
    setDisposition('');
    setMinAdherence('');
    setMaxAdherence('');
    setComplianceOnly(false);
    onClear();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Filters</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Search Query */}
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
            Search Query
          </label>
          <input
            type="text"
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter keywords (e.g., sky sport, pricing, contract)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSearching}
          />
          <p className="mt-1 text-xs text-gray-500">
            Search is case-insensitive. Multiple words are combined with AND.
          </p>
        </div>

        {/* Advanced Filters */}
        <details className="border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            Advanced Filters
          </summary>

          <div className="mt-4 space-y-4">
            {/* Disposition */}
            <div>
              <label htmlFor="disposition" className="block text-sm font-medium text-gray-700 mb-2">
                Call Disposition
              </label>
              <select
                id="disposition"
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSearching}
              >
                <option value="">All Dispositions</option>
                <option value="SALE">Sale</option>
                <option value="NO_SALE">No Sale</option>
                <option value="CALLBACK">Callback</option>
                <option value="VOICEMAIL">Voicemail</option>
                <option value="NO_ANSWER">No Answer</option>
              </select>
            </div>

            {/* Adherence Score Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minAdherence" className="block text-sm font-medium text-gray-700 mb-2">
                  Min Adherence (%)
                </label>
                <input
                  type="number"
                  id="minAdherence"
                  value={minAdherence}
                  onChange={(e) => setMinAdherence(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSearching}
                />
              </div>
              <div>
                <label htmlFor="maxAdherence" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Adherence (%)
                </label>
                <input
                  type="number"
                  id="maxAdherence"
                  value={maxAdherence}
                  onChange={(e) => setMaxAdherence(e.target.value)}
                  placeholder="100"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSearching}
                />
              </div>
            </div>

            {/* Compliance Only */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="complianceOnly"
                checked={complianceOnly}
                onChange={(e) => setComplianceOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={isSearching}
              />
              <label htmlFor="complianceOnly" className="ml-2 text-sm text-gray-700">
                Compliant segments only
              </label>
            </div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={isSearching}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Quick Search Tips */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-1">Search Tips</h4>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Use multiple keywords to narrow results (e.g., "sky sport rugby")</li>
          <li>Search is case-insensitive</li>
          <li>All PII is automatically redacted in results</li>
          <li>Results are ordered by recency and relevance</li>
        </ul>
      </div>
    </div>
  );
};
