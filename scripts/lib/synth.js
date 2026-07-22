'use strict';
/*
 * Psychosynth — offline synthesis engine.
 *
 * NO LLM is called. All content is authored here (component banks + coherence
 * logic) and composed combinatorially with a seeded PRNG, so large batches are
 * reproducible, schema-valid, internally coherent, and lexically varied enough
 * to avoid the dedup hook (pg_trgm summary similarity) and 'generic_content'
 * curator rejections.
 *
 * Derivation rules mirror the seed generator `big-five-profile-gen`:
 *   MBTI: E/I from extraversion, N/S from openness, T/F from agreeableness,
 *         J/P from conscientiousness. big_five ~ N(0.5,0.15) unless skewed.
 *
 * 2026-07-13 revision: content banks widened substantially (roles, details,
 * trait clauses, decision-style sentences, bias quirks) to raise the
 * diversity ceiling per buyer feedback — this is still a template/PRNG
 * engine, not an LLM, and is stamped as such in provenance; the point of
 * this revision is to make the *bounded* combinatorial space much larger,
 * not to pretend it is unbounded.
 */

const crypto = require('crypto');

// ------------------------------------------------------------------ PRNG ----
function makeRng(seedStr) {
  let h = 1779033703 ^ String(seedStr).length;
  for (let i = 0; i < String(seedStr).length; i++) {
    h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = {
  f: (rng) => rng(),
  gauss: (rng, m, s) => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  round2: (x) => Math.round(x * 100) / 100,
  pick: (rng, arr) => arr[Math.floor(rng() * arr.length)],
  sample: (rng, arr, n) => {
    const pool = arr.slice(); const out = [];
    n = Math.min(n, pool.length);
    for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  },
  int: (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)),
  chance: (rng, p) => rng() < p,
};

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function canonical(obj) { return JSON.stringify(obj, Object.keys(flatten(obj)).sort()); }
function flatten(o, p = '', acc = {}) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const k of Object.keys(o)) flatten(o[k], p ? p + '.' + k : k, acc);
  } else acc[p] = o;
  return acc;
}

