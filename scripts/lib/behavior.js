'use strict';
/*
 * Offline synthesis for the L2 behavioral layer: scenarios, scenario<->bias
 * applications, expanded emotional patterns, and profile_scenario_responses.
 * No LLM. Content is authored (banks + coherence logic) and composed with a
 * seeded PRNG. Response text is derived from the profile's actual trait vector,
 * decision style, and top bias, so responses stay coherent with the profile.
 *
 * 2026-07-13 revision: scenario, reasoning, action, and emotional-arc banks
 * widened substantially. Previously `reasoning_chain` had exactly 6 possible
 * values system-wide (one fixed string per decision_style) and `emotional_arc`
 * had roughly 14 — both were flagged as a diversity/duplication risk for any
 * buyer inspecting column cardinality. `reasoning_chain` now composes a base
 * clause (6-7 per style) with a scenario-category-aware clause (a few per
 * category), and `emotional_arc` composes from expanded open/pattern/close
 * banks per neuroticism bucket — hundreds of distinct outputs instead of a
 * near-fixed lookup table. Still fundamentally template/PRNG output, not LLM
 * generation; the goal here is a much larger bounded space, not an unbounded
 * one.
 */

const S = require('./synth.js');
const R = S.R;

// ------------------------------------------------------------- scenarios ----
// Each template: title stem + a description body with concrete stakes.
const SCENARIOS = {
  trading: [
    ['Overnight gap-down', 'A core position gaps down {pct}% overnight on an unverified headline. Your stop was set at -10% but the market never printed there, and the open is minutes away.'],
    ['Parabolic breakout', 'A name you passed on is up {pct}% in three sessions and every feed is screaming about it. Sizing in now means chasing; sitting out means watching it run.'],
    ['Margin call at dawn', 'Leverage that felt comfortable last week just triggered a maintenance call. You can post more collateral, cut the position, or hope for a bounce before the desk liquidates you.'],
    ['Thesis invalidated', 'The catalyst you bought for just got confirmed — and the stock fell anyway. Your entire reason for holding is gone, but you are still up {pct}% and hate selling green.'],
    ['The bag from 2021', 'A position down {pct}% has been dead money for years. Tax-loss season is here. Cutting it admits the mistake; holding keeps the hope alive.'],
    ['Illiquid exit', 'You need out of a thinly traded name, but your own selling moves the price. Dumping fast eats slippage; scaling out risks the news breaking first.'],
    ['Insider whisper', 'A well-connected contact hints at a deal before it is public. Acting is an edge and a line; ignoring it may mean watching others profit.'],
    ['Drawdown streak', 'Six losing trades in a row. The system says keep sizing normally; every instinct says shrink, sit out, or double up to win it back.'],
    ['Correlated crash', 'Everything in the book is falling together, even the "uncorrelated" hedge. Diversification just failed at the exact moment it was supposed to work.'],
    ['Liquidity mirage', 'The book looked deep a minute ago; now every price you touch moves against you. What looked like an easy exit turns into cutting the whole position at once.'],
    ['Rate decision surprise', 'The central bank just did the opposite of what the market priced in. Every model in front of you is instantly stale, and the tape is moving faster than you can think.'],
    ['Founder tweet', "A single post from someone with no fiduciary duty to you just moved the price {pct}% in minutes. Trading the reaction means trading someone else's whim."],
    ['Broken correlation pair', 'The two assets you have paired for years just diverged for no reason your model can find. Is it a glitch, a regime change, or a mistake you have not spotted yet?'],
    ['Year-end rebalance squeeze', 'Forced institutional selling is dragging a fundamentally fine name down {pct}% into the close. It is either a gift or a warning you are not seeing.'],
    ['The revenge trade', 'You just took a bad loss on a similar setup an hour ago. This new signal looks identical — is it the same mistake or the redemption arc?'],
    ['Funding flip', 'The perpetual funding rate on your position just flipped hard against you. Holding now costs real money by the hour; closing locks a loss that might have been temporary.'],
    ['Airdrop lockup', 'A token you were airdropped unlocks today at {pct}% above your mental sell price — but everyone else unlocks today too, and the order book is already sagging.'],
    ['Backtest mirage', 'Live results are running badly behind the backtest that justified the strategy. Turning it off admits months were wasted; leaving it on burns money to defend a model.'],
    ['Oracle divergence', 'Two price feeds you rely on disagree by {pct}% during a fast move. One is stale, one is lying, and your liquidation logic listens to only one of them.'],
    ['Quiet delisting notice', 'An exchange quietly posts that a name you hold goes delisted in {days} days. Liquidity will only get worse from here, but the forced-seller discount is already brutal.'],
  ],
  negotiation: [
    ['Exploding offer', 'The counterparty puts a number on the table that expires in {hrs} hours — take it now or it is gone. It is below your target but above your floor.'],
    ['Absurd anchor', 'They open with a figure so far from reality it is almost insulting. Countering hard risks blowing up rapport; splitting the difference rewards the tactic.'],
    ['Reopened terms', 'A point you thought was settled gets pried back open at the eleventh hour. Conceding keeps the deal alive; refusing risks the whole thing collapsing.'],
    ['Relationship vs price', 'You can squeeze another {pct}% out of a long-time partner who clearly cannot afford it. The savings are real; so is the relationship.'],
    ['Silent counterpart', 'After your offer, the other side simply goes quiet and lets the silence stretch. Filling it usually means negotiating against yourself.'],
    ['Multiparty auction', "Three bidders, one asset, and a deadline. Bidding aggressively risks the winner's curse; playing it cool risks losing to a bolder rival."],
    ['Take it or leave it', 'The final term is framed as non-negotiable. You suspect there is room, but calling the bluff could end the talks entirely.'],
    ['The manufactured deadline', 'They insist a decision is needed by end of day for reasons that do not quite add up. Rushing favors them; stalling may cost you leverage.'],
    ['Good cop, bad cop', 'One side of the table is reasonable, the other is hostile, and you suspect it is a script. Playing along validates the tactic; calling it out risks the reasonable one too.'],
    ['The leaked number', "You now know, through a channel you should not have, roughly what the other side's ceiling is. Using it tips your hand about how you know; not using it wastes real leverage."],
    ['Walkaway bluff', 'They stand up to leave over a term that is not actually a dealbreaker for them, by your read. Calling the bluff risks losing a deal that was mostly done.'],
    ['Committee versus person', 'You have been negotiating in good faith with one person, and now a committee you have never met needs to approve it on different terms.'],
    ['The favor called in', 'Someone who helped you once is now on the other side of the table asking for a break because of it. The favor was real; so is the number you are leaving on it.'],
    ['Translation gap', 'A cultural or linguistic gap means you cannot tell if the last answer was a firm no or an opening. Pressing for clarity might itself read as rude.'],
    ['Public negotiation', 'The terms are being negotiated with a journalist or the internet watching in real time. Every concession becomes a headline before the deal is done.'],
    ['The nibble at signing', 'Everything is agreed, the pens are out, and they ask for one more small concession as a formality. It is tiny — and it is also the third such formality.'],
    ['Expiring authority', 'The person across the table loses signing authority at the end of the quarter, in {days} days. Their urgency is your leverage, or your trap.'],
    ['The generous first offer', 'Their opening number is better than your target. Either you badly misread the market, or they know something you do not. Accepting fast feels like leaving money; probing risks unsettling it.'],
    ['Two-front negotiation', 'You are negotiating the same terms with your own side and the counterparty at once, and the concessions each demands are mutually exclusive.'],
    ['The anchor you set', 'Your own aggressive opening from last month is now being quoted back to you, after circumstances turned. The anchor you planted is working perfectly — against you.'],
  ],
  social: [
    ['Public callout', 'Someone criticizes your decision in front of the whole group, and all eyes turn to you. Defending looks defensive; conceding looks weak.'],
    ['Credit theft', 'A colleague presents your idea as their own in a room that matters. Correcting it risks looking petty; staying silent cedes the win.'],
    ['The pile-on', 'A friend is being dogpiled in the group chat over something half-true. Speaking up draws fire; staying quiet feels like complicity.'],
    ['Boundary crossed', 'Someone repeatedly oversteps a line you never quite drew out loud. Naming it invites conflict; tolerating it invites more.'],
    ['Loyalty test', 'Two people you care about are feuding and each expects you to pick a side. Neutrality reads as betrayal to both.'],
    ['Apology demanded', 'You are asked to apologize publicly for something you do not fully believe you did wrong. The crowd wants contrition; your conscience does not.'],
    ['Exclusion', 'You learn the group made plans without you and did not think to mention it. Raising it seems needy; swallowing it seeds resentment.'],
    ['Viral misread', 'A throwaway message of yours is being screenshotted and reframed out of context. Explaining fuels it; ignoring lets it harden into fact.'],
    ['Group chat archaeology', 'Someone digs up an old message of yours and reads it in the worst possible light to the group. Context helps but sounds like an excuse.'],
    ['Uneven friendship', 'You realize, all at once, that you have been putting more effort into this friendship than the other person has for a long time.'],
    ['The favor economy', 'A friend has called in three favors this month and offered none. Naming it risks sounding petty; not naming it guarantees a fourth.'],
    ['Secondhand secret', 'You were told something in confidence that directly affects a decision someone else is about to make. Staying silent lets them walk into it.'],
    ['The subtweet', 'Someone is clearly talking about you without naming you, in a space where everyone else can tell. Responding confirms it landed; ignoring it looks like guilt.'],
    ['Awkward reunion', 'You run into someone you have not fully patched things up with, in front of people who do not know the history. Everyone is watching how normal you can make this look.'],
    ['The overheard opinion', 'You catch a friend describing you to someone else in a way that stings, not maliciously, just honestly. You were not supposed to hear it.'],
    ['The borrowed money silence', 'A friend who borrowed money months ago has resumed posting vacations and has not mentioned the debt once. Raising it prices the friendship; not raising it compounds quietly.'],
    ['The correction in public', 'You realize mid-meeting that the confident claim a friendly colleague just made is wrong, and the group is about to act on it. Correcting them costs them face; not correcting costs the group the outcome.'],
    ['The one-sided rivalry', 'Someone treats you as their measuring stick — cataloguing your wins, mirroring your moves. Naming it flatters you both badly; ignoring it feeds a story you are not in.'],
    ['The recycled confidence', 'A private thing you told one person arrives back to you from a third. The chain has exactly two links, and both deny being the loose one.'],
    ['The plus-one audit', 'You discover you were the backup invite — the message meant for someone else made that plain. Attending anyway now has a script; declining writes a different one.'],
  ],
  crisis: [
    ['3am outage', 'The system is down, customers are locked out, and you are the senior person awake. The fix is risky and untested; waiting for backup costs {mins} more minutes of downtime.'],
    ['Breach disclosure', 'You discover a data breach. Disclosing now invites panic and scrutiny; delaying to investigate buys clarity but multiplies the liability.'],
    ['Safety incident', 'Someone got hurt on your watch and the details are still unclear. Reporting fully protects everyone but implicates the team, including you.'],
    ['Layoff call', 'Numbers demand cutting {pct}% of the team by Friday. Moving fast is cleaner; agonizing over each name is humane but paralyzing.'],
    ['PR firestorm', 'A clip of the company is going viral for the wrong reasons and the phone is ringing. Responding fast risks fueling it; going dark reads as guilt.'],
    ['Insolvency countdown', 'Payroll clears in {days} days and the runway does not reach it. You can beg the bank, stiff a vendor, or tell the team the truth now.'],
    ['Whistle to blow', 'You spot something unethical that leadership is quietly ignoring. Escalating risks your standing; silence makes you part of it.'],
    ['Missing teammate', 'A key person has gone dark before a critical handoff and no one can reach them. Covering for them buys time; escalating exposes them.'],
    ['Vendor collapse', 'A critical vendor just went under with no notice and no handoff plan. Every downstream commitment you made assumed they would still exist tomorrow.'],
    ['Contradicting experts', 'Two credentialed advisors are giving you opposite recommendations with equal confidence, and the decision cannot wait for a tiebreaker.'],
    ['The false alarm cost', 'The last three times you escalated this class of incident, it was nothing — and escalating costs real credibility. This one looks the same. Is it?'],
    ['Partial information leak', 'Half the story is already public and the other half makes it look worse than it is. Correcting the record means revealing the part that is not out yet.'],
    ['Successor gap', 'The one person who understands this system is unreachable and the workaround they mentioned once was never written down.'],
    ['Regulatory clock', 'A regulator wants an answer by end of day that would normally take a week to responsibly produce. Rushing it and stalling it both carry real exposure.'],
    ['Quiet resignation', 'A key person just quietly resigned mid-crisis, and you cannot yet tell if it is unrelated or the first sign everyone else is right to worry.'],
    ['The rollback that will not', 'The obvious fix is rolling back the release — except the migration it shipped cannot be reversed, and the workaround only exists in one absent person\'s head.'],
    ['Insurance ambiguity', 'The policy that should cover this loss hinges on one clause with two readings. Filing the claim locks your account of events before you know which reading the insurer takes.'],
    ['The overcorrection window', 'Your first response to the incident was too aggressive and everyone now knows it. The correction you issue next will be read as the real policy.'],
    ['Donor with conditions', 'A rescue offer arrives mid-crisis with strings that solve this quarter and mortgage the next three years. The clock makes the strings look smaller than they are.'],
    ['The metric that saved you', 'The number that proves things are stabilizing is one you privately know is measured wrong. Correcting it now reopens the panic; riding it makes the recovery a story you cannot audit.'],
  ],
};
const CATEGORIES = Object.keys(SCENARIOS);

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function buildScenario(rng, category) {
  const [stem, body] = R.pick(rng, SCENARIOS[category]);
  const fill = body
    .replace('{pct}', String(R.int(rng, 12, 60)))
    .replace('{hrs}', String(R.pick(rng, [2, 4, 6, 24, 48])))
    .replace('{mins}', String(R.pick(rng, [10, 20, 30, 45])))
    .replace('{days}', String(R.int(rng, 3, 21)))
    .replace('{min}', String(R.int(rng, 1, 5)));
  const flavor = R.pick(rng, ['', ' The clock is running.', ' Everyone is watching how you handle it.', ' There is no clean option.']);
  const title = `${stem} (${category})`;
  return { title, category, description: (fill + flavor).trim(), stem };
}

