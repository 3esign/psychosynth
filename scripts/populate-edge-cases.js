const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const edgeCaseProfiles = [
  {
    big_five: { openness: 0.95, conscientiousness: 0.15, extraversion: 0.85, agreeableness: 0.30, neuroticism: 0.80 },
    mbti_label: "ENTP",
    decision_style: "spontaneous",
    summary: "A visionary but deeply unstable tech founder. Thrives on extreme chaos and pivots company strategy wildly based on fleeting midnight epiphanies. Highly charismatic in pitching but leaves behind a trail of operational disasters. Paralyzed by administrative details and deeply paranoid about being out-innovated by competitors.",
    suggested_biases: [{ slug: "optimism", strength: 0.95 }, { slug: "fomo", strength: 0.90 }, { slug: "recency", strength: 0.85 }],
    tags: ["workplace", "visionary", "chaotic", "startup"]
  },
  {
    big_five: { openness: 0.20, conscientiousness: 0.95, extraversion: 0.20, agreeableness: 0.90, neuroticism: 0.90 },
    mbti_label: "ISFJ",
    decision_style: "dependent",
    summary: "An ultra-compliant risk officer crippled by anxiety over regulatory breaches. Constantly seeks validation from external legal counsel before approving even minor procedural changes. Views any deviation from the status quo as a catastrophic threat. Maintains flawless records but absolutely refuses to make unilateral decisions.",
    suggested_biases: [{ slug: "status-quo", strength: 0.95 }, { slug: "loss-aversion", strength: 0.95 }, { slug: "authority-bias", strength: 0.80 }],
    tags: ["workplace", "compliance", "dependent", "anxious"]
  },
  {
    big_five: { openness: 0.90, conscientiousness: 0.85, extraversion: 0.10, agreeableness: 0.15, neuroticism: 0.20 },
    mbti_label: "INTJ",
    decision_style: "analytical",
    summary: "A misanthropic algorithmic trader who completely distrusts human intuition. Spends months rigorously backtesting quant models in total isolation. Treats market participants as entirely irrational noise to be exploited. Has zero empathy for retail losses, viewing the market strictly as a zero-sum mathematical equation.",
    suggested_biases: [{ slug: "anchoring", strength: 0.70 }, { slug: "overconfidence", strength: 0.60 }],
    tags: ["trading", "hft", "analytical", "isolated"]
  },
  {
    big_five: { openness: 0.60, conscientiousness: 0.30, extraversion: 0.95, agreeableness: 0.85, neuroticism: 0.85 },
    mbti_label: "ESFJ",
    decision_style: "intuitive",
    summary: "A highly reactive community manager whose decisions are entirely dictated by the immediate emotional temperature of the crowd. Panics at the first sign of social media backlash, issuing rapid, uncalculated apologies that often contradict company policy. Extremely warm and empathetic but dangerously susceptible to mob mentality.",
    suggested_biases: [{ slug: "bandwagon", strength: 0.95 }, { slug: "herd-behavior", strength: 0.90 }, { slug: "fomo", strength: 0.85 }],
    tags: ["social", "community", "reactive", "herd"]
  },
  {
    big_five: { openness: 0.40, conscientiousness: 0.95, extraversion: 0.85, agreeableness: 0.10, neuroticism: 0.15 },
    mbti_label: "ESTJ",
    decision_style: "deliberative",
    summary: "A hyper-aggressive corporate liquidator. Moves into failing companies and dismantles them with surgical precision and zero emotional attachment. Uses forceful, dominating negotiation tactics to extract maximum value from distressed assets. Views collaborative win-win scenarios as a sign of weakness.",
    suggested_biases: [{ slug: "anchoring", strength: 0.80 }, { slug: "overconfidence", strength: 0.85 }, { slug: "disposition-effect", strength: 0.40 }],
    tags: ["negotiation", "corporate", "aggressive", "deliberative"]
  },
  {
    big_five: { openness: 0.85, conscientiousness: 0.20, extraversion: 0.75, agreeableness: 0.95, neuroticism: 0.60 },
    mbti_label: "ENFP",
    decision_style: "spontaneous",
    summary: "A hopelessly optimistic retail investor who exclusively buys narrative-driven meme assets. Falls in love with charismatic founders and ignores all fundamental red flags. Refuses to sell losing positions because of an intense emotional attachment to the community. Often averages down on bankrupt companies in a misguided show of loyalty.",
    suggested_biases: [{ slug: "endowment", strength: 0.95 }, { slug: "confirmation", strength: 0.90 }, { slug: "sunk-cost", strength: 0.85 }],
    tags: ["trading", "retail", "emotional", "spontaneous"]
  },
  {
    big_five: { openness: 0.95, conscientiousness: 0.95, extraversion: 0.50, agreeableness: 0.40, neuroticism: 0.90 },
    mbti_label: "INTJ",
    decision_style: "avoidant",
    summary: "A brilliant but profoundly neurotic macro-economist. Builds incredibly complex forecasting models but is permanently terrified of a black swan event. Hoards cash and hedges every position multiple times, effectively paralyzing their own portfolio growth. Constantly revises predictions to account for apocalyptic, low-probability risks.",
    suggested_biases: [{ slug: "loss-aversion", strength: 1.00 }, { slug: "availability", strength: 0.90 }, { slug: "ostrich-effect", strength: 0.70 }],
    tags: ["trading", "macro", "anxious", "avoidant"]
  },
  {
    big_five: { openness: 0.10, conscientiousness: 0.80, extraversion: 0.90, agreeableness: 0.60, neuroticism: 0.30 },
    mbti_label: "ESTJ",
    decision_style: "analytical",
    summary: "A rigid, old-school sales director who manages exclusively by out-dated KPIs and sheer volume. Completely ignores modern digital strategies in favor of aggressive cold-calling. Punishes deviation from the script and enforces a highly adversarial, zero-sum culture on the sales floor. Succeeds through sheer persistence rather than strategy.",
    suggested_biases: [{ slug: "status-quo", strength: 0.90 }, { slug: "authority-bias", strength: 0.85 }, { slug: "anchoring", strength: 0.80 }],
    tags: ["workplace", "sales", "rigid", "analytical"]
  },
  {
    big_five: { openness: 0.70, conscientiousness: 0.40, extraversion: 0.30, agreeableness: 0.95, neuroticism: 0.85 },
    mbti_label: "INFP",
    decision_style: "dependent",
    summary: "A highly sensitive human resources mediator who absorbs the emotional trauma of the entire office. Completely incapable of delivering negative feedback or firing anyone, often taking the blame for structural failures to protect employees. Spends hours agonizing over the exact wording of emails to avoid causing any possible offense.",
    suggested_biases: [{ slug: "loss-aversion", strength: 0.80 }, { slug: "status-quo", strength: 0.75 }],
    tags: ["workplace", "hr", "sensitive", "dependent"]
  },
  {
    big_five: { openness: 0.95, conscientiousness: 0.90, extraversion: 0.80, agreeableness: 0.20, neuroticism: 0.40 },
    mbti_label: "ENTJ",
    decision_style: "deliberative",
    summary: "A ruthless, Machiavellian political strategist. Constructs long-term manipulation campaigns to outmaneuver rivals, viewing all social interactions as transactional pieces on a chessboard. Highly charming but entirely devoid of authentic empathy. Will meticulously ruin a competitor's reputation while smiling to their face.",
    suggested_biases: [{ slug: "overconfidence", strength: 0.95 }, { slug: "confirmation", strength: 0.80 }, { slug: "hindsight", strength: 0.75 }],
    tags: ["social", "strategy", "ruthless", "deliberative"]
  }
];

