-- Phase 2 Tables: Scenarios and Responses

CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'trading', 'negotiation', 'social', 'crisis'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profile_scenario_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  reasoning_chain TEXT NOT NULL,
  emotional_arc TEXT,
  confidence NUMERIC(3,2),
  generation_run_id UUID NOT NULL REFERENCES generation_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scenario_bias_applications (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  bias_id UUID NOT NULL REFERENCES biases(id) ON DELETE CASCADE,
  weight NUMERIC(3,2),
  PRIMARY KEY (scenario_id, bias_id)
);

CREATE TABLE emotional_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

-- RLS
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_scenario_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_bias_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read scenarios" ON scenarios FOR SELECT TO public USING (true);
CREATE POLICY "public read profile_scenario_responses" ON profile_scenario_responses FOR SELECT TO public USING (true);
CREATE POLICY "public read scenario_bias_applications" ON scenario_bias_applications FOR SELECT TO public USING (true);
CREATE POLICY "public read emotional_patterns" ON emotional_patterns FOR SELECT TO public USING (true);

-- Allow service role full access
CREATE POLICY "service role all scenarios" ON scenarios USING (current_user = 'service_role');
CREATE POLICY "service role all profile_scenario_responses" ON profile_scenario_responses USING (current_user = 'service_role');
CREATE POLICY "service role all scenario_bias_applications" ON scenario_bias_applications USING (current_user = 'service_role');
CREATE POLICY "service role all emotional_patterns" ON emotional_patterns USING (current_user = 'service_role');


-- Seed Data

INSERT INTO emotional_patterns (slug, name, description) VALUES
('panic_selling', 'Panic Selling', 'Intense fear leading to immediate liquidation of assets.'),
('fomo_buying', 'FOMO Buying', 'Anxiety of missing out prompting hasty purchases at peaks.'),
('paralysis', 'Analysis Paralysis', 'Overthinking leading to delayed or completely stalled action.'),
('aggressive_counter', 'Aggressive Counter-offer', 'Hostile or overly confident reciprocation during negotiations.');

INSERT INTO generators (slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status) VALUES
  ('scenario-gen', 1, 'scenario', 'Generates high-stakes psychological scenarios.',
   'You are a scenario designer. Generate {{count}} detailed, high-stakes scenarios in the {{category}} category. Make them realistic and psychologically testing.\n\nReturn JSON: {"items": [{"title": "...", "description": "..."}]}.',
   '{"type": "object", "properties": {"count": {"type": "integer", "default": 5}, "category": {"type": "string", "enum": ["trading", "negotiation", "social", "crisis"]}}, "required": ["count", "category"]}',
   '{"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {"title": {"type": "string"}, "description": {"type": "string"}}, "required": ["title", "description"]}}}, "required": ["items"]}',
   '{"provider": "openrouter", "model": "anthropic/claude-3.5-sonnet", "temperature": 0.8, "max_items_per_call": 5}',
   '[{"type": "schema_validate"}, {"type": "provenance_stamp"}, {"type": "route", "config": {"auto_approve_above": 0.8}}]',
   'active'),
  
  ('response-gen', 1, 'profile_scenario_response', 'Simulates a profile''s behavioral response to a scenario.',
   'Given the following psychometric profile: {{json profile_content}}\n\nHow would this exact person respond to this scenario: {{json scenario_content}}?\n\nReturn JSON: {"items": [{"response": "...", "reasoning_chain": "...", "emotional_arc": "...", "confidence": 0.95}]}.',
   '{"type": "object", "properties": {"profile_id": {"type": "string"}, "scenario_id": {"type": "string"}}, "required": ["profile_id", "scenario_id"]}',
   '{"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {"response": {"type": "string"}, "reasoning_chain": {"type": "string"}, "emotional_arc": {"type": "string"}, "confidence": {"type": "number", "minimum": 0, "maximum": 1}}, "required": ["response", "reasoning_chain", "emotional_arc", "confidence"]}}}, "required": ["items"]}',
   '{"provider": "openrouter", "model": "anthropic/claude-3.5-sonnet", "temperature": 0.7, "max_items_per_call": 1}',
   '[{"type": "schema_validate"}, {"type": "provenance_stamp"}, {"type": "route"}]',
   'active');