// scenario -> candidate biases (which distortions this situation tends to trigger)
const CATEGORY_BIASES = {
  trading: ['loss-aversion', 'disposition-effect', 'fomo', 'recency', 'overconfidence', 'sunk-cost', 'herd-behavior', 'gamblers-fallacy', 'anchoring', 'ostrich-effect'],
  negotiation: ['anchoring', 'framing', 'overconfidence', 'loss-aversion', 'status-quo', 'endowment', 'authority-bias', 'sunk-cost'],
  social: ['bandwagon', 'herd-behavior', 'confirmation', 'authority-bias', 'availability', 'hindsight', 'framing'],
  crisis: ['ostrich-effect', 'availability', 'optimism', 'status-quo', 'loss-aversion', 'authority-bias', 'confirmation', 'overconfidence'],
};

function scenarioBiasLinks(rng, category) {
  const pool = CATEGORY_BIASES[category];
  const n = R.int(rng, 2, 3);
  return R.sample(rng, pool, n).map((slug, i) => ({
    slug, weight: R.round2(R.clamp(0.75 - i * 0.15 + (rng() - 0.5) * 0.1, 0.3, 0.95)),
  }));
}

// ----------------------------------------------------- emotional patterns ----
const EMOTIONAL_PATTERNS = [
  ['panic_selling', 'Panic Selling', 'Intense fear leading to immediate liquidation of assets.'],
  ['fomo_buying', 'FOMO Buying', 'Anxiety of missing out prompting hasty purchases at peaks.'],
  ['paralysis', 'Analysis Paralysis', 'Overthinking leading to delayed or completely stalled action.'],
  ['aggressive_counter', 'Aggressive Counter-offer', 'Hostile or overly confident reciprocation during negotiations.'],
  ['stoic_freeze', 'Stoic Freeze', 'Outward calm masking a total internal shutdown under threat.'],
  ['righteous_anger', 'Righteous Anger', 'Moral certainty converting fear into confrontational energy.'],
  ['appeasement', 'Appeasement', 'Conflict-avoidant capitulation to restore social harmony quickly.'],
  ['defiant_doubling', 'Defiant Doubling-Down', 'Escalating commitment precisely when challenged or losing.'],
  ['dissociative_deferral', 'Dissociative Deferral', 'Emotionally checking out and postponing the decision entirely.'],
  ['anxious_spiral', 'Anxious Spiral', 'Rumination that amplifies a single setback into catastrophe.'],
  ['cold_calculation', 'Cold Calculation', 'Emotion suppressed in favor of detached expected-value logic.'],
  ['euphoric_overreach', 'Euphoric Overreach', 'Winning streak breeding reckless overconfidence and overexposure.'],
  ['guilt_absorption', 'Guilt Absorption', 'Taking on blame for structural failures to protect others.'],
  ['vindication_seeking', 'Vindication Seeking', 'Acting to prove a point rather than to optimize the outcome.'],
  ['relief_capitulation', 'Relief Capitulation', 'Folding at the first exit that ends the discomfort, regardless of value.'],
  ['performative_calm', 'Performative Calm', 'Projecting composure for an audience while privately rattled.'],
];

