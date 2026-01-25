#!/bin/bash
#
# Backend API Test Suite
# Tests all backend endpoints for Pilot's Desk
#
# Usage: ./backend-api-test.sh [BASE_URL]
# Example: ./backend-api-test.sh http://91.98.79.241:8007

set -e  # Exit on first error

BASE_URL="${1:-http://91.98.79.241:8007}"
PASSED=0
FAILED=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "  Pilot's Desk - Backend API Test Suite"
echo "  Testing: $BASE_URL"
echo "================================================"
echo ""

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local data="$5"

    TOTAL=$((TOTAL + 1))
    echo -n "[$TOTAL] Testing $name... "

    if [ "$method" = "GET" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status)"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $status)"
        FAILED=$((FAILED + 1))
    fi
}

# Test health endpoint
test_endpoint "Health Check" "GET" "/health" "200"

# Test scripts API
test_endpoint "List Scripts" "GET" "/api/scripts" "200"
test_endpoint "Get Sky TV Script" "GET" "/api/scripts/SKY_TV_NZ/main_pitch" "200"

# Test scoring API
scoring_data='{
  "agent_id": "test_agent_001",
  "script_version_id": "sky_tv_v1",
  "expected_text": "Hi {{customer_name}}, this is {{agent_name}} from Sky TV",
  "actual_transcript": "Hi John, this is Sarah from Sky TV"
}'
test_endpoint "Adherence Scoring" "POST" "/api/scoring/adherence" "200" "$scoring_data"

# Test compliance detection
compliance_data='{
  "agent_id": "test_agent_001",
  "transcript": "I want to sell you our premium package for just $99",
  "script_node_id": "legal_disclosure_01"
}'
test_endpoint "Compliance Detection" "POST" "/api/scoring/compliance" "200" "$compliance_data"

# Test analytics endpoints
test_endpoint "Get Agent Performance" "GET" "/api/analytics/agents/test_agent_001" "200"
test_endpoint "Get Call History" "GET" "/api/analytics/calls?start_date=2026-01-01" "200"

# Test supervisor endpoints
test_endpoint "Get Active Agents" "GET" "/api/supervisor/active-agents" "200"

# Test search endpoints
search_data='{
  "query": "Sky TV",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31"
}'
test_endpoint "Transcript Search" "POST" "/api/search/transcripts" "200" "$search_data"

echo ""
echo "================================================"
echo "  Test Results"
echo "================================================"
echo -e "Total:  $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
