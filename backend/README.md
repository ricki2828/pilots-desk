# Pilot's Desk Backend - Scoring & Coaching Service

**FastAPI service for real-time adherence scoring and compliance monitoring**

## Features

- **Real-time Scoring**: Per-segment adherence scoring using LLMs
- **Compliance Detection**: Automated compliance violation detection
- **PII Redaction**: Automatic redaction of sensitive information
- **WebSocket Support**: Real-time score updates and nudges
- **Provider Agnostic**: Works with Claude (Anthropic) or GPT (OpenAI)

---

## Quick Start

### Prerequisites

- Python 3.11+
- Anthropic API key OR OpenAI API key

### Installation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your API key
nano .env  # or use your preferred editor
```

### Configuration

Edit `.env`:

```bash
# Choose your LLM model
LLM_MODEL=claude-3-5-haiku-20241022  # Fast, cost-effective
# OR
# LLM_MODEL=claude-3-5-sonnet-20241022  # More accurate
# OR
# LLM_MODEL=gpt-4o-mini  # OpenAI alternative

# Add your API key
ANTHROPIC_API_KEY=your_key_here
# OR
OPENAI_API_KEY=your_key_here

# Server settings (defaults are fine for development)
HOST=0.0.0.0
PORT=8006
LOG_LEVEL=INFO
```

### Running

```bash
# Development mode (auto-reload)
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8006 --workers 4
```

Server will start at: `http://localhost:8006`

---

## API Endpoints

### Health Check

```bash
GET /
GET /health

# Returns service status
```

### Scoring

```bash
POST /api/scoring/score

# Body:
{
  "agent_id": "agent_001",
  "call_id": "call_123",
  "segment_id": "seg_001",
  "script_node_id": "greeting_01",
  "expected_text": "Hi, I'm calling from Sky TV...",
  "actual_transcript": "Hello, this is John from Sky TV...",
  "client_id": "SKY_TV_NZ"
}

# Returns:
{
  "segment_id": "seg_001",
  "adherence": {
    "score": 0.95,
    "explanation": "Excellent adherence...",
    "key_points_covered": [...],
    "key_points_missed": [...],
    "recommendations": [...]
  },
  "compliance": {
    "is_compliant": true,
    "violation_type": null,
    "severity": "low",
    "message": null
  },
  "nudges": [...],
  "processing_time_ms": 1234,
  "model_used": "claude-3-5-haiku-20241022"
}
```

### WebSocket (Real-time)

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8006/ws/agent_001');

// Receive scores and nudges in real-time
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'score') {
    // Handle score update
  }
  if (data.type === 'nudge') {
    // Handle nudge
  }
};

// Send keepalive ping
ws.send(JSON.stringify({ type: 'ping' }));
```

---

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI app + WebSocket manager
│   ├── routers/
│   │   ├── scoring.py       # Scoring endpoints
│   │   └── analytics.py     # Analytics (Phase 4)
│   ├── services/
│   │   ├── llm_provider.py  # LiteLLM abstraction
│   │   ├── adherence.py     # Adherence scoring
│   │   ├── compliance.py    # Compliance detection
│   │   └── pii_redactor.py  # PII redaction
│   ├── models/
│   │   └── score.py         # Data models
│   └── db/                  # Database (Phase 4)
│
├── prompts/
│   └── sky_tv_scoring.txt   # Sky TV scoring guidelines
│
├── logs/                    # Application logs
├── requirements.txt
├── .env.example
└── README.md                # This file
```

---

## Scoring System

### Adherence Scoring

Scores agent performance 0.0-1.0 based on:

1. **Key Points Coverage** (60%)
   - Did agent mention main value propositions?
   - Did agent address customer needs?

2. **Structure & Flow** (20%)
   - Logical progression
   - Customer engagement

3. **Professionalism** (20%)
   - Tone and language
   - Objection handling

### Compliance Detection

Checks for:
- **Recording Consent** (critical)
- **Parental Controls** (high)
- **Price Disclosure** (medium)
- **Cancellation Policy** (medium)

Violations trigger immediate nudges.

### Nudge Generation

Real-time coaching tips:
- Short (max 15 words)
- Actionable
- Encouraging tone
- Non-distracting

---

## PII Redaction

Automatically redacts:
- **Credit cards** (Visa, MC, Amex, Discover)
- **CVV codes**
- **Phone numbers** (NZ and SA)
- **Emails**
- **Addresses** (NZ format)
- **IRD numbers** (NZ tax ID)
- **SIN numbers** (Canadian)
- **Bank accounts** (NZ format)
- **Dates of birth**

PII is replaced with tokens: `[CARD]`, `[PHONE_NZ]`, `[EMAIL]`, etc.

---

## Performance

### Target Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Scoring Latency | < 10 seconds | Per segment |
| WebSocket Latency | < 100ms | Real-time updates |
| Throughput | 100 req/min | Per worker |
| Accuracy | > 95% | SA accent adherence |

### Optimization

- Use `claude-3-5-haiku` for fast scoring
- Cache common patterns (future)
- Batch processing for post-call analysis
- Multiple Uvicorn workers for production

---

## Development

### Testing

```bash
# Install dev dependencies
pip install pytest httpx

# Run tests (future)
pytest tests/
```

### Debugging

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Run with auto-reload
python -m app.main
```

### API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8006/docs
- **ReDoc**: http://localhost:8006/redoc

---

## Deployment

### Production Checklist

- [ ] Set strong API keys in environment
- [ ] Use production LLM model
- [ ] Configure multiple workers
- [ ] Set up reverse proxy (nginx)
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Set up monitoring
- [ ] Configure log rotation

### Environment Variables

```bash
# Production settings
LLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=<production-key>
HOST=127.0.0.1  # Behind reverse proxy
PORT=8006
LOG_LEVEL=WARNING
```

### Systemd Service

```ini
# /etc/systemd/system/pilots-desk-api.service
[Unit]
Description=Pilot's Desk Scoring API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pilots-desk/backend
Environment="PATH=/opt/pilots-desk/backend/venv/bin"
ExecStart=/opt/pilots-desk/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8006 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Troubleshooting

### "No LLM API keys configured"

**Solution**: Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to `.env`

### Scoring returns 0.5 / "Scoring service temporarily unavailable"

**Cause**: LLM API call failed

**Check**:
1. API key is valid
2. API quota not exceeded
3. Network connectivity
4. Check logs for error details

### PII not being redacted

**Check**:
1. PII follows expected patterns (NZ/SA/Canada formats)
2. Check `logs/backend.log` for redaction counts
3. Test patterns in `pii_redactor.py`

### WebSocket disconnects immediately

**Cause**: CORS or network issue

**Check**:
1. Desktop app URL in CORS allowed origins
2. WebSocket URL uses `ws://` not `http://`
3. Firewall allows WebSocket connections

---

## License

Proprietary - CoSauce © 2026

---

## Support

- **Documentation**: This README
- **API Docs**: http://localhost:8006/docs
- **Logs**: `logs/backend.log`

---

**Status**: Phase 3 Complete | Production Ready (Pending Testing)
**Next**: Deploy to CoSauce server (91.98.79.241:8006)