// Every pattern above is now reachable (previously 2 of 16 — fomo_buying,
// aggressive_counter — were dead weight, never selected by emotionalArc).
const AROUSAL_BUCKETS = {
  high: ['panic_selling', 'paralysis', 'anxious_spiral', 'dissociative_deferral', 'guilt_absorption', 'fomo_buying', 'aggressive_counter'],
  mid: ['righteous_anger', 'appeasement', 'defiant_doubling', 'vindication_seeking', 'aggressive_counter', 'fomo_buying'],
  low: ['cold_calculation', 'stoic_freeze', 'performative_calm', 'euphoric_overreach', 'relief_capitulation'],
};

const OPEN_PHRASES = {
  high: ['A sharp initial spike of dread', 'An immediate jolt of alarm', 'A rush of adrenaline that narrows focus fast',
    'A hot flash of panic before any thought forms', 'An instant lurch in the stomach',
    'A cold drop, like a floor giving way half an inch',
    'A surge of alarm that arrives before the details do'],
  mid: ['A brief flicker of tension', 'A noticeable but manageable spike of unease', 'A quick surge of adrenaline that fades as fast as it came',
    'A momentary tightening before the response settles', 'A flash of heat that cools almost immediately',
    'A held breath that lets itself out halfway',
    'An alert, coiled attention with no panic in it yet'],
  low: ['Barely a ripple of concern', 'Almost no visible reaction at all', 'A flat, measured pulse with no real spike',
    'The faintest tightening, gone as soon as it is noticed', 'Something closer to mild interest than alarm',
    'A slight narrowing of attention, nothing more',
    'The emotional equivalent of a raised eyebrow'],
};
const CLOSE_PHRASES = {
  high: ['that lingers and colors the aftermath long after the moment passes', 'that keeps resurfacing in quiet moments for days afterward',
    'that leaves a residue of vigilance well past the event itself', 'that gets relived and replayed long after it stops being useful',
    'that keeps the hands slightly unsteady well into the next task',
    'that outlives the event and starts coloring unrelated decisions'],
  mid: ['that settles once the choice is made', 'that fades within the hour once the decision is locked in',
    'that resolves as soon as there is something concrete to act on', 'that dissolves quickly once the ambiguity clears',
    'that burns off as soon as the first concrete step is taken',
    'that leaves only a faint watchfulness behind'],
  low: ['that resolves almost before it registers', 'that is essentially forgotten by the next decision',
    'that leaves no discernible trace once the moment passes', 'that never really rises to the level of a feeling at all',
    'that reads on the outside as nothing having happened',
    'that is filed away before it finishes arriving'],
};

