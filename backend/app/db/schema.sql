-- Pilot's Desk - PostgreSQL Database Schema
-- Phase 4: Governance & BI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table (linked to authentication)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    client_id VARCHAR(50) NOT NULL,  -- e.g., 'SKY_TV_NZ'
    team VARCHAR(100),
    supervisor_id UUID REFERENCES agents(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on client_id for filtering
CREATE INDEX idx_agents_client_id ON agents(client_id);
CREATE INDEX idx_agents_supervisor ON agents(supervisor_id);

-- Script versions table
CREATE TABLE script_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    schema_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE
);

-- Create index on client_id and active status
CREATE INDEX idx_script_versions_client ON script_versions(client_id);
CREATE INDEX idx_script_versions_active ON script_versions(is_active) WHERE is_active = true;

-- Call metadata table
CREATE TABLE call_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    client_id VARCHAR(50) NOT NULL,
    script_version_id UUID REFERENCES script_versions(id),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    disposition VARCHAR(50),  -- 'SALE', 'NO_SALE', 'CALLBACK', etc.
    adherence_score FLOAT,  -- Overall call adherence (0.0-1.0)
    compliance_ok BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_call_metadata_agent ON call_metadata(agent_id);
CREATE INDEX idx_call_metadata_client ON call_metadata(client_id);
CREATE INDEX idx_call_metadata_started ON call_metadata(started_at);
CREATE INDEX idx_call_metadata_created ON call_metadata(created_at);

-- Segment scores table (per-node scoring)
CREATE TABLE segment_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES call_metadata(id) ON DELETE CASCADE,
    segment_id VARCHAR(100) NOT NULL,
    node_id VARCHAR(100) NOT NULL,
    expected_text TEXT,
    actual_transcript TEXT,
    adherence_score FLOAT NOT NULL,
    key_points_covered TEXT[],
    key_points_missed TEXT[],
    compliance_ok BOOLEAN DEFAULT true,
    compliance_severity VARCHAR(20),  -- 'low', 'medium', 'high', 'critical'
    nudges_sent INTEGER DEFAULT 0,
    processing_time_ms FLOAT,
    model_used VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_segment_scores_call ON segment_scores(call_id);
CREATE INDEX idx_segment_scores_node ON segment_scores(node_id);
CREATE INDEX idx_segment_scores_created ON segment_scores(created_at);

-- Transcript metadata table (no full transcript text stored for privacy)
CREATE TABLE transcript_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES call_metadata(id) ON DELETE CASCADE,
    segment_count INTEGER NOT NULL,
    word_count INTEGER,
    pii_redaction_count INTEGER DEFAULT 0,
    pii_types JSONB,  -- {"credit_card": 2, "phone_nz": 1}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_transcript_metadata_call ON transcript_metadata(call_id);

-- Nudges table (coaching tips sent to agents)
CREATE TABLE nudges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES call_metadata(id) ON DELETE CASCADE,
    segment_id UUID REFERENCES segment_scores(id) ON DELETE CASCADE,
    nudge_type VARCHAR(50) NOT NULL,  -- 'adherence', 'compliance', 'keyword', etc.
    severity VARCHAR(20) NOT NULL,  -- 'info', 'warning', 'critical'
    message TEXT NOT NULL,
    node_id VARCHAR(100),
    acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_nudges_call ON nudges(call_id);
CREATE INDEX idx_nudges_created ON nudges(created_at);

-- Agent performance metrics (aggregated daily)
CREATE TABLE agent_daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    date DATE NOT NULL,
    client_id VARCHAR(50) NOT NULL,
    calls_total INTEGER DEFAULT 0,
    calls_with_sales INTEGER DEFAULT 0,
    avg_adherence_score FLOAT,
    avg_call_duration_seconds INTEGER,
    compliance_violations INTEGER DEFAULT 0,
    nudges_received INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, date, client_id)
);

-- Create indexes
CREATE INDEX idx_agent_daily_metrics_agent ON agent_daily_metrics(agent_id);
CREATE INDEX idx_agent_daily_metrics_date ON agent_daily_metrics(date);

-- Script node analytics (which nodes perform best/worst)
CREATE TABLE node_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(50) NOT NULL,
    script_version_id UUID REFERENCES script_versions(id),
    node_id VARCHAR(100) NOT NULL,
    calls_reached INTEGER DEFAULT 0,
    avg_adherence_score FLOAT,
    compliance_failure_count INTEGER DEFAULT 0,
    avg_time_spent_seconds FLOAT,
    transitions_taken JSONB,  -- {"next_node_1": 50, "next_node_2": 30}
    date DATE NOT NULL,
    UNIQUE(client_id, node_id, date)
);

-- Create indexes
CREATE INDEX idx_node_analytics_client ON node_analytics(client_id);
CREATE INDEX idx_node_analytics_node ON node_analytics(node_id);
CREATE INDEX idx_node_analytics_date ON node_analytics(date);