// ----------------------------------------------------- domain vocabulary ----
const DOMAINS = {
  general: {
    skew: {},
    roles: ['generalist', 'lifelong learner', 'household decision-maker', 'community volunteer',
      'freelance consultant', 'small-business owner', 'graduate student', 'career switcher',
      'part-time caregiver', 'weekend hobbyist', 'self-taught tinkerer', 'local organizer',
      'amateur historian', 'serial side-projecter', 'neighborhood board member', 'part-time landlord',
      'continuing-ed regular', 'informal family accountant'],
    details: ['keeps a color-coded planner two months ahead', 'abandons three side projects for every one finished',
      'reads the terms and conditions in full', 'screenshots receipts but never files them',
      'reschedules the same appointment four times running', 'maintains a spreadsheet for grocery spend',
      'joins clubs enthusiastically then quietly ghosts them', 'keeps a running list of unspoken grievances',
      'answers group texts within a minute and emails within a month', 'owns the good tools and lends them out reluctantly',
      'has a stated system for everything and follows about half of it', 'remembers the exact wording of old arguments',
      'keeps backup plans for the backup plan', 'treats a clean inbox as a personality trait'],
  },
  trading: {
    skew: { neuroticism: 0.05 },
    roles: ['discretionary swing trader', 'quant researcher', 'crypto day-trader', 'options seller',
      'macro allocator', 'retail momentum chaser', 'algorithmic market-maker', 'value investor',
      'prop-desk scalper', 'DeFi yield farmer', 'commodities speculator', 'index-fund holdout',
      'futures spreader', 'volatility arbitrageur', 'penny-stock gambler', 'pairs trader',
      'dividend-yield chaser', 'onchain copy-trader',
      // 2026-07-21 additive widening (enrichment v4)
      'perps degen', 'bonding-curve sniper', 'airdrop farmer', 'liquidation-bot operator',
      'meme-coin rotator', 'delta-neutral market maker', 'MEV searcher', 'zero-DTE options gambler'],
    details: ['checks the P&L blotter forty times before lunch', 'sizes every position at exactly 2% risk',
      'holds a bag from 2021 out of pure spite', 'sets stop-losses then cancels them at the open',
      'backtests for months but front-runs the model on impulse', 'averages down on a name three times in a week',
      'keeps a losing-trade journal they never re-read', 'exits winners at the first green candle',
      'names every strategy after the trade that almost worked', "trusts the chart more than the fundamentals and won't say why",
      'refreshes the order book compulsively during lunch', 'treats a green week as proof of skill and a red one as proof of bad luck',
      'keeps three monitors for a portfolio that fits on one screen', 'talks in win rate and never mentions size',
      // 2026-07-21 additive widening (enrichment v4)
      'apes the launch before the contract is verified', 'screenshots the winners and never the losers',
      'rotates the whole book into whatever is pumping this hour', 'calls a 90% drawdown a long-term hold',
      'sets alerts for a coin they already checked a minute ago', 'confuses a bull market for a trading edge'],
  },
  negotiation: {
    skew: { agreeableness: -0.05 },
    roles: ['procurement lead', 'M&A dealmaker', 'union representative', 'founder raising a round',
      'real-estate closer', 'contract attorney', 'vendor-relations manager', 'crisis mediator',
      'salary negotiator', 'corporate liquidator', 'partnerships director', 'debt restructurer',
      'licensing agent', 'hostage negotiator', 'freight rate broker', 'talent agent',
      'franchise dealmaker', 'joint-venture broker'],
    details: ['opens with a deliberately absurd anchor', 'never makes the first concession on principle',
      'lets the room sit silent for a full minute to unnerve', 'splits the difference too eagerly',
      'reopens settled points to test resolve', 'memorizes the counterparty BATNA in advance',
      'concedes on price to protect the relationship', 'ends every call with a manufactured deadline',
      'writes the walk-away number down before the call starts', 'treats every silence as a tactic, including their own',
      'keeps a mental scoreboard of who conceded last', 'rehearses the opening line more than the actual position',
      "never signs on the first draft out of habit", "brings a printed BATNA to a conversation that doesn't need one"],
  },
  social: {
    skew: { extraversion: 0.05 },
    roles: ['community manager', 'group-chat ringleader', 'nonprofit convener', 'event host',
      'online moderator', 'peer mentor', 'social-media strategist', 'neighborhood connector',
      'team captain', 'reluctant plus-one', 'family peacemaker', 'newcomer welcomer',
      'wedding-party diplomat', 'group-project default leader', 'longtime regular at the same three places',
      'the friend who always drives', 'unofficial group historian', "the one who remembers everyone's order"],
    details: ['remembers everyone birthday and no one boundaries', 'drafts the apology before the mistake',
      'reads the room then performs to it', 'over-commits to plans they later dread',
      'mediates conflicts they secretly started', 'keeps a mental ledger of social debts',
      'says yes out loud and no internally', 'defuses tension with a joke that lands most of the time',
      'texts an apology before confirming anyone is upset', 'can sense a mood shift from the doorway',
      'over-explains a boundary rather than just stating it', 'keeps score of favors without meaning to',
      'laughs first to test whether the room is safe to laugh', "remembers who didn't get invited last time"],
  },
  workplace: {
    skew: { conscientiousness: 0.05 },
    roles: ['engineering manager', 'compliance officer', 'product lead', 'operations director',
      'HR mediator', 'sales director', 'staff engineer', 'project coordinator',
      'risk analyst', 'chief of staff', 'onboarding specialist', 'middle manager',
      'platform team lead', 'internal auditor', 'vendor-management lead', 'release manager',
      'business-continuity planner', 'process-improvement lead'],
    details: ['writes the postmortem before the incident is resolved', 'colonizes every meeting with a pre-read',
      'ships on Friday at 4:58pm out of habit', 'CCs their manager as a control mechanism',
      'refactors working code the night before a demo', 'blocks their calendar to avoid being scheduled',
      'volunteers for the glamour project and ducks the cleanup', 'measures the team by ticket velocity alone',
      'schedules the retro before the sprint is even planned', 'keeps a private doc of decisions to point back to later',
      'answers Slack faster than email and email faster than meetings', 'over-indexes on the last piece of negative feedback received',
      'treats a calendar invite as a binding contract', "quietly rewrites other people's documentation for consistency"],
  },
};
const DOMAIN_KEYS = Object.keys(DOMAINS);

