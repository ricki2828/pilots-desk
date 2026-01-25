/**
 * TranscriptSearch Page
 *
 * Full-text search portal for call transcripts
 * Allows searching, filtering, and viewing transcript segments
 */

import React from 'react';
import { useTranscriptSearch, SearchFilters as SearchFiltersType } from '../hooks/useTranscriptSearch';
import { SearchFilters } from '../components/SearchFilters';
import { SearchResults } from '../components/SearchResults';

interface TranscriptSearchProps {
  clientId?: string;
}

export const TranscriptSearch: React.FC<TranscriptSearchProps> = ({
  clientId = 'SKY_TV_NZ',
}) => {
  const { results, totalResults, searchTime, isSearching, error, search, clear } =
    useTranscriptSearch();

  const [currentQuery, setCurrentQuery] = React.useState('');

  const handleSearch = async (filters: SearchFiltersType) => {
    setCurrentQuery(filters.query);
    await search(filters);
  };

  const handleClear = () => {
    setCurrentQuery('');
    clear();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Transcript Search</h1>
        <p className="text-gray-600">
          Search call transcripts with full-text keyword matching. All PII is automatically
          redacted.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-400 text-red-800 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Layout: Filters on left, Results on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters Column (1/3 width on large screens) */}
        <div className="lg:col-span-1">
          <SearchFilters
            clientId={clientId}
            onSearch={handleSearch}
            isSearching={isSearching}
            onClear={handleClear}
          />
        </div>

        {/* Results Column (2/3 width on large screens) */}
        <div className="lg:col-span-2">
          <SearchResults
            results={results}
            totalResults={totalResults}
            searchTime={searchTime}
            query={currentQuery}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Transcript search uses full-text keyword matching across all call segments
        </p>
        <p className="mt-1">
          Results are limited to 50 most relevant matches. Use filters to narrow search.
        </p>
      </div>
    </div>
  );
};