async function run() {
  console.log("Fetching active generator...");
  const { data: gen } = await supabase.from('generators').select('id, slug, version').eq('slug', 'big-five-profile-gen').eq('status', 'active').limit(1).single();
  const { data: biases } = await supabase.from('biases').select('id, slug');
  const biasMap = new Map(biases.map(b => [b.slug, b.id]));

  console.log("Creating run...");
  const { data: run } = await supabase.from('generation_runs').insert({
    generator_id: gen.id, generator_slug: gen.slug, generator_ver: gen.version,
    params: { count: edgeCaseProfiles.length, domain: "edge-cases" },
    model_used: "human/antigravity-deep-synthesis",
    items_requested: edgeCaseProfiles.length, items_created: edgeCaseProfiles.length,
    cost_usd: 0.0, status: "done"
  }).select().single();

  let inserted = 0;
  for (const p of edgeCaseProfiles) {
    const { data: profileRow } = await supabase.from('profiles').insert({
      content: p, big_five: p.big_five, mbti_label: p.mbti_label,
      decision_style: p.decision_style, summary: p.summary, tags: p.tags,
      status: 'approved', generation_run_id: run.id
    }).select('id').single();

    const profileId = profileRow.id;
    const links = p.suggested_biases.filter(b => biasMap.has(b.slug)).map(b => ({
      profile_id: profileId, bias_id: biasMap.get(b.slug),
      strength: b.strength, generation_run_id: run.id
    }));
    if (links.length > 0) await supabase.from('profile_bias_links').insert(links);

    await supabase.from('provenance').insert({
      entity_type: 'profile', entity_id: profileId, entity_version: 1,
      model: "human/antigravity-deep-synthesis",
      prompt_hash: sha256(`Edge case generation: ${p.tags.join(',')}`),
      template_hash: sha256(""), params: { temperature: 0.9 },
      sha256_content: sha256(JSON.stringify(p))
    });
    inserted++;
  }
  console.log(`Populated ${inserted} ultra high-fidelity edge cases!`);
}

run();