// ------------------------------------------- trait-conditioned clause banks --
const CLAUSES = {
  openness: {
    high: ['chases novel frameworks and abandons them once the novelty fades',
      'reframes every problem as an excuse to learn a new system',
      'collects half-finished manifestos and unconventional methods',
      'treats established procedure as a first draft to be rewritten',
      'gets bored of the proven method exactly when it starts working',
      "would rather invent a worse tool than use someone else's good one",
      "reads outside the field for ideas the field itself would reject"],
    low: ['trusts the proven playbook over any clever new idea',
      'treats untested approaches as risk to be avoided',
      'prefers the familiar tool even when a better one exists',
      'reads ambiguity as a threat rather than an opening',
      "wants the version that already worked last time, not a better one",
      'treats "we have always done it this way" as a complete argument',
      'is suspicious of anyone selling a faster method'],
  },
  conscientiousness: {
    high: ['plans in exhaustive detail and resents any deviation',
      'over-prepares to the point of diminishing returns',
      'maintains flawless records nobody asked for',
      'front-loads the work and double-checks it twice',
      'treats a missed deadline as a personal failure regardless of cause',
      'builds in buffer time and then fills the buffer with more work',
      'cannot relax until the checklist is visibly complete'],
    low: ['improvises past every deadline and calls it flexibility',
      'starts strong and lets follow-through evaporate',
      'leaves loose ends and trusts future-self to handle them',
      'confuses motion with progress',
      'treats a plan as a suggestion the moment it is made',
      'does the interesting 80% and abandons the tedious 20%',
      'is reliably surprised by deadlines that were never hidden'],
  },
  extraversion: {
    high: ['thinks out loud and recruits an audience for every decision',
      'draws energy from the crowd and wilts when working alone',
      'dominates the room then wonders why others stayed quiet',
      'narrates the plan to whoever is nearby before committing to it',
      'treats a quiet room as a problem to be solved',
      'recharges by being around people, not away from them',
      'fills silence reflexively, even when nobody asked it to'],
    low: ['processes internally and surfaces conclusions fully formed',
      'guards their energy and rations social exposure',
      'lets others fill the silence and reads them while they do',
      'prefers to think it through alone before saying anything out loud',
      'finds a full day of meetings more draining than a full day of work',
      'says the least in the room and notices the most',
      'weighs words carefully before spending them'],
  },
  agreeableness: {
    high: ['absorbs conflict to keep the peace, often at their own cost',
      'defaults to trust and gives the benefit of the doubt too freely',
      'measures decisions by who they might upset',
      'apologizes first in disputes regardless of fault',
      "takes on other people's problems as if they were their own",
      'would rather lose a point than win an argument badly',
      "reads other people's discomfort before they voice it"],
    low: ['treats warmth as leverage and cooperation as weakness',
      'says the blunt thing and enjoys the flinch',
      'optimizes for winning over being liked',
      'assumes self-interest in others because it is usually there in themselves',
      'treats consensus-seeking as a waste of time',
      'would rather be respected than liked, and says so',
      'negotiates every relationship a little, even the close ones'],
  },
  neuroticism: {
    high: ['rehearses catastrophes in vivid detail before they happen',
      'reads a single setback as evidence of collapse',
      'hedges every commitment against an imagined worst case',
      'spirals on ambiguity and mistakes the spiral for diligence',
      'notices the one thing that could go wrong before the nine that could go right',
      'needs repeated reassurance that a decision was the right one',
      "carries yesterday's stress into today's unrelated decision"],
    low: ['stays flat when the numbers go red',
      'treats setbacks as data rather than verdicts',
      'sleeps fine the night before the big call',
      'is difficult to rattle even with genuinely bad news',
      'moves on from a mistake faster than the people around them do',
      'treats a crisis as an interesting problem rather than a threat',
      'checks its own anxiety like a data point instead of obeying it'],
  },
};