function emotionalArc(rng, bf, category) {
  const n = bf.neuroticism;
  const bucketKey = n >= 0.65 ? 'high' : n <= 0.35 ? 'low' : 'mid';
  const pat = R.pick(rng, AROUSAL_BUCKETS[bucketKey]);
  const open = R.pick(rng, OPEN_PHRASES[bucketKey]);
  const close = R.pick(rng, CLOSE_PHRASES[bucketKey]);
  return { text: `${open}, resolving into ${pat.replace(/_/g, ' ')} — ${close}.`, pattern: pat };
}

// ------------------------------------------------------------- responses ----
// posture from traits -> selects the shape of the action taken.
// v4: optionally factor-aware — a high loss-aversion lambda pulls risk down,
// a System-1 / low-CRT profile pulls impulsivity up, elevated psychopathy
// pushes risk appetite up. Backward compatible: factors may be omitted.
function posture(bf, factors) {
  let risk = 0.5 * (1 - bf.neuroticism) + 0.3 * bf.openness + 0.2 * (1 - bf.agreeableness);
  let impuls = 0.6 * (1 - bf.conscientiousness) + 0.4 * bf.extraversion;
  if (factors && factors.prospect_theory && typeof factors.prospect_theory.lambda === 'number') {
    // lambda 0.6..4.4 -> shift risk roughly +0.08 (lambda<1) to -0.12 (lambda>3.5)
    risk += 0.10 - 0.06 * Math.min(3.6, Math.max(0.6, factors.prospect_theory.lambda));
  }
  if (factors && factors.cognitive_reflection) {
    const cr = factors.cognitive_reflection;
    if (cr.system_preference === 'system1') impuls += 0.05;
    if (typeof cr.crt_score === 'number') impuls -= 0.03 * Math.min(3, cr.crt_score);
  }
  if (factors && factors.dark_triad && factors.dark_triad.psychopathy > 0.6) risk += 0.06;
  const bucket = risk >= 0.55
    ? (impuls >= 0.5 ? 'bold' : 'calculating')
    : (impuls >= 0.5 ? 'impulsive' : 'cautious');
  return { risk, impuls, bucket };
}

