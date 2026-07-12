-- 6 decision styles (Scott & Bruce 1995 GDMS + deliberative)
INSERT INTO decision_styles (slug,name,description) VALUES
('analytical','Analytical','Systematic evaluation of options against criteria'),
('intuitive','Intuitive','Gut-feel pattern recognition; fast, low deliberation'),
('dependent','Dependent','Seeks advice and validation before deciding'),
('avoidant','Avoidant','Postpones or evades decisions under uncertainty'),
('spontaneous','Spontaneous','Impulsive, immediacy-seeking decisions'),
('deliberative','Deliberative','Slow, exhaustive weighing; discomfort with ambiguity');

-- Rejection reason taxonomy
INSERT INTO rejection_reasons (code,label,description) VALUES
('incoherent_traits','Incoherent traits','Big Five scores contradict each other or the summary'),
('bias_mismatch','Bias mismatch','Linked biases implausible for the trait vector'),
('generic_content','Generic content','Boilerplate; no distinguishing behavioral detail'),
('unrealistic','Unrealistic','Psychologically implausible pattern'),
('distribution_outlier','Distribution outlier','Valid alone but skews population statistics'),
('duplicate_like','Near-duplicate','Too similar to an existing approved item'),
('schema_drift','Schema drift','Valid JSON but semantically off-spec'),
('other','Other','Requires a free-text note');

-- 20 cognitive biases
INSERT INTO biases (slug,name,description,source) VALUES
('loss-aversion','Loss Aversion','Losses loom larger than equivalent gains','Kahneman & Tversky (1979)'),
('fomo','Fear of Missing Out','Anxiety-driven action to avoid missing rewarding experiences','Przybylski et al. (2013)'),
('anchoring','Anchoring','Over-reliance on the first number or fact encountered','Tversky & Kahneman (1974)'),
('sunk-cost','Sunk Cost Fallacy','Continuing investment to justify past investment','Arkes & Blumer (1985)'),
('confirmation','Confirmation Bias','Seeking evidence that supports existing beliefs','Nickerson (1998)'),
('overconfidence','Overconfidence','Certainty exceeding actual accuracy','Moore & Healy (2008)'),
('herd-behavior','Herd Behavior','Following crowd actions over private information','Banerjee (1992)'),
('availability','Availability Heuristic','Judging likelihood by ease of recall','Tversky & Kahneman (1973)'),
('recency','Recency Bias','Overweighting the most recent observations','Murdock (1962)'),
('disposition-effect','Disposition Effect','Selling winners early, holding losers long','Shefrin & Statman (1985)'),
('status-quo','Status Quo Bias','Preferring the current state over change','Samuelson & Zeckhauser (1988)'),
('endowment','Endowment Effect','Valuing owned things above market value','Thaler (1980)'),
('hindsight','Hindsight Bias','Seeing past events as having been predictable','Fischhoff (1975)'),
('optimism','Optimism Bias','Underestimating personal risk of negative events','Sharot (2011)'),
('framing','Framing Effect','Different choices from equivalent presentations','Tversky & Kahneman (1981)'),
('gamblers-fallacy','Gambler''s Fallacy','Expecting reversal after streaks in independent events','Tversky & Kahneman (1971)'),
('ostrich-effect','Ostrich Effect','Avoiding negative information exposure','Galai & Sade (2006)'),
('bandwagon','Bandwagon Effect','Adopting beliefs because many others hold them','Leibenstein (1950)'),
('authority-bias','Authority Bias','Overweighting authority figures'' opinions','Milgram (1963)'),
('dunning-kruger','Dunning–Kruger Effect','Low ability paired with inflated self-assessment','Kruger & Dunning (1999)');

