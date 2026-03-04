/**
 * Transcript Search hook
 *
 * Provides full-text search across call transcripts with filtering
 */

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';

export interface SearchFilters {
  query: string;
  clientId: string;
  agentId?: string;
  startDate?: Date;
  endDate?: Date;
  disposition?: string;
  minAdherence?: number;
  maxAdherence?: number;
  complianceOnly?: boolean;
  limit?: number;
}

export interface SearchResult {
  segment_id: string;
  call_id: string;
  node_id: string;
  agent_name: string;
  transcript_snippet: string;
  adherence_score: number;
  compliance_ok: boolean;
  call_started_at: string;
  call_disposition: string | null;
  matched_keywords: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total_results: number;
  query: string;
  search_time_ms: number;
}

interface UseTranscriptSearchResult {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  isSearching: boolean;
  error: string | null;
  search: (filters: SearchFilters) => Promise<void>;
  clear: () => void;
}

export function useTranscriptSearch(): UseTranscriptSearchResult {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (filters: SearchFilters) => {
    if (!filters.query || filters.query.trim().length < 2) {
      setError('Query must be at least 2 characters');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Build request body
      const requestBody: any = {
        query: filters.query.trim(),
        client_id: filters.clientId,
        limit: filters.limit || 50,
      };

      if (filters.agentId) {
        requestBody.agent_id = filters.agentId;
      }

      if (filters.startDate) {
        requestBody.start_date = format(filters.startDate, 'yyyy-MM-dd');
      }

      if (filters.endDate) {
        requestBody.end_date = format(filters.endDate, 'yyyy-MM-dd');
      }

      if (filters.disposition) {
        requestBody.disposition = filters.disposition;
      }

      if (filters.minAdherence !== undefined) {
        requestBody.min_adherence = filters.minAdherence;
      }

      if (filters.maxAdherence !== undefined) {
        requestBody.max_adherence = filters.maxAdherence;
      }

      if (filters.complianceOnly !== undefined) {
        requestBody.compliance_only = filters.complianceOnly;
      }

      const response = await apiFetch(`/api/search/transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Search failed');
      }

      const data: SearchResponse = await response.json();

      setResults(data.results);
      setTotalResults(data.total_results);
      setSearchTime(data.search_time_ms);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setTotalResults(0);
    setSearchTime(0);
    setError(null);
  }, []);

  return {
    results,
    totalResults,
    searchTime,
    isSearching,
    error,
    search,
    clear,
  };
}