// action fragments keyed by category + posture bucket — each is now a small
// bank (was a single fixed string) picked at random per response.
const ACTIONS = {
  trading: {
    cautious: ['cuts risk immediately, banking safety over upside and accepting a worse price to sleep at night',
      'trims the position in stages, prioritizing capital preservation over any residual upside',
      'exits into the first available liquidity rather than waiting for a better print',
      'de-risks well before the textbook signal, uncomfortable holding exposure into the unknown',
      'halves the position twice rather than deciding once, buying certainty in installments',
      'parks the proceeds in the safest thing on the screen and revisits when the tape calms down'],
    calculating: ['sizes the decision off a pre-set rule, ignoring the noise and executing the plan mechanically',
      'runs the scenario through a checklist built in advance and follows wherever it points',
      'treats the moment as one more data point for a system, not an exception to react to',
      'executes the pre-committed plan exactly, resisting the urge to improvise under pressure',
      're-reads the written playbook aloud before touching the keyboard, then does what it says',
      'sizes the response to the signal, not the feeling, and logs both for the review'],
    bold: ['leans into the move, adding exposure where others are flinching and betting on the reversal',
      'presses the position further, treating the volatility itself as the opportunity',
      'takes the contrarian side deliberately, willing to be early and wrong before being right',
      "scales in aggressively, judging the crowd's fear as the better signal to fade",
      'sells the calm and buys the panic on the theory that emotion is the only mispriced asset left',
      'widens the mandate on the spot, treating the dislocation as the opportunity the plan never imagined'],
    impulsive: ['acts on the first strong feeling, hitting the button before the reasoning fully forms',
      'chases the move in real time, adjusting size on gut feel as the price ticks',
      'reacts to the headline before confirming it, then scrambles to justify the trade after',
      'flips the position on a hunch mid-session without waiting for confirmation',
      'market-orders first and calculates the size it should have been afterward',
      'reacts to the candle, not the cause, and is fully repositioned before the news is even confirmed'],
  },
  negotiation: {
    cautious: ['protects the relationship, conceding ground to keep the deal and the goodwill intact',
      'softens the ask to keep the conversation moving rather than risk a stall',
      'offers a face-saving off-ramp for the other side even at some cost to itself',
      'prioritizes a durable outcome over a maximal one',
      'trades the last dollar on the table for the first call answered next time',
      'bends on the number to hold the terms that actually compound'],
    calculating: ["holds the line to their BATNA, trading patience for leverage and refusing to move first",
      'lets the numbers set the floor and refuses to negotiate against itself',
      'tracks concessions explicitly and matches them one-for-one, never more',
      'stays silent past the point of discomfort, letting the other side fill the gap',
      'restates the other side\'s position better than they did, then lets the asymmetry do the work',
      'moves only when a concession can be traded, never merely given'],
    bold: ['counters aggressively, re-anchoring hard and daring the other side to walk',
      'sets an ultimatum earlier than convention allows, betting the other side blinks first',
      'walks from the table on principle, trusting the other side to come back',
      'pushes for the full ask, treating a bruised relationship as an acceptable cost',
      're-anchors above the original ask, converting their tactic into the new baseline',
      'introduces a competing suitor, real enough, and lets scarcity renegotiate'],
    impulsive: ['blurts a number or an ultimatum, then has to live with wherever it lands',
      'agrees on the spot to end the tension, details to be sorted out later',
      'escalates the demand mid-conversation on impulse, surprising even itself',
      'accepts the first workable offer rather than sit with more back-and-forth',
      'gives away a real concession to end the meeting, then spends the week justifying it',
      'names a final number mid-sentence and is as surprised as anyone that it holds'],
  },
  social: {
    cautious: ['smooths it over, absorbing the discomfort to keep the peace even at personal cost',
      'steps back and lets the moment pass rather than force a resolution',
      'chooses the gentlest true version of events available',
      'defers the confrontation to a calmer, more private moment',
      'lets the moment cool exactly one day, then addresses it in the smallest possible room',
      'absorbs the jab in public and files it privately under things that will matter later'],
    calculating: ['responds deliberately, choosing words to protect their standing without escalating',
      'reads the room fully before committing to a position',
      'frames the response so it can be walked back later if needed',
      'weighs the audience as carefully as the actual disagreement',
      'answers the reasonable version of the attack and leaves the unreasonable version unclaimed',
      'asks one precise question that makes the room do the confronting instead'],
    bold: ['confronts it head-on, naming the problem in the room regardless of who bristles',
      'calls it out publicly rather than let it pass unaddressed',
      'takes the harder, more direct route on principle',
      'draws the line clearly, accepting the social cost as the price of clarity',
      'names the behavior, not the person, and does it while everyone is still watching',
      'spends social capital on the spot, on principle, without checking the balance first'],
    impulsive: ['reacts in the moment, saying the thing everyone was thinking and dealing with fallout later',
      'fires back before fully thinking it through',
      'lets the first reaction show on their face and in their words',
      'responds in the heat of it, unfiltered',
      'says the quiet part at full volume and lets the fallout schedule itself',
      'laughs at the wrong moment, honestly, and deals with what that reveals'],
  },
  crisis: {
    cautious: ['follows protocol to the letter, escalating up the chain rather than acting alone',
      'waits for authorization even when it costs time, unwilling to freelance the response',
      'documents before acting, wary of a decision it cannot later justify',
      'defers the riskiest calls to whoever has the formal authority to make them',
      'keeps a written timeline from minute one so every later question has a boring answer',
      'slows the room down on purpose, trading minutes of delay for hours of rework avoided'],
    calculating: ['triages coldly, sequencing the least-reversible decisions first and documenting each step',
      'builds a rapid decision tree and works it in order, ignoring the noise around it',
      'isolates the irreversible choices and makes those first, deferring the rest',
      'treats the incident as a sequence of small decisions rather than one big one',
      'freezes the blast radius first and only then starts diagnosing the cause',
      'assigns one owner per unknown and reconvenes on a timer instead of on emotion'],
    bold: ['takes command and acts decisively, accepting personal risk to move faster than the situation',
      'makes the call alone rather than wait for consensus that will not arrive in time',
      'moves first and briefs everyone else after, betting speed matters more than buy-in',
      'accepts blame in advance in exchange for the authority to act now',
      'declares the emergency before anyone else will, and owns the false-alarm risk out loud',
      'spends reputation to buy speed, on the theory that reputations recover and outages compound'],
    impulsive: ['lunges at the most visible fix, trading a fast intervention for a considered one',
      'acts on the first plausible fix without checking for a better one',
      'reacts to the loudest signal in the room rather than the most important one',
      'moves before the full picture is in, unable to tolerate the uncertainty',
      'fixes the loudest symptom first, which is occasionally even the actual problem',
      'declares a direction to end the meeting, then quietly reverses half of it by morning'],
  },
};