INSERT INTO generators (slug,version,entity_type,description,prompt_template,params_schema,output_schema,model_config,hooks,status) VALUES
  ('big-five-profile-gen',1,'profile', 'Generates detailed Big Five personality profiles.',
   'You are a psychometric data engineer generating synthetic personality profiles grounded in the Five-Factor Model as operationalized by the IPIP-NEO instrument.\n\nGenerate {{count}} synthetic profiles for the domain: {{domain}}.\n{{#if trait_skew}}Population skew: {{trait_skew}} — shift that trait''s mean by 0.15–0.25 in the indicated direction; keep other traits population-typical.{{/if}}\n\nRequirements per profile:\n1. big_five: five scores in [0,1], internally coherent, avoiding uniform or extreme-only vectors. Across the batch, approximate a normal distribution (mean ~0.5, sd ~0.15 per trait) unless skewed above.\n2. summary: 2-3 sentences describing how this person thinks and decides — specific and behavioral, never generic. No names, no demographics.\n3. decision_style: one of analytical | intuitive | dependent | avoidant | spontaneous | deliberative, consistent with the trait vector.\n4. mbti_label: closest MBTI type derived from Big Five (E/I from extraversion, N/S from openness, T/F from agreeableness, J/P from conscientiousness). Cosmetic label only.\n5. suggested_biases: 2-4 objects {slug, strength in [0,1]} drawn ONLY from: {{json bias_slugs}} - strengths justified by the trait vector (e.g. high neuroticism supports loss-aversion strength > 0.6).\n6. tags: 3-6 lowercase kebab-case tags including "{{domain}}".\n\n{{extra_instructions}}\n\nReturn JSON: {"items": [ ...profiles ]}. No commentary.',
   '{"type": "object", "properties": {"count": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20, "description": "How many profiles to generate"}, "domain": {"type": "string", "default": "general", "enum": ["general", "trading", "negotiation", "social", "workplace"]}, "trait_skew": {"type": "string", "default": "none", "enum": ["none", "high_neuroticism", "high_openness", "low_agreeableness", "high_conscientiousness"]}, "extra_instructions": {"type": "string", "default": ""}}, "required": ["count", "domain"], "additionalProperties": false}',
   '{"type": "object", "additionalProperties": false, "required": ["items"], "properties": { "items": { "type": "array", "minItems": 1, "items": { "type": "object", "additionalProperties": false, "required": ["big_five","summary","decision_style","mbti_label","suggested_biases","tags"], "properties": { "big_five": { "type": "object", "additionalProperties": false, "required": ["openness","conscientiousness","extraversion","agreeableness","neuroticism"], "properties": { "openness": {"type":"number","minimum":0,"maximum":1}, "conscientiousness": {"type":"number","minimum":0,"maximum":1}, "extraversion": {"type":"number","minimum":0,"maximum":1}, "agreeableness": {"type":"number","minimum":0,"maximum":1}, "neuroticism": {"type":"number","minimum":0,"maximum":1} } }, "summary": {"type":"string","minLength":80,"maxLength":600}, "decision_style": {"type":"string","enum":["analytical","intuitive","dependent","avoidant","spontaneous","deliberative"]}, "mbti_label": {"type":"string","pattern":"^[EI][NS][TF][JP]$"}, "suggested_biases": { "type":"array","minItems":2,"maxItems":4, "items":{"type":"object","additionalProperties":false, "required":["slug","strength"], "properties":{"slug":{"type":"string"},"strength":{"type":"number","minimum":0,"maximum":1}}} }, "tags": {"type":"array","minItems":3,"maxItems":6, "items":{"type":"string","pattern":"^[a-z0-9-]+$"}} } } } } }',
   '{"provider": "openrouter", "model": "anthropic/claude-3.5-sonnet", "temperature": 0.9, "max_items_per_call": 10}',
   '[{"type": "schema_validate"}, {"type": "dedup", "config": {"threshold": 0.55}}, {"type": "provenance_stamp"}, {"type": "route", "config": {"auto_approve_above": null, "auto_reject_below": null}}]',
   'active'),
  ('bias-linker-gen',1,'profile_bias_links', 'Links biases to an existing profile based on its traits.',
   'Propose 2-5 biases from {{json bias_slugs}} for the following profile: {{json profile_content}}',
   '{"type": "object", "properties": {"profile_id": {"type": "string", "format": "uuid"}}, "required": ["profile_id"]}',
   '{"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {"slug": {"type": "string"}, "strength": {"type": "number"}, "context_notes": {"type": "string"}}}}}}',
   '{"provider": "openai", "model": "gpt-4o", "temperature": 0.7, "max_items_per_call": 10}',
   '[]',
   'draft');

INSERT INTO recipes (query_rules, composition_rules) VALUES
('{"entity": "profile", "filters": {"status": "approved"}, "allow_request_filters": ["tags","big_five_min","big_five_max","decision_style","mbti_label"], "default_limit": 20, "max_limit": 100}', NULL);

INSERT INTO products (slug, name, description, recipe_id, price_model, status) VALUES
('personality-profile-library', 'Personality Profile Library', 'A library of detailed Big Five personality profiles.', (SELECT id FROM recipes LIMIT 1), '{"type": "flat", "amount_usdc": 0.01}', 'live');