-- Active calls table (for supervisor real-time view)
CREATE TABLE active_calls (
    id UUID PRIMARY KEY,  -- Same as call_metadata.id
    agent_id UUID NOT NULL REFERENCES agents(id),
    agent_name VARCHAR(255),
    current_node_id VARCHAR(100),
    current_node_text TEXT,
    latest_adherence_score FLOAT,
    compliance_ok BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_active_calls_agent ON active_calls(agent_id);
CREATE INDEX idx_active_calls_updated ON active_calls(last_updated);

-- Function to clean up old data (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate cutoff date (90 days ago)
    cutoff_date := NOW() - INTERVAL '90 days';

    -- Delete old calls and cascading data
    DELETE FROM call_metadata WHERE created_at < cutoff_date;

    -- Delete old daily metrics
    DELETE FROM agent_daily_metrics WHERE date < (CURRENT_DATE - INTERVAL '90 days');

    -- Delete old node analytics
    DELETE FROM node_analytics WHERE date < (CURRENT_DATE - INTERVAL '90 days');

    RAISE NOTICE 'Cleaned up data older than %', cutoff_date;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job for cleanup (requires pg_cron extension)
-- Run daily at 2 AM
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data()');

-- Views for common queries

-- Active agents view (for supervisor dashboard)
CREATE VIEW v_active_agents AS
SELECT
    a.id,
    a.name,
    a.email,
    a.client_id,
    a.team,
    ac.id as active_call_id,
    ac.current_node_id,
    ac.latest_adherence_score,
    ac.started_at as call_started_at,
    EXTRACT(EPOCH FROM (NOW() - ac.started_at))::INTEGER as call_duration_seconds
FROM agents a
LEFT JOIN active_calls ac ON a.id = ac.agent_id
WHERE a.is_active = true;

-- Agent performance summary view
CREATE VIEW v_agent_performance AS
SELECT
    a.id as agent_id,
    a.name as agent_name,
    a.client_id,
    COUNT(DISTINCT cm.id) as total_calls,
    COUNT(DISTINCT CASE WHEN cm.disposition = 'SALE' THEN cm.id END) as sales_count,
    AVG(cm.adherence_score) as avg_adherence,
    AVG(cm.duration_seconds) as avg_duration_seconds,
    COUNT(DISTINCT CASE WHEN cm.compliance_ok = false THEN cm.id END) as compliance_violations,
    MAX(cm.ended_at) as last_call_at
FROM agents a
LEFT JOIN call_metadata cm ON a.id = cm.agent_id
WHERE a.is_active = true
  AND cm.started_at > (NOW() - INTERVAL '30 days')
GROUP BY a.id, a.name, a.client_id;

-- Script bottleneck analysis view
CREATE VIEW v_script_bottlenecks AS
SELECT
    na.client_id,
    na.node_id,
    SUM(na.calls_reached) as total_reached,
    AVG(na.avg_adherence_score) as avg_adherence,
    SUM(na.compliance_failure_count) as total_compliance_failures,
    AVG(na.avg_time_spent_seconds) as avg_time_spent
FROM node_analytics na
WHERE na.date > (CURRENT_DATE - INTERVAL '30 days')
GROUP BY na.client_id, na.node_id
HAVING SUM(na.calls_reached) > 10
ORDER BY avg_adherence ASC, total_compliance_failures DESC;

-- Grant permissions (adjust as needed for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pilots_desk_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pilots_desk_user;

-- Insert seed data for testing

-- Sample agents
INSERT INTO agents (email, name, client_id, team) VALUES
('agent1@example.com', 'Sarah Johnson', 'SKY_TV_NZ', 'Team A'),
('agent2@example.com', 'Michael Chen', 'SKY_TV_NZ', 'Team A'),
('agent3@example.com', 'Priya Patel', 'SKY_TV_NZ', 'Team B'),
('supervisor1@example.com', 'David Williams', 'SKY_TV_NZ', 'Management');

-- Sample script version
INSERT INTO script_versions (client_id, name, version, description, schema_json, is_active, created_by)
SELECT
    'SKY_TV_NZ',
    'Main Sales Pitch',
    '1.0.0',
    'Initial Sky TV NZ sales script',
    '{"version": "1.0.0", "nodes": []}'::jsonb,
    true,
    id
FROM agents WHERE email = 'supervisor1@example.com' LIMIT 1;

-- Comments for documentation
COMMENT ON TABLE call_metadata IS 'Stores metadata for each call (no transcript text for privacy)';
COMMENT ON TABLE segment_scores IS 'Per-node adherence and compliance scores';
COMMENT ON TABLE transcript_metadata IS 'Metadata about transcripts without storing actual text';
COMMENT ON TABLE active_calls IS 'Real-time view of currently active calls for supervisor dashboard';
COMMENT ON FUNCTION cleanup_old_data() IS 'Removes data older than 90 days for compliance';