// reasoning chain: a per-style base clause bank composed with a per-category
// context clause. Previously REASONING was one fixed string per style (6
// total, ever). This raises the ceiling to (~6-7 bases x ~3 contexts) per
// style-category pair.
const REASONING = {
  analytical: ['Lays out the options explicitly, assigns each a rough expected value, and picks the one that survives the numbers — distrusting any impulse that cannot be written down.',
    'Breaks the decision into weighted criteria before looking at gut feel, and lets the tally overrule any single strong reaction.',
    'Treats the choice as a small research problem: gather the knowable facts first, model the downside, then commit only once the math stops moving.',
    'Distrusts the first plausible-sounding answer and keeps testing alternatives until one survives every objection raised against it.',
    'Builds an explicit decision matrix for a call most people would make on instinct, and defers to whichever option scores highest even if it feels wrong.',
    'Separates the emotional read from the analytical one on purpose, writes both down, and lets the analytical read win the tiebreak.',
    'Prices the reversible and irreversible parts of the choice separately, and spends its caution almost entirely on the second.',
    'Asks what the calmest competent person it knows would do, then checks that answer against the numbers before borrowing it.'],
  intuitive: ['Reads the situation in a single gut pass, locks onto the option that "feels" right, and assembles the justification afterward.',
    'Trusts a felt sense of pattern over any spreadsheet, treating hesitation itself as evidence something is off.',
    'Recognizes the shape of the situation from past experience before consciously naming why, then acts on that recognition.',
    'Skips the formal weighing entirely — the answer arrives whole, and the reasoning is reconstructed only if someone asks for it.',
    'Lets a fast, holistic read override any slower counting of pros and cons that might contradict it.',
    'Feels the decision settle before it is fully articulated, and moves on that settling rather than waiting for certainty.',
    'Notices which option it keeps defending in imaginary arguments, and takes that as the verdict already rendered.',
    'Reads the first ten seconds of its own reaction as the highest-quality data in the room.'],
  dependent: ['Mentally polls trusted voices and prior authority before committing, reluctant to own the call alone.',
    'Delays a final answer until at least one credible outside opinion has weighed in, treating solo conviction as insufficient.',
    "Looks for precedent or a mentor's read before trusting its own judgment on something this consequential.",
    'Frames the decision as something to be validated rather than made, and keeps circling until someone else signs off.',
    'Weighs its own instinct as only one input among several trusted others, and defers when they disagree.',
    'Feels most confident the moment someone with more authority confirms the direction, and shaky right up until then.',
    'Rehearses how the decision will be explained to the people it answers to, and picks the option with the sturdiest explanation.',
    'Treats consensus as a safety feature, not a shortcut — the point is to never be wrong alone.'],
  avoidant: ['Searches first for a way to not decide — a delay, a deferral, a partial step — and only acts when forced.',
    'Treats not-choosing as a safe choice right up until the option closes on its own.',
    'Buries the hard call under a pile of preparatory busywork that never quite finishes.',
    'Looks for a reason the decision belongs to someone else, or to a later date, before considering it directly.',
    'Keeps every option notionally open as long as possible, even at the cost of the best ones expiring first.',
    'Reframes inaction as patience, and patience as strategy, for as long as the situation allows.',
    'Breaks the decision into stages mostly so the committing stage can be scheduled for later.',
    'Gathers one more opinion not to learn from it but to postpone the moment the choice becomes its own.'],
  spontaneous: ['Commits fast to end the tension, treating a quick wrong move as better than a slow right one.',
    'Acts on the strongest immediate impulse and treats hesitation as its own kind of risk.',
    'Picks the option that resolves the discomfort of choosing fastest, then adapts to whatever follows.',
    'Trusts the first workable idea enough to move on it before a second one can compete for attention.',
    'Prefers a decisive wrong turn to an open-ended maybe, and corrects course later if it has to.',
    'Lets urgency substitute for analysis, converting pressure directly into action.',
    'Counts any decision made today as beating a better one made next week, and acts accordingly.',
    'Trusts that motion generates information no amount of stillness will, and buys that information immediately.'],
  deliberative: ['Walks every branch and contingency in sequence, uneasy until the residual ambiguity is as small as it can be.',
    'Slow-walks the decision through every foreseeable consequence before allowing itself to commit.',
    'Treats a rushed decision as a defect regardless of outcome, and resists pressure to shortcut the process.',
    'Keeps expanding the list of scenarios to consider until diminishing returns finally force a stop.',
    'Wants the decision to survive hindsight, not just produce a good outcome, so it over-invests in the reasoning itself.',
    'Revisits the same decision from a new angle each time doubt resurfaces, even after nominally deciding.',
    'Interrogates the option it likes hardest, on the theory that preference is where the errors hide.',
    'Maps who is harmed under each branch before asking who benefits, and lets the downside map drive.'],
};

