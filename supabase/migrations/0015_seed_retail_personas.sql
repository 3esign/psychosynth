-- Zero-inference starter data for the Robinhood Counterparty Pack (Product #2).
--
-- Normally profiles come from an LLM generator run (which costs inference). So
-- the pack is sellable WITHOUT paying for any inference yet, these 10 retail
-- trader personas are hand-authored and inserted directly, pre-approved, and
-- tagged 'trading' / 'retail-trading' / 'robinhood' so the pack's server-pinned
-- tag filter serves them immediately. Generate more later (real or mock
-- provider) to grow the pack; these are the seed floor.
--
-- Each carries Big Five + prospect-theory posture (lambda/alpha/beta) +
-- cognitive-reflection, so the pack's lambda/trait/style filters all work.
-- Synthetic, illustrative — not real users.

INSERT INTO profiles (content, big_five, mbti_label, decision_style, summary, tags, status, quality_score) VALUES
(
 '{"big_five":{"openness":0.45,"conscientiousness":0.35,"extraversion":0.40,"agreeableness":0.55,"neuroticism":0.82},"prospect_theory":{"lambda":2.8,"alpha":0.85,"beta":0.9},"cognitive_reflection":{"system_preference":"system1","crt_score":0.2},"summary":"Sells hard into any sharp drawdown, converting paper losses into realized ones at the worst moment. Checks the portfolio compulsively and avoids looking when it is red.","decision_style":"avoidant","mbti_label":"ISFP","suggested_biases":[{"slug":"loss-aversion","strength":0.85},{"slug":"ostrich-effect","strength":0.6}],"tags":["trading","retail-trading","robinhood","panic-seller","high-neuroticism"]}',
 '{"openness":0.45,"conscientiousness":0.35,"extraversion":0.40,"agreeableness":0.55,"neuroticism":0.82}',
 'ISFP','avoidant',
 'Sells hard into any sharp drawdown, converting paper losses into realized ones at the worst moment. Checks the portfolio compulsively and avoids looking when it is red.',
 ARRAY['trading','retail-trading','robinhood','panic-seller','high-neuroticism'],'approved',0.82
),
(
 '{"big_five":{"openness":0.60,"conscientiousness":0.55,"extraversion":0.50,"agreeableness":0.50,"neuroticism":0.55},"prospect_theory":{"lambda":2.0,"alpha":0.88,"beta":0.88},"cognitive_reflection":{"system_preference":"system2","crt_score":0.6},"summary":"Buys pullbacks methodically against a reference price, but anchors to the recent high and holds losers too long waiting to get back to breakeven.","decision_style":"analytical","mbti_label":"INTP","suggested_biases":[{"slug":"anchoring","strength":0.7},{"slug":"disposition-effect","strength":0.65}],"tags":["trading","retail-trading","robinhood","dip-buyer"]}',
 '{"openness":0.60,"conscientiousness":0.55,"extraversion":0.50,"agreeableness":0.50,"neuroticism":0.55}',
 'INTP','analytical',
 'Buys pullbacks methodically against a reference price, but anchors to the recent high and holds losers too long waiting to get back to breakeven.',
 ARRAY['trading','retail-trading','robinhood','dip-buyer'],'approved',0.84
),
(
 '{"big_five":{"openness":0.85,"conscientiousness":0.30,"extraversion":0.75,"agreeableness":0.45,"neuroticism":0.60},"prospect_theory":{"lambda":1.4,"alpha":0.95,"beta":0.75},"cognitive_reflection":{"system_preference":"system1","crt_score":0.1},"summary":"Chases whatever is trending on social feeds, sizing up into parabolic moves and entering late. Thrives on the excitement more than the thesis.","decision_style":"spontaneous","mbti_label":"ENFP","suggested_biases":[{"slug":"fomo","strength":0.9},{"slug":"herd-behavior","strength":0.75}],"tags":["trading","retail-trading","robinhood","meme-chaser","high-openness"]}',
 '{"openness":0.85,"conscientiousness":0.30,"extraversion":0.75,"agreeableness":0.45,"neuroticism":0.60}',
 'ENFP','spontaneous',
 'Chases whatever is trending on social feeds, sizing up into parabolic moves and entering late. Thrives on the excitement more than the thesis.',
 ARRAY['trading','retail-trading','robinhood','meme-chaser','high-openness'],'approved',0.83
),
(
 '{"big_five":{"openness":0.40,"conscientiousness":0.80,"extraversion":0.35,"agreeableness":0.60,"neuroticism":0.30},"prospect_theory":{"lambda":2.2,"alpha":0.82,"beta":0.9},"cognitive_reflection":{"system_preference":"system2","crt_score":0.8},"summary":"Buys quality and holds through volatility, rarely trading. Prefers the current allocation and is reluctant to rebalance even when it would help.","decision_style":"deliberative","mbti_label":"ISTJ","suggested_biases":[{"slug":"status-quo","strength":0.7},{"slug":"endowment","strength":0.6}],"tags":["trading","retail-trading","robinhood","conservative-hodler","high-conscientiousness"]}',
 '{"openness":0.40,"conscientiousness":0.80,"extraversion":0.35,"agreeableness":0.60,"neuroticism":0.30}',
 'ISTJ','deliberative',
 'Buys quality and holds through volatility, rarely trading. Prefers the current allocation and is reluctant to rebalance even when it would help.',
 ARRAY['trading','retail-trading','robinhood','conservative-hodler','high-conscientiousness'],'approved',0.85
),
(
 '{"big_five":{"openness":0.80,"conscientiousness":0.35,"extraversion":0.70,"agreeableness":0.35,"neuroticism":0.65},"prospect_theory":{"lambda":1.3,"alpha":0.97,"beta":0.7},"cognitive_reflection":{"system_preference":"system1","crt_score":0.3},"summary":"Trades short-dated options for the payoff, overestimates edge, and expects reversals after streaks. Confident and comfortable with large swings.","decision_style":"spontaneous","mbti_label":"ENTP","suggested_biases":[{"slug":"overconfidence","strength":0.85},{"slug":"gamblers-fallacy","strength":0.6}],"tags":["trading","retail-trading","robinhood","options-gambler"]}',
 '{"openness":0.80,"conscientiousness":0.35,"extraversion":0.70,"agreeableness":0.35,"neuroticism":0.65}',
 'ENTP','spontaneous',
 'Trades short-dated options for the payoff, overestimates edge, and expects reversals after streaks. Confident and comfortable with large swings.',
 ARRAY['trading','retail-trading','robinhood','options-gambler'],'approved',0.82
),
(
 '{"big_five":{"openness":0.55,"conscientiousness":0.30,"extraversion":0.60,"agreeableness":0.40,"neuroticism":0.78},"prospect_theory":{"lambda":2.6,"alpha":0.9,"beta":0.92},"cognitive_reflection":{"system_preference":"system1","crt_score":0.2},"summary":"After a loss, sizes up the next trade to win it back, doubling down on losing positions to justify the original entry.","decision_style":"intuitive","mbti_label":"ESTP","suggested_biases":[{"slug":"loss-aversion","strength":0.8},{"slug":"sunk-cost","strength":0.75}],"tags":["trading","retail-trading","robinhood","revenge-trader","high-neuroticism"]}',
 '{"openness":0.55,"conscientiousness":0.30,"extraversion":0.60,"agreeableness":0.40,"neuroticism":0.78}',
 'ESTP','intuitive',
 'After a loss, sizes up the next trade to win it back, doubling down on losing positions to justify the original entry.',
 ARRAY['trading','retail-trading','robinhood','revenge-trader','high-neuroticism'],'approved',0.83
),
(
 '{"big_five":{"openness":0.70,"conscientiousness":0.40,"extraversion":0.80,"agreeableness":0.55,"neuroticism":0.62},"prospect_theory":{"lambda":1.6,"alpha":0.93,"beta":0.78},"cognitive_reflection":{"system_preference":"system1","crt_score":0.3},"summary":"Piles into whatever peers and influencers are buying, afraid to miss the move. Social proof outweighs independent analysis.","decision_style":"intuitive","mbti_label":"ESFP","suggested_biases":[{"slug":"fomo","strength":0.85},{"slug":"bandwagon","strength":0.7}],"tags":["trading","retail-trading","robinhood","fomo-chaser","high-extraversion"]}',
 '{"openness":0.70,"conscientiousness":0.40,"extraversion":0.80,"agreeableness":0.55,"neuroticism":0.62}',
 'ESFP','intuitive',
 'Piles into whatever peers and influencers are buying, afraid to miss the move. Social proof outweighs independent analysis.',
 ARRAY['trading','retail-trading','robinhood','fomo-chaser','high-extraversion'],'approved',0.82
),
(
 '{"big_five":{"openness":0.60,"conscientiousness":0.82,"extraversion":0.45,"agreeableness":0.50,"neuroticism":0.35},"prospect_theory":{"lambda":1.9,"alpha":0.86,"beta":0.85},"cognitive_reflection":{"system_preference":"system2","crt_score":0.85},"summary":"Runs a rules-based swing process with predefined stops and consistent sizing, though can over-weight evidence that confirms an existing thesis.","decision_style":"analytical","mbti_label":"INTJ","suggested_biases":[{"slug":"confirmation","strength":0.6},{"slug":"anchoring","strength":0.4}],"tags":["trading","retail-trading","robinhood","disciplined-swing","high-conscientiousness"]}',
 '{"openness":0.60,"conscientiousness":0.82,"extraversion":0.45,"agreeableness":0.50,"neuroticism":0.35}',
 'INTJ','analytical',
 'Runs a rules-based swing process with predefined stops and consistent sizing, though can over-weight evidence that confirms an existing thesis.',
 ARRAY['trading','retail-trading','robinhood','disciplined-swing','high-conscientiousness'],'approved',0.86
),
(
 '{"big_five":{"openness":0.50,"conscientiousness":0.55,"extraversion":0.45,"agreeableness":0.55,"neuroticism":0.58},"prospect_theory":{"lambda":2.1,"alpha":0.87,"beta":0.89},"cognitive_reflection":{"system_preference":"system2","crt_score":0.5},"summary":"Fixates on the entry price as fair value and refuses to sell below it, holding through deterioration and seeking advice before acting.","decision_style":"dependent","mbti_label":"ISFJ","suggested_biases":[{"slug":"anchoring","strength":0.75},{"slug":"sunk-cost","strength":0.6}],"tags":["trading","retail-trading","robinhood","anchoring-holder"]}',
 '{"openness":0.50,"conscientiousness":0.55,"extraversion":0.45,"agreeableness":0.55,"neuroticism":0.58}',
 'ISFJ','dependent',
 'Fixates on the entry price as fair value and refuses to sell below it, holding through deterioration and seeking advice before acting.',
 ARRAY['trading','retail-trading','robinhood','anchoring-holder'],'approved',0.81
),
(
 '{"big_five":{"openness":0.40,"conscientiousness":0.45,"extraversion":0.60,"agreeableness":0.70,"neuroticism":0.60},"prospect_theory":{"lambda":1.8,"alpha":0.9,"beta":0.82},"cognitive_reflection":{"system_preference":"system1","crt_score":0.25},"summary":"Follows the crowd and defers to loud authority figures, buying when sentiment is euphoric and selling when it sours, always a step behind.","decision_style":"dependent","mbti_label":"ESFJ","suggested_biases":[{"slug":"herd-behavior","strength":0.8},{"slug":"authority-bias","strength":0.65}],"tags":["trading","retail-trading","robinhood","herd-follower","high-agreeableness"]}',
 '{"openness":0.40,"conscientiousness":0.45,"extraversion":0.60,"agreeableness":0.70,"neuroticism":0.60}',
 'ESFJ','dependent',
 'Follows the crowd and defers to loud authority figures, buying when sentiment is euphoric and selling when it sours, always a step behind.',
 ARRAY['trading','retail-trading','robinhood','herd-follower','high-agreeableness'],'approved',0.81
);