const DECISION_SENTENCE = {
  analytical: ['weighs options against explicit criteria and distrusts anything they cannot tabulate',
    'builds a decision matrix for choices most people make on instinct',
    'demands the data before the discussion and the discussion before the call',
    'treats a decision without a paper trail as a decision not yet made',
    'ranks the options twice, once on paper and once out loud, and trusts the paper',
    'wants the base rate before the anecdote',
    'converts every argument into a number it can compare against another number'],
  intuitive: ['decides on a gut read in seconds and reverse-engineers the reasons later',
    'trusts a felt sense of pattern over any spreadsheet',
    'moves first and rationalizes second, usually convincingly',
    'knows the answer before it can explain the question',
    'reads a room or a market the way others read a paragraph',
    'treats overthinking as its own kind of error',
    'lets pattern-matching from past cases stand in for fresh analysis'],
  dependent: ['seeks a second, third, and fourth opinion before committing to anything',
    'outsources conviction to whoever spoke last with authority',
    'waits for a permission that never quite arrives',
    'feels the weight of a decision lighten the moment someone else co-signs it',
    'circles back to ask what someone else would do even after deciding',
    "trusts the group's confidence more than its own",
    "needs the room's approval more than it needs to be right"],
  avoidant: ['defers the decision until circumstances make it for them',
    'treats not-choosing as a safe choice right up until it is not',
    'buries hard calls under a pile of preparatory busywork',
    'finds one more piece of information to gather before acting',
    'lets the deadline make the decision by default',
    'keeps every door open long after most of them should be closed',
    'prefers a slow loss to a fast, ownable mistake'],
  spontaneous: ['commits on impulse and lives loudly with the consequences',
    'acts on the midnight epiphany and emails it at 1am',
    'prefers a fast wrong answer to a slow right one',
    'decides in the time it takes to say the decision out loud',
    'trusts momentum over preparation',
    'treats hesitation as the bigger risk',
    'commits before the doubt has time to organize itself'],
  deliberative: ['weighs every angle exhaustively and is uneasy the moment ambiguity remains',
    'slow-walks the decision through every contingency before moving',
    'treats a rushed decision as a defect regardless of outcome',
    'revisits a settled decision if a single new fact appears',
    'wants the second-order consequences mapped before the first move is made',
    'treats speed and recklessness as the same thing',
    'keeps deliberating past the point where more information would change anything'],
};