const REASONING_CONTEXT = {
  trading: ['This time the variable is money moving in real time.', 'The numbers on the screen are the only feedback that matters here.',
    'Price action does not care which argument feels more convincing.',
    'Liquidity, not conviction, decides what an exit is worth here.',
    "Being early and being wrong settle to the same P&L today."],
  negotiation: ['The counterparty is reading every hesitation as information.', "Every option here also has to survive the other side's reaction.",
    'The relationship and the number are both on the table at once.',
    'Whatever gets conceded here becomes the precedent for the next three asks.',
    'The other side is pricing your patience as carefully as your position.'],
  social: ['An audience is watching how this gets handled.', 'Whatever happens next becomes part of the story people tell about it.',
    'The social cost and the practical cost point in different directions.',
    'Everyone watching will remember the tone longer than the substance.',
    'The relationship will outlast whatever this disagreement is nominally about.'],
  crisis: ['There is no version of this where every stakeholder ends up satisfied.', 'The clock is compressing a decision that would normally take longer.',
    'Getting this wrong in public is worse than getting it wrong quietly.',
    'Half the damage here is the decision; the other half is how the decision travels.',
    'Every hour of delay closes some options and quietly reprices the rest.'],
};

function buildReasoning(rng, style, category) {
  const base = R.pick(rng, REASONING[style] || REASONING.analytical);
  const ctxBank = REASONING_CONTEXT[category];
  const ctx = ctxBank ? R.pick(rng, ctxBank) : '';
  return ctx ? `${base} ${ctx}` : base;
}

