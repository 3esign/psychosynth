-- Product #4: Cognitive Bias Simulator

INSERT INTO recipes (query_rules, composition_rules) VALUES
('{"entity": "bias", "filters": {}, "allow_request_filters": ["slug"]}', NULL);

INSERT INTO products (slug, name, description, recipe_id, price_model, status) VALUES
('cognitive-bias-simulator', 'Cognitive Bias Simulator', 'Detailed models of 20 cognitive biases along with simulation data for agent integration.', (SELECT id FROM recipes ORDER BY id DESC LIMIT 1), '{"type": "flat", "amount_usdc": 0.02}', 'live');