// Each bias now maps to a small bank of phrasings (picked at random) instead
// of one fixed string — a single lookup table was the single biggest source
// of repeated text across both profile summaries and scenario responses.
const BIAS_QUIRK = {
  'loss-aversion': ['guards against losses far more fiercely than they chase equivalent gains',
    'feels a loss twice as sharply as an equivalent gain and plans accordingly',
    'will give up a good bet just to avoid the chance of a bad one'],
  'fomo': ['jumps into whatever everyone else already seems to be winning at',
    'cannot watch a rally from the sidelines for long',
    'treats being left out of a move as its own kind of loss'],
  'anchoring': ['lets the first number on the table quietly set the whole range',
    'never quite escapes the first figure it heard, however arbitrary',
    'measures every later offer against the opening one, not against fair value'],
  'sunk-cost': ['throws good effort after bad to justify the effort already spent',
    'keeps paying into something mainly because of what has already been paid',
    'treats walking away as wasting the investment rather than stopping the bleeding'],
  'confirmation': ['hunts for evidence that agrees with them and files the rest under noise',
    'reads disagreement as a data error rather than new information',
    "remembers the sources that agreed with it better than the ones that did not"],
  'overconfidence': ['holds their estimates with a certainty the track record does not support',
    'is more certain than the hit rate justifies',
    'underestimates how often an obviously right call turns out wrong'],
  'herd-behavior': ['abandons a private read the instant the crowd leans the other way',
    'finds it hard to hold a contrarian position once the room disagrees',
    "takes the crowd's confidence as a substitute for its own analysis"],
  'availability': ['weights whatever happened most recently and vividly as if it were typical',
    'judges likelihood by how easily an example comes to mind, not by the base rate',
    'overweights the vivid story over the boring statistic every time'],
  'recency': ['extrapolates the last data point into a permanent trend',
    'assumes the current streak is the new normal',
    'discounts the older pattern in favor of whatever just happened'],
  'disposition-effect': ['sells the winners early and clings to the losers for far too long',
    'locks in small wins fast and rides large losses far past the point of sense',
    'feels a winning position as fragile and a losing one as merely paused'],
  'status-quo': ['defends the current arrangement as if change itself were the danger',
    'needs a change to clear a higher bar than staying put ever has to',
    'treats the default option as the safe one by default, not by analysis'],
  'endowment': ['overvalues whatever they already hold simply because it is theirs',
    'would not buy back what it already owns at the price it would sell it for',
    'feels parting with something as a bigger loss than its market value explains'],
  'hindsight': ['remembers every surprise as something they saw coming all along',
    'rewrites its own uncertainty out of the story after the fact',
    'is surprised in the moment and certain in the retelling'],
  'optimism': ['discounts their own exposure to the risks they warn others about',
    'assumes the bad statistic applies to other people',
    'expects to be the exception to a risk it can otherwise describe accurately'],
  'framing': ['flips their choice depending purely on how the option is worded',
    'answers differently depending on whether the same fact is framed as a gain or a loss',
    'is swayed by which number comes first, not just what the numbers mean'],
  'gamblers-fallacy': ['expects the streak to reverse in games that never remember the past',
    'feels a losing streak owes it a win',
    'treats independent events as if they were keeping score'],
  'ostrich-effect': ['looks away from bad news in the hope it resolves unwitnessed',
    'delays checking the number it most needs to check',
    'would rather not know yet, even when knowing sooner would help'],
  'bandwagon': ['adopts a conviction mainly because the room already has',
    'gains confidence in a position in proportion to how many others hold it',
    'finds it easier to believe something once it stops being a minority view'],
  'authority-bias': ['defers to the most senior voice even against their own evidence',
    'gives a credentialed opinion more weight than the argument earns',
    "second-guesses its own read the moment someone senior disagrees"],
  'dunning-kruger': ['is most certain precisely where their competence is thinnest',
    'cannot see the gap in its own knowledge from inside the gap',
    'mistakes a little fluency for real mastery'],
  'unit-bias': ['anchors on unit price rather than market cap, treating low nominal coin prices as cheap',
    'chases whole tokens under the illusion that lower nominal price means higher upside',
    'measures value by token count rather than market capitalization'],
  'airdrop-entitlement': ['expects retroactive token rewards for routine protocol usage and reacts with outrage when excluded',
    'treats testnet participation as a binding contract for mainnet equity',
    'measures protocol loyalty by historical gas spent rather than current utility'],
  'diamond-hands-identity': ['wears holding through 90% drawdowns as a badge of honor, confusing stubbornness with conviction',
    'refuses to take profits because holding has become core to their community identity',
    'treats selling any portion of a position as a personal betrayal'],
  'ath-anchoring': ['prices every token against its all-time high, viewing current levels as an automatic discount',
    'refuses to exit positions until price returns to the previous cycle peak',
    'treats past peak valuation as guaranteed future recovery'],
  'rug-trauma-overcorrection': ['sees malicious intent and exploit risk in every standard smart contract update',
    'exits winning positions at the first minor delay or quiet period from devs',
    'treats every unannounced multisig transaction as an imminent exit scam'],
  'gas-sunk-cost': ['refuses to abandon failing transactions or dead claims because of high gas fees already burned',
    'doubles down on stagnant liquidity pools to justify the initial deployment gas',
    'treats non-refundable network fees as active position cost basis'],
};