function buildResponse(rng, profile, scenario) {
  const bf = profile.big_five;
  const style = profile.decision_style || S.deriveDecisionStyle(rng, bf);
  const content = profile.content || profile;
  const factors = {
    dark_triad: profile.dark_triad || content.dark_triad,
    prospect_theory: profile.prospect_theory || content.prospect_theory,
    cognitive_reflection: profile.cognitive_reflection || content.cognitive_reflection,
  };
  const p = posture(bf, factors);
  const action = R.pick(rng, ACTIONS[scenario.category][p.bucket]);
  const topBiasSlug = (profile.suggested_biases && profile.suggested_biases[0] && profile.suggested_biases[0].slug)
    || (content.suggested_biases && content.suggested_biases[0] && content.suggested_biases[0].slug);
  const subj = R.pick(rng, ['this person', 'this profile', 'the individual', 'this type',
    'this character', 'someone wired this way']);
  const quirk = topBiasSlug && S.BIAS_QUIRK[topBiasSlug] ? `, and true to form ${R.pick(rng, S.BIAS_QUIRK[topBiasSlug])}` : '';
  // ~60% of responses name the scenario, which multiplies distinct response
  // strings by the scenario count and makes each record self-describing.
  const stemTitle = String(scenario.title || '').replace(/\s*\([^)]*\)\s*$/, '');
  const opener = stemTitle && R.chance(rng, 0.6)
    ? `${R.pick(rng, ['Faced with', 'Confronted with', 'Dropped into', 'Hit with'])} "${stemTitle.toLowerCase()}"`
    : R.pick(rng, ['Faced with this', 'Put in this spot', 'Confronted with it',
      'Dropped into this', 'When it lands on their desk', 'In the moment']);
  const response = `${opener}, ${subj} ${action}${quirk}.`;
  let reasoning = buildReasoning(rng, style, scenario.category);
  // Occasionally surface the prospect-theory posture in plain language so the
  // enriched factors are visible in the text, not just the JSON (~1 in 6).
  if (factors.prospect_theory && typeof factors.prospect_theory.lambda === 'number' && R.chance(rng, 0.16)) {
    try {
      const F = require('./factors.js');
      reasoning += ' Underneath it, ' + F.prospectClause(rng, factors) + '.';
    } catch { /* factors module optional for older checkouts */ }
  }
  const arc = emotionalArc(rng, bf, scenario.category);

  // confidence: overconfident + conscientious raise it; neuroticism lowers it;
  // v4: CRT adds calibration, heavy loss-aversion dents it in loss-framed
  // categories, elevated psychopathy/narcissism inflate it.
  const over = topBiasSlug === 'overconfidence' ? 0.15 : 0;
  let confidence = 0.5 + 0.25 * (1 - bf.neuroticism) + 0.15 * bf.conscientiousness - 0.1 + over + (rng() - 0.5) * 0.1;
  if (factors.cognitive_reflection && typeof factors.cognitive_reflection.crt_score === 'number') {
    confidence += 0.015 * factors.cognitive_reflection.crt_score;
  }
  if (factors.prospect_theory && factors.prospect_theory.lambda >= 2.5 &&
      (scenario.category === 'trading' || scenario.category === 'crisis')) {
    confidence -= 0.05;
  }
  if (factors.dark_triad) {
    if (factors.dark_triad.psychopathy > 0.6) confidence += 0.04;
    if (factors.dark_triad.narcissism > 0.65) confidence += 0.04;
  }
  confidence = R.round2(R.clamp(confidence, 0.15, 0.98));

  return {
    response,
    reasoning_chain: reasoning,
    emotional_arc: arc.text,
    emotional_pattern: arc.pattern,
    confidence,
  };
}

module.exports = {
  SCENARIOS, CATEGORIES, buildScenario, slugify,
  CATEGORY_BIASES, scenarioBiasLinks, EMOTIONAL_PATTERNS,
  posture, buildResponse, buildReasoning,
  // v4: expose the composition banks so SQL-side emitters (gen-v4-enrich.mjs)
  // stay byte-consistent with the JS engine instead of duplicating content.
  ACTIONS, REASONING, REASONING_CONTEXT, OPEN_PHRASES, CLOSE_PHRASES, AROUSAL_BUCKETS,
};
