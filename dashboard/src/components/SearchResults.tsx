/**
 * SearchResults Component
 *
 * Displays transcript search results with keyword highlighting
 * Shows call metadata and allows drill-down
 */

import React from 'react';
import { format, parseISO } from 'date-fns';
import { SearchResult } from '../hooks/useTranscriptSearch';

interface SearchResultsProps {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  query: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  totalResults,
  searchTime,
  query,
}) => {
  const highlightKeywords = (text: string, keywords: string[]): React.ReactNode => {
    if (!keywords.length) return text;

    // Create regex pattern for all keywords (case-insensitive)
    const pattern = new RegExp(`(${keywords.join('|')})`, 'gi');
    const parts = text.split(pattern);

    return parts.map((part, idx) => {
      const isKeyword = keywords.some(
        (keyword) => keyword.toLowerCase() === part.toLowerCase()
      );

      if (isKeyword) {
        return (
          <mark key={idx} className="bg-yellow-200 font-semibold px-1 rounded">
            {part}
          </mark>
        );
      }

      return <span key={idx}>{part}</span>;
    });
  };

  const getAdherenceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <svg
          className="w-16 h-16 text-gray-400 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Results Found</h3>
        <p className="text-gray-500">
          {query
            ? `No transcripts match "${query}". Try different keywords or adjust filters.`
            : 'Enter a search query to find transcripts.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Results Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Search Results for "{query}"
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Found {totalResults} result{totalResults !== 1 ? 's' : ''} in{' '}
              {searchTime.toFixed(0)}ms
            </p>
          </div>

          {totalResults > results.length && (
            <div className="text-sm text-gray-600">
              Showing first {results.length} results
            </div>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="divide-y divide-gray-200">
        {results.map((result, idx) => (
          <div key={result.segment_id} className="px-6 py-4 hover:bg-gray-50">
            {/* Result Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-semibold text-gray-900">
                    {result.agent_name}
                  </span>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs text-gray-600">
                    {format(parseISO(result.call_started_at), 'MMM dd, yyyy h:mm a')}
                  </span>
                  {result.call_disposition && (
                    <>
                      <span className="text-xs text-gray-500">•</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          result.call_disposition === 'SALE'
                            ? 'bg-green-100 text-green-800'
                            : result.call_disposition === 'NO_SALE'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {result.call_disposition}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="font-mono">{result.node_id}</span>
                  <span>•</span>
                  <span className={`font-semibold ${getAdherenceColor(result.adherence_score)}`}>
                    {Math.round(result.adherence_score * 100)}% adherence
                  </span>
                  {!result.compliance_ok && (
                    <>
                      <span>•</span>
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Compliance Violation
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Result Number */}
              <div className="text-xs text-gray-500">#{idx + 1}</div>
            </div>

            {/* Transcript Snippet with Highlighting */}
            <div className="bg-gray-50 rounded-lg p-4 mb-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                {highlightKeywords(result.transcript_snippet, result.matched_keywords)}
              </p>
            </div>

            {/* Matched Keywords */}
            {result.matched_keywords.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Matched:</span>
                <div className="flex flex-wrap gap-1">
                  {result.matched_keywords.map((keyword, kidx) => (
                    <span
                      key={kidx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Links */}
            <div className="mt-3 flex gap-4 text-xs">
              <button className="text-blue-600 hover:text-blue-800 font-medium">
                View Full Call →
              </button>
              <button className="text-gray-600 hover:text-gray-800">
                View Segment Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with Pagination Note */}
      {totalResults > results.length && (
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            Showing {results.length} of {totalResults} total results. Refine your search to see
            more specific results.
          </p>
        </div>
      )}
    </div>
  );
};