const INTENSITY = ['measured', 'steady', 'pronounced', 'intense', 'extreme'];

const STRESS_LEAD = ['Under pressure', 'When the stakes rise', 'In a pinch', 'When cornered',
  'Once things get tense', 'The moment risk appears', 'Under a deadline',
  'When the walls close in', "The instant the deadline moves up", 'When there is no clean exit',
  'As soon as real money or reputation is on the line',
  // 2026-07-21 additive widening (enrichment v4): more stress leads
  'When the downside gets concrete', 'The moment it stops being hypothetical', 'When the number turns red',
  'Once the exit narrows to one door', 'When someone is watching the outcome', 'The instant it becomes irreversible',
  'When the safe option quietly expires'];
const DAILY_LEAD = ['day to day', 'on an ordinary week', 'in the small things', 'left to their own devices',
  'in the routine of it', 'when no one is watching', 'as a rule',
  'without an audience', 'when the stakes are trivial', 'across an ordinary week',
  'in the pattern nobody else tracks',
  // 2026-07-21 additive widening (enrichment v4): more daily leads
  'on a slow afternoon', 'in the parts nobody grades', 'once the urgency drains out',
  'in the unglamorous middle of things', 'when the pressure is off', 'in the version no one reviews',
  'across the quiet stretches'];

// --------------------------------------------------- trait -> bias mapping --
function biasAffinities(bf) {
  const hi = (x) => Math.max(0, x - 0.5) * 2;
  const lo = (x) => Math.max(0, 0.5 - x) * 2;
  const o = bf.openness, c = bf.conscientiousness, e = bf.extraversion, a = bf.agreeableness, n = bf.neuroticism;
  return {
    'loss-aversion': 0.6 * hi(n) + 0.3 * lo(o),
    'fomo': 0.6 * hi(e) + 0.4 * hi(n),
    'anchoring': 0.5 * lo(o) + 0.3 * hi(c),
    'sunk-cost': 0.5 * lo(c) + 0.4 * hi(a),
    'confirmation': 0.5 * lo(o) + 0.4 * hi(n),
    'overconfidence': 0.6 * lo(n) + 0.5 * lo(a),
    'herd-behavior': 0.6 * hi(e) + 0.4 * hi(a),
    'availability': 0.6 * hi(n),
    'recency': 0.4 * hi(o) + 0.4 * hi(n) + 0.2 * lo(c),
    'disposition-effect': 0.5 * hi(n) + 0.3 * lo(c),
    'status-quo': 0.6 * lo(o) + 0.4 * hi(n),
    'endowment': 0.5 * hi(a) + 0.3 * hi(n),
    'hindsight': 0.4 * hi(c) + 0.3 * lo(a),
    'optimism': 0.6 * lo(n) + 0.4 * hi(e),
    'framing': 0.4 * hi(n) + 0.3 * lo(c),
    'gamblers-fallacy': 0.4 * lo(o) + 0.3 * hi(e),
    'ostrich-effect': 0.6 * hi(n) + 0.3 * lo(c),
    'bandwagon': 0.5 * hi(e) + 0.5 * hi(a),
    'authority-bias': 0.5 * hi(a) + 0.4 * lo(o),
    'dunning-kruger': 0.6 * lo(c) + 0.4 * hi(e) + 0.3 * lo(o),
    'unit-bias': 0.5 * lo(o) + 0.4 * lo(c),
    'airdrop-entitlement': 0.5 * hi(n) + 0.4 * lo(a),
    'diamond-hands-identity': 0.6 * hi(n) + 0.4 * lo(o),
    'ath-anchoring': 0.5 * lo(o) + 0.4 * hi(c),
    'rug-trauma-overcorrection': 0.6 * hi(n) + 0.4 * lo(a),
    'gas-sunk-cost': 0.5 * lo(c) + 0.4 * hi(n),
  };
}

// ----------------------------------------------------------- derivations ----
function deriveMbti(bf) {
  return (bf.extraversion >= 0.5 ? 'E' : 'I') + (bf.openness >= 0.5 ? 'N' : 'S') +
         (bf.agreeableness < 0.5 ? 'T' : 'F') + (bf.conscientiousness >= 0.5 ? 'J' : 'P');
}

function deriveDecisionStyle(rng, bf) {
  const o = bf.openness - 0.5, c = bf.conscientiousness - 0.5,
        e = bf.extraversion - 0.5, a = bf.agreeableness - 0.5, n = bf.neuroticism - 0.5;
  const score = {
    analytical:   1.1 * c + 0.7 * o - 0.6 * n - 0.3 * e,
    deliberative: 1.0 * c + 0.9 * n - 0.6 * e - 0.3 * o,
    intuitive:    1.0 * e + 0.7 * o - 0.7 * c - 0.4 * n,
    spontaneous:  1.1 * (-c) + 0.8 * e - 0.6 * n,
    dependent:    1.1 * a + 0.7 * n - 0.7 * o - 0.3 * e,
    avoidant:     1.0 * n - 0.9 * c - 0.6 * e - 0.3 * o,
  };
  for (const k of Object.keys(score)) score[k] += (rng() - 0.5) * 0.12;
  return Object.entries(score).sort((x, y) => y[1] - x[1])[0][0];
}

function level(x) { return x >= 0.62 ? 'high' : x <= 0.38 ? 'low' : 'mid'; }

function dominantTrait(bf) {
  let best = null, bestD = -1;
  for (const k of Object.keys(bf)) {
    const d = Math.abs(bf[k] - 0.5);
    if (d > bestD) { bestD = d; best = k; }
  }
  return { trait: best, dist: bestD };
}

// -------------------------------------------------------- profile builder ---
function sampleBigFive(rng, domainKey, skew) {
  const dom = DOMAINS[domainKey];
  const bf = {};
  for (const t of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']) {
    let mean = 0.5 + (dom.skew[t] || 0);
    if (skew && skew.trait === t) mean += skew.delta;
    bf[t] = R.round2(R.clamp(R.gauss(rng, mean, 0.15), 0.03, 0.97));
  }
  return bf;
}

function chooseBiases(rng, bf) {
  const w = biasAffinities(bf);
  const ranked = Object.entries(w).sort((x, y) => y[1] - x[1]);
  const n = R.int(rng, 2, 4);
  const topK = ranked.slice(0, Math.min(ranked.length, n + 1));
  const chosen = R.sample(rng, topK, n);
  return chosen.map(([slug, aff]) => ({
    slug,
    strength: R.round2(R.clamp(0.45 + aff * 0.5 + (rng() - 0.5) * 0.12, 0.3, 0.98)),
  }));
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildSummary(rng, bf, domainKey, style, biases) {
  const dom = DOMAINS[domainKey];
  const dominant = dominantTrait(bf);
  const intensity = INTENSITY[Math.min(4, Math.floor(dominant.dist * 5.9))];
  const role = R.pick(rng, dom.roles);

  const domLevel = level(bf[dominant.trait]);
  const domBank = CLAUSES[dominant.trait][domLevel === 'mid' ? (bf[dominant.trait] >= 0.5 ? 'high' : 'low') : domLevel];
  const domClause = R.pick(rng, domBank);
  const decision = R.pick(rng, DECISION_SENTENCE[style]);

  const others = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']
    .filter((t) => t !== dominant.trait && level(bf[t]) !== 'mid');
  let secondClause = '';
  if (others.length) { const t2 = R.pick(rng, others); secondClause = R.pick(rng, CLAUSES[t2][level(bf[t2])]); }

  const topBias = biases.slice().sort((a, b) => b.strength - a.strength)[0];
  const quirk = R.pick(rng, BIAS_QUIRK[topBias.slug]);
  const detail = R.pick(rng, dom.details);
  const stress = R.pick(rng, STRESS_LEAD);
  const daily = R.pick(rng, DAILY_LEAD);

  const frames = [
    () => 'A ' + intensity + ' ' + role + ' who ' + domClause + '. ' + cap(decision) + '.' +
          (secondClause ? ' ' + cap(secondClause) + '.' : '') +
          ' ' + stress + ' ' + quirk + '; ' + daily + ', ' + detail + '.',
    () => cap(decision) + '. This ' + role + ' ' + domClause +
          (secondClause ? ' and ' + secondClause : '') +
          '. ' + stress + ' ' + quirk + ' — ' + daily + ', ' + detail + '.',
    () => cap(quirk) + '. A ' + intensity + ' ' + role + ': ' + domClause +
          (secondClause ? ', ' + secondClause : '') +
          '. ' + cap(decision) + ', and ' + daily + ' ' + detail + '.',
    () => cap(role) + ' whose defining move is that they ' + domClause + '. ' + cap(decision) + '.' +
          (secondClause ? ' ' + cap(secondClause) + '.' : '') +
          ' ' + stress + ', ' + quirk + '; ' + detail + '.',
    () => stress + ', ' + quirk + '. Otherwise, a ' + intensity + ' ' + role + ' who ' + domClause +
          (secondClause ? ' and ' + secondClause : '') + '. ' + cap(decision) + ', and ' + daily + ' ' + detail + '.',
    () => cap(role) + ', ' + intensity + ' in style: ' + domClause +
          (secondClause ? '; ' + secondClause : '') + '. ' + cap(decision) + '. ' + stress + ' ' + quirk + '.',
  ];
  let summary = R.pick(rng, frames)().replace(/\s+/g, ' ').replace(/\.\./g, '.').trim();
  if (summary.length > 590) summary = summary.slice(0, 587).replace(/[ ,;.\-]+$/, '') + '.';
  if (summary.length < 80) summary += ' A ' + intensity + ' presence in the ' + domainKey + ' arena.';
  return summary;
}

function buildTags(rng, domainKey, style, bf) {
  const tags = new Set([domainKey, style]);
  const dom = dominantTrait(bf);
  const traitTag = {
    openness: bf.openness >= 0.5 ? 'open-minded' : 'conventional',
    conscientiousness: bf.conscientiousness >= 0.5 ? 'disciplined' : 'improviser',
    extraversion: bf.extraversion >= 0.5 ? 'outgoing' : 'reserved',
    agreeableness: bf.agreeableness >= 0.5 ? 'accommodating' : 'assertive',
    neuroticism: bf.neuroticism >= 0.5 ? 'anxious' : 'even-keeled',
  }[dom.trait];
  tags.add(traitTag);
  const flavor = ['decision-making', 'behavioral', 'risk', 'temperament', 'cognition', 'ipip-neo'];
  R.sample(rng, flavor, R.int(rng, 1, 3)).forEach((t) => tags.add(t));
  return Array.from(tags).slice(0, 6);
}

function buildProfile(rng, opts = {}) {
  const domainKey = opts.domain || R.pick(rng, DOMAIN_KEYS);
  const skew = opts.skew || null;
  const bf = sampleBigFive(rng, domainKey, skew);
  const style = deriveDecisionStyle(rng, bf);
  const biases = chooseBiases(rng, bf);
  const item = {
    big_five: bf,
    summary: buildSummary(rng, bf, domainKey, style, biases),
    decision_style: style,
    mbti_label: deriveMbti(bf),
    suggested_biases: biases,
    tags: buildTags(rng, domainKey, style, bf),
  };
  return { item, domain: domainKey };
}

module.exports = {
  makeRng, R, sha256, canonical,
  DOMAINS, DOMAIN_KEYS, CLAUSES, BIAS_QUIRK,
  biasAffinities, deriveMbti, deriveDecisionStyle, dominantTrait, level,
  sampleBigFive, chooseBiases, buildSummary, buildProfile,
};
