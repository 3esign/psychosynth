// Psychosynth bulk synthetic-data generator.
// Emits schema-perfect, idempotent SQL for: biases, scenarios, profiles,
// trader personas, and profile-conditioned scenario responses.
// Deterministic (seeded) so re-runs are stable; explicit UUIDs so responses
// link to the exact profiles/scenarios; ON CONFLICT guards make reloads safe.
//
// Usage: node generate_all.mjs [seed]
import { writeFileSync } from 'node:fs';

const SEED = Number(process.argv[2] ?? 42);
const OUT = new URL('./out/', import.meta.url).pathname;

// ---- deterministic RNG + helpers -----------------------------------------
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rng = mulberry32(SEED);
const r2 = (n)=>Math.round(n*100)/100;
const clamp = (n,lo=0.03,hi=0.97)=>Math.min(hi,Math.max(lo,r2(n)));
const jit = (b,d=0.10)=>clamp(b+(rng()*2-1)*d);
const pick = (a)=>a[Math.floor(rng()*a.length)];
const pickN = (a,n)=>{const c=[...a];const o=[];while(o.length<n&&c.length)o.push(c.splice(Math.floor(rng()*c.length),1)[0]);return o;};
const chance = (p)=>rng()<p;
const cap = (s)=>s.charAt(0).toUpperCase()+s.slice(1);
const esc = (s)=>String(s).replace(/'/g,"''");
const jesc = (o)=>esc(JSON.stringify(o));
function uuid(){const b=new Array(16);for(let i=0;i<16;i++)b[i]=Math.floor(rng()*256);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;const h=b.map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
const mbti = (b)=>(b.extraversion>0.5?'E':'I')+(b.openness>0.5?'N':'S')+(b.agreeableness>0.5?'F':'T')+(b.conscientiousness>0.5?'J':'P');
const arr = (xs)=>`ARRAY[${xs.map(x=>`'${esc(x)}'`).join(',')}]::text[]`;
// chunk a VALUES list into multiple INSERT statements (editor-friendly)
function chunked(prefix, vals, conflict, size=200){
 let out='';
 for(let i=0;i<vals.length;i+=size){
   out += `${prefix}\n${vals.slice(i,i+size).join(',\n')}\n${conflict};\n\n`;
 }
 return out;
}

const STYLES = ['analytical','intuitive','deliberative','spontaneous','avoidant','dependent'];

// ---- BIASES (literature-grounded taxonomy) --------------------------------
const BIAS = [
 ['anchoring','Anchoring','Over-relying on the first piece of information encountered when making decisions.',['Fixating on an initial asking price during a negotiation','Estimating a value near a recently seen but irrelevant number'],['Consider multiple reference points','Generate an independent estimate before seeing any anchor'],'Tversky & Kahneman (1974)'],
 ['availability','Availability Heuristic','Judging likelihood by how easily examples come to mind rather than by base rates.',['Overestimating plane-crash risk after seeing news coverage'],['Consult actual frequency data','Ask what is memorable vs. what is common'],'Tversky & Kahneman (1973)'],
 ['confirmation','Confirmation Bias','Seeking and weighting evidence that confirms existing beliefs.',['Reading only sources that agree with a thesis'],['Actively seek disconfirming evidence','Argue the opposing case'],'Wason (1960)'],
 ['loss-aversion','Loss Aversion','Losses feel roughly twice as painful as equivalent gains feel good.',['Holding a losing position to avoid realizing the loss'],['Frame decisions in terms of final wealth','Pre-commit to exit rules'],'Kahneman & Tversky (1979)'],
 ['sunk-cost','Sunk-Cost Fallacy','Continuing an endeavor because of already-invested resources.',['Pouring more money into a failing project to justify past spend'],['Evaluate only marginal future costs and benefits','Ignore unrecoverable past costs'],'Arkes & Blumer (1985)'],
 ['overconfidence','Overconfidence','Overestimating the accuracy of one’s knowledge or predictions.',['Setting 90% confidence intervals that are hit far less often'],['Track calibration over time','Widen uncertainty ranges'],'Fischhoff et al. (1977)'],
 ['dunning-kruger','Dunning–Kruger Effect','Low-skill individuals overestimate competence; experts underestimate it.',['A novice rating their expertise above a specialist'],['Seek external assessment','Compare against objective benchmarks'],'Kruger & Dunning (1999)'],
 ['hindsight','Hindsight Bias','Seeing past events as having been predictable after they occur.',['“I knew it all along” after a market crash'],['Record predictions in advance','Review the information available at the time'],'Fischhoff (1975)'],
 ['framing','Framing Effect','Drawing different conclusions from the same information based on presentation.',['Preferring “90% survival” over “10% mortality”'],['Reframe the choice in the opposite valence','Standardize the presentation'],'Tversky & Kahneman (1981)'],
 ['recency','Recency Bias','Weighting recent events more heavily than earlier ones.',['Extrapolating the last few days of returns indefinitely'],['Zoom out to longer history','Weight by relevance, not recency'],'Behavioral finance literature'],
 ['herd-behavior','Herd Behavior','Following the actions of a larger group rather than independent judgment.',['Buying an asset only because everyone else is'],['Form an independent thesis first','Ask what the crowd might be missing'],'Banerjee (1992)'],
 ['fomo','Fear of Missing Out','Anxiety that others are benefiting, driving impulsive participation.',['Chasing a parabolic move late'],['Pre-define entry criteria','Accept that missing some opportunities is normal'],'Social psychology literature'],
 ['gamblers-fallacy','Gambler’s Fallacy','Believing past independent outcomes affect future probabilities.',['Expecting red after a run of black on roulette'],['Treat independent events as independent','Check whether outcomes are truly memoryless'],'Laplace (1796)'],
 ['hot-hand','Hot-Hand Fallacy','Believing a streak of successes will continue due to being “on fire.”',['Doubling size after a few winning trades'],['Test for genuine autocorrelation','Separate skill from variance'],'Gilovich et al. (1985)'],
 ['disposition-effect','Disposition Effect','Selling winners too early and holding losers too long.',['Locking in small gains while letting losses run'],['Use symmetric exit rules','Judge positions on forward prospects'],'Shefrin & Statman (1985)'],
 ['endowment','Endowment Effect','Valuing something more simply because one owns it.',['Demanding far more to sell an item than one would pay for it'],['Ask the market-clearing price','Imagine not currently owning it'],'Thaler (1980)'],
 ['status-quo','Status-Quo Bias','Preferring things to stay the same by doing nothing.',['Keeping a default allocation despite better options'],['Treat inaction as an active choice','Re-derive the optimal from scratch'],'Samuelson & Zeckhauser (1988)'],
 ['ostrich-effect','Ostrich Effect','Avoiding negative information by refusing to look.',['Not checking a portfolio during a drawdown'],['Schedule regular reviews regardless of mood','Automate reporting'],'Karlsson et al. (2009)'],
 ['self-serving','Self-Serving Bias','Attributing successes to self and failures to external factors.',['Crediting skill for gains, blaming the market for losses'],['Keep a decision journal','Apply the same standard to wins and losses'],'Miller & Ross (1975)'],
 ['fundamental-attribution','Fundamental Attribution Error','Over-attributing others’ behavior to character over situation.',['Assuming a late colleague is lazy rather than delayed'],['Consider situational constraints','Ask what you would do in their context'],'Ross (1977)'],
 ['halo-effect','Halo Effect','Letting one positive trait color overall judgment.',['Assuming an attractive founder is also competent'],['Rate attributes independently','Use structured criteria'],'Thorndike (1920)'],
 ['negativity','Negativity Bias','Giving more weight to negative than positive information.',['One bad review outweighing many good ones'],['Weight evidence by base rate','Quantify the balance explicitly'],'Rozin & Royzman (2001)'],
 ['optimism','Optimism Bias','Overestimating the likelihood of positive outcomes for oneself.',['Believing your project will beat the average failure rate'],['Use reference-class forecasting','Pre-mortem the plan'],'Weinstein (1980)'],
 ['planning-fallacy','Planning Fallacy','Underestimating time, costs, and risks of future actions.',['A project that always overruns its own estimate'],['Base estimates on similar past projects','Add explicit buffers'],'Kahneman & Tversky (1979)'],
 ['base-rate-neglect','Base-Rate Neglect','Ignoring general prevalence in favor of specific information.',['Overweighting a test result while ignoring disease rarity'],['Start from the base rate','Apply Bayes’ rule explicitly'],'Kahneman & Tversky (1973)'],
 ['conjunction-fallacy','Conjunction Fallacy','Judging a specific combination as more likely than one of its parts.',['Rating “bank teller and activist” above “bank teller”'],['Remember P(A∧B) ≤ P(A)','Decompose the claim'],'Tversky & Kahneman (1983)'],
 ['representativeness','Representativeness','Judging probability by similarity to a stereotype.',['Assuming a quiet person is a librarian not a salesperson'],['Anchor on base rates','Discount stereotype-fit'],'Kahneman & Tversky (1972)'],
 ['survivorship','Survivorship Bias','Focusing on survivors and ignoring what failed.',['Studying only successful startups for lessons'],['Deliberately study failures','Reconstruct the full original set'],'Wald (1943)'],
 ['clustering-illusion','Clustering Illusion','Seeing patterns in what are actually random sequences.',['Reading meaning into a random price wiggle'],['Test against a random benchmark','Compute the expected clustering'],'Gilovich (1991)'],
 ['authority-bias','Authority Bias','Over-trusting the opinion of an authority figure.',['Following a pundit’s call without checking'],['Evaluate the argument, not the title','Seek independent corroboration'],'Milgram (1963)'],
 ['bandwagon','Bandwagon Effect','Adopting beliefs because many others hold them.',['Buying a trend because it is popular'],['Assess the claim on its merits','Ask who benefits from the consensus'],'Social psychology literature'],
 ['in-group','In-Group Bias','Favoring members of one’s own group.',['Trusting advice from your circle over better outside data'],['Blind the source when evaluating','Seek out-group perspectives'],'Tajfel (1970)'],
 ['illusion-of-control','Illusion of Control','Overestimating one’s influence over outcomes.',['Believing a ritual affects a random result'],['Distinguish skill from luck','Track outcomes vs. actions'],'Langer (1975)'],
 ['just-world','Just-World Hypothesis','Believing the world is fair, so people get what they deserve.',['Assuming victims must have caused their misfortune'],['Separate outcome from desert','Consider luck and structure'],'Lerner (1980)'],
 ['action-bias','Action Bias','Preferring action over inaction even when waiting is better.',['Overtrading in a flat market'],['Set a bar for acting','Value the option of doing nothing'],'Patt & Zeckhauser (2000)'],
 ['ambiguity-aversion','Ambiguity Aversion','Preferring known risks over unknown ones.',['Avoiding an unfamiliar market despite better odds'],['Quantify the ambiguity','Separate unknown from unfavorable'],'Ellsberg (1961)'],
 ['zero-risk','Zero-Risk Bias','Preferring to eliminate one risk entirely over reducing several.',['Spending heavily to remove a tiny risk'],['Compare marginal risk reduction per dollar','Optimize total risk'],'Baron et al. (1993)'],
 ['mental-accounting','Mental Accounting','Treating money differently based on arbitrary categories.',['Splurging “winnings” while guarding “salary”'],['Treat money as fungible','Optimize the whole balance sheet'],'Thaler (1985)'],
 ['hyperbolic-discounting','Hyperbolic Discounting','Preferring smaller-sooner rewards over larger-later ones.',['Taking a small payout now over a larger one later'],['Pre-commit to the long-term choice','Use binding commitment devices'],'Ainslie (1975)'],
 ['present-bias','Present Bias','Overweighting immediate payoffs relative to the future.',['Procrastinating despite future cost'],['Make future costs vivid','Automate long-term actions'],'O’Donoghue & Rabin (1999)'],
 ['decoy-effect','Decoy Effect','A third inferior option shifts preference between two others.',['A pricey “decoy” nudging buyers to the middle tier'],['Evaluate options on absolute value','Remove irrelevant alternatives'],'Huber et al. (1982)'],
 ['contrast-effect','Contrast Effect','Perception shifted by comparison with recent stimuli.',['A fair price seeming cheap after an expensive one'],['Judge against an absolute standard','Reset the reference point'],'Behavioral literature'],
 ['peak-end','Peak–End Rule','Judging an experience by its peak and its end, not the average.',['Rating a trip by its best moment and finish'],['Sample the whole experience','Weight by duration'],'Kahneman et al. (1993)'],
 ['escalation-of-commitment','Escalation of Commitment','Increasing investment in a failing course to justify prior choices.',['Adding to a losing bet to avoid admitting error'],['Set stop-loss rules in advance','Bring in an outside reviewer'],'Staw (1976)'],
 ['reactance','Reactance','Doing the opposite of what is urged to preserve autonomy.',['Rejecting good advice because it was pushed'],['Separate the message from the messenger','Reframe as your own choice'],'Brehm (1966)'],
 ['backfire-effect','Backfire Effect','Strengthening a belief when confronted with contradicting evidence.',['Doubling down after being corrected'],['Approach evidence with curiosity','Lower the stakes of being wrong'],'Nyhan & Reifler (2010)'],
 ['belief-perseverance','Belief Perseverance','Maintaining beliefs after their basis is discredited.',['Holding a thesis after its premise is refuted'],['Re-derive conclusions from current evidence','Note when a premise falls'],'Ross et al. (1975)'],
 ['illusory-superiority','Illusory Superiority','Overestimating one’s qualities relative to others.',['Most drivers rating themselves above average'],['Benchmark against real distributions','Seek candid feedback'],'Social psychology literature'],
 ['spotlight-effect','Spotlight Effect','Overestimating how much others notice you.',['Assuming everyone saw a small mistake'],['Recognize others’ self-focus','Ask for calibration'],'Gilovich et al. (2000)'],
 ['curse-of-knowledge','Curse of Knowledge','Assuming others share your background knowledge.',['An expert explaining over a novice’s head'],['Test explanations on a naive audience','Define terms explicitly'],'Camerer et al. (1989)'],
 ['pseudocertainty','Pseudocertainty Effect','Treating a probable outcome as certain in multi-stage decisions.',['Ignoring an early-stage risk because a later stage feels safe'],['Multiply stage probabilities','Model the full tree'],'Tversky & Kahneman (1981)'],
 ['denomination-effect','Denomination Effect','Spending small denominations more readily than large ones.',['Breaking a large bill makes it easier to spend'],['Track total outflow','Pre-budget regardless of denomination'],'Raghubir & Srivastava (2009)'],
 ['money-illusion','Money Illusion','Thinking in nominal rather than real (inflation-adjusted) terms.',['Feeling richer from a raise below inflation'],['Adjust for inflation','Compare purchasing power'],'Fisher (1928)'],
 ['focusing-illusion','Focusing Illusion','Overweighting one salient factor in a life judgment.',['Assuming a purchase will change happiness more than it does'],['Consider the full picture','Ask about day-to-day reality'],'Schkade & Kahneman (1998)'],
 ['impact-bias','Impact Bias','Overestimating the intensity and duration of future feelings.',['Expecting a setback to feel worse for longer than it does'],['Recall past adaptation','Forecast with a discount'],'Wilson & Gilbert (2003)'],
 ['omission','Omission Bias','Judging harmful actions as worse than equally harmful inactions.',['Preferring to do nothing even when acting saves more'],['Weigh outcomes, not act vs. omit','Make the cost of inaction explicit'],'Spranca et al. (1991)'],
 ['pro-innovation','Pro-Innovation Bias','Overvaluing a new idea while ignoring its limitations.',['Adopting a novel tool because it is new'],['Demand evidence of net benefit','Pilot before committing'],'Rogers (1962)'],
 ['semmelweis-reflex','Semmelweis Reflex','Reflexively rejecting new evidence that contradicts norms.',['Dismissing a finding that breaks convention'],['Judge evidence on quality','Separate novelty from validity'],'History of science'],
 ['restraint-bias','Restraint Bias','Overestimating one’s ability to control impulses.',['Keeping temptation nearby, sure of resisting'],['Reduce exposure to triggers','Use precommitment'],'Nordgren et al. (2009)'],
 ['empathy-gap','Empathy Gap','Underestimating how visceral states change decisions.',['Overcommitting when calm, then buckling under stress'],['Plan for the heated state','Build in cool-off periods'],'Loewenstein (1996)'],
 ['projection-bias','Projection Bias','Assuming future preferences match current ones.',['Grocery shopping while hungry'],['Decide in a neutral state','Discount current cravings'],'Loewenstein et al. (2003)'],
 ['anchoring-adjustment','Insufficient Adjustment','Adjusting too little away from an initial anchor.',['Landing near a starting figure despite new data'],['Adjust more aggressively','Estimate from scratch and compare'],'Epley & Gilovich (2006)'],
 ['bias-blind-spot','Bias Blind Spot','Seeing bias in others but not in oneself.',['Believing you are uniquely objective'],['Assume you are biased too','Use external checks'],'Pronin et al. (2002)'],
 ['false-consensus','False-Consensus Effect','Overestimating how much others share your views.',['Assuming most people agree with you'],['Sample real opinions','Seek dissent explicitly'],'Ross et al. (1977)'],
 ['illusion-of-transparency','Illusion of Transparency','Overestimating how visible your internal state is to others.',['Assuming your nervousness is obvious'],['Ask for feedback','Assume less is shown'],'Gilovich et al. (1998)'],
 ['hard-easy','Hard–Easy Effect','Overconfidence on hard tasks, underconfidence on easy ones.',['Being surest on the trickiest questions'],['Calibrate by difficulty','Track hit rates per tier'],'Lichtenstein & Fischhoff (1977)'],
 ['less-is-better','Less-Is-Better Effect','Preferring a lesser option when items are judged separately.',['A small full cup beating a larger partly-full one'],['Compare options jointly','Use absolute measures'],'Hsee (1998)'],
 ['distinction-bias','Distinction Bias','Overvaluing differences when options are viewed side by side.',['Fixating on a spec gap that will not matter in use'],['Imagine experiencing each alone','Weight by real impact'],'Hsee & Zhang (2004)'],
 ['rosy-retrospection','Rosy Retrospection','Remembering the past more positively than it was.',['“The good old days” that were not'],['Consult contemporaneous records','Note memory’s positivity drift'],'Mitchell et al. (1997)'],
 ['pessimism','Pessimism Bias','Overestimating the likelihood of negative outcomes.',['Assuming the worst despite favorable odds'],['Use base rates','Separate fear from probability'],'Behavioral literature'],
 ['normalcy','Normalcy Bias','Underestimating the likelihood and impact of a disaster.',['Ignoring warnings because things seem normal'],['Rehearse contingencies','Take early signals seriously'],'Disaster psychology literature'],
 ['outcome','Outcome Bias','Judging a decision by its result rather than its quality.',['Praising a lucky reckless bet'],['Evaluate the process','Separate skill from luck'],'Baron & Hershey (1988)'],
 ['choice-supportive','Choice-Supportive Bias','Remembering chosen options as better than they were.',['Recalling a past purchase too fondly'],['Keep pre-choice notes','Compare honestly'],'Mather et al. (2000)'],
 ['information-bias','Information Bias','Seeking information that cannot change a decision.',['Ordering tests whose results will not alter the plan'],['Ask if the data changes action','Value of information first'],'Baron et al. (1988)'],
 ['unit-bias','Unit Bias','Treating a provided unit as the appropriate amount.',['Finishing a whole serving because it was served'],['Pre-portion deliberately','Question the default unit'],'Geier et al. (2006)'],
 ['default-effect','Default Effect','Sticking with a pre-set option.',['Keeping the default contribution rate'],['Actively choose','Re-derive the best option'],'Johnson & Goldstein (2003)'],
 ['gaze-heuristic','Salience Bias','Focusing on prominent items and ignoring the rest.',['Reacting to a headline number, missing the footnote'],['Scan the full data','Down-weight what merely stands out'],'Attention literature'],
 ['confabulation','Narrative Bias','Constructing a tidy story from noisy events.',['Explaining random moves with a clean cause'],['Prefer probabilistic accounts','Resist over-tidy stories'],'Taleb (2007)'],
];

// ---- SCENARIOS across the four supported categories -----------------------
const SC = {
 trading: [
  ['flash-crash','Flash Crash','The market drops 12% in ninety seconds on no clear news. Your position is deep red and the tape is chaotic.'],
  ['gap-down-open','Gap-Down Open','Overnight, your largest holding gaps down 20% on an earnings miss before you can react.'],
  ['parabolic-run','Parabolic Run','A ticker you passed on is up 300% in a week and trending everywhere. It is going vertical right now.'],
  ['margin-call','Margin Call','Your broker issues a margin call at the worst possible moment; you must add funds or be liquidated.'],
  ['stop-run','Stop Hunt','Price spikes just far enough to trigger your stop, then immediately reverses in your original direction.'],
  ['slow-bleed','Slow Bleed','A position drifts against you 1% a day for two weeks with no dramatic moment to force a decision.'],
  ['insider-tip','The Hot Tip','A trusted contact swears a small-cap will double next week and urges you to size up now.'],
  ['rug-pull','Liquidity Vanishes','The token you hold sees its liquidity pulled; the exit is thin and every sell moves the price.'],
  ['fed-surprise','Rate Surprise','The central bank surprises with a larger move than expected and every asset repriced in minutes.'],
  ['double-or-nothing','Double or Nothing','You are up big for the year; a single concentrated bet could double it or erase it before December.'],
  ['profit-target-hit','Target Reached','Your position hits your planned profit target, but momentum looks like it could carry much further.'],
  ['thesis-broken','Thesis Invalidated','New data quietly breaks the core reason you entered, though the price has not moved yet.'],
  ['everyone-selling','Capitulation','Sentiment turns to fear; forums are full of people dumping the exact asset you hold.'],
  ['leverage-offer','Leverage Offer','A platform offers you 10x leverage with a slick interface right after a winning streak.'],
  ['missed-entry','Missed Entry','The setup you waited for triggers while you were away; it is now extended past your entry.'],
 ],
 negotiation: [
  ['lowball-offer','The Lowball','A counterparty opens far below your reservation price and acts as if it is generous.'],
  ['salary-anchor','Salary Anchor','In a job negotiation the recruiter names a number first, well under your target.'],
  ['deadline-pressure','Exploding Offer','The other side imposes a same-day deadline to accept or the deal disappears.'],
  ['split-the-difference','Split the Difference','After hard bargaining, they propose meeting exactly in the middle, which still favors them.'],
  ['take-it-or-leave','Take It or Leave It','The counterpart declares a final price with no room, betting you will not walk.'],
  ['good-cop-bad-cop','Good Cop, Bad Cop','One negotiator is warm and one is hostile, and they trade roles to unsettle you.'],
  ['sunk-relationship','Long Relationship','A long-time partner asks for a concession that quietly erodes your margin.'],
  ['information-asymmetry','Hidden Information','You suspect the other side knows something material they are not disclosing.'],
  ['nibble','The Nibble','After you agree, they ask for one more small concession at signing.'],
  ['walkaway-bluff','The Walkaway','They stand up to leave, testing whether you will chase them with a better offer.'],
  ['multiparty-bid','Competing Bidders','Two buyers are at the table and each is aware the other exists.'],
  ['equity-vs-cash','Equity or Cash','You must choose between guaranteed cash now and a larger uncertain equity stake later.'],
 ],
 social: [
  ['public-callout','Public Callout','Someone criticizes your decision in front of a group whose respect you value.'],
  ['credit-stolen','Credit Taken','A peer presents your idea as their own in a meeting with leadership present.'],
  ['group-consensus','Lone Dissent','Everyone in the room agrees on a plan you believe is wrong.'],
  ['favor-request','The Ask','A well-liked colleague asks a favor that costs you real time you do not have.'],
  ['status-threat','Status Threat','A newcomer is outperforming you and others have started to notice.'],
  ['gossip-invite','The Gossip','A group invites you to pile on someone who is not present.'],
  ['apology-owed','Owed an Apology','You were wronged and the other person acts as if nothing happened.'],
  ['mentor-disagrees','Mentor Disagrees','A respected mentor pushes a path that conflicts with your own read.'],
  ['ghosting','The Silence','An important contact goes quiet after you shared something vulnerable.'],
  ['loyalty-test','Loyalty Test','A friend asks you to take their side in a dispute where they are partly wrong.'],
  ['recognition-withheld','Overlooked','You did the work but someone else got the recognition and no one corrected it.'],
 ],
 crisis: [
  ['sudden-loss','Sudden Loss','An unexpected event wipes out a large chunk of what you had been counting on.'],
  ['reputation-hit','Reputation Hit','A mistake of yours becomes public and spreads faster than you can respond.'],
  ['deadline-collapse','Deadline Collapse','Halfway to a hard deadline the plan fails and there is no obvious path left.'],
  ['betrayal','Betrayal','Someone you trusted with something important used it against you.'],
  ['health-scare','Health Scare','A frightening result arrives before you can get clarity on what it means.'],
  ['forced-choice','Forced Choice','You must choose immediately between two options you would both normally refuse.'],
  ['cascading-failure','Cascade','One failure triggers another and the situation is compounding by the hour.'],
  ['whistleblow','The Discovery','You uncover wrongdoing where speaking up carries real personal cost.'],
  ['resource-drain','Resource Drain','A slow-moving crisis is quietly draining time and money with no clean end.'],
  ['public-panic','Public Panic','Everyone around you is panicking and looking to you for what to do next.'],
 ],
};

// ---- trader / counterparty archetypes -------------------------------------
const ARCH = [
 {tag:'panic-seller',style:'avoidant',lam:2.7,dt:{m:.32,n:.30,p:.20},bf:{openness:.45,conscientiousness:.38,extraversion:.42,agreeableness:.55,neuroticism:.80},bias:['loss-aversion','ostrich-effect','negativity'],
  entry:['enters cautiously and small','waits for obvious confirmation before buying','sizes down after any scare'],stress:['bails at the first sign of red','liquidates into any sharp drawdown','freezes then dumps at the lows'],tell:['checks the P&L compulsively','cannot look when the book is red','sleeps badly holding risk overnight']},
 {tag:'revenge-trader',style:'spontaneous',lam:2.5,dt:{m:.55,n:.62,p:.58},bf:{openness:.55,conscientiousness:.30,extraversion:.62,agreeableness:.38,neuroticism:.76},bias:['loss-aversion','sunk-cost','escalation-of-commitment'],
  entry:['sizes up quickly after a loss','trades bigger to get even','re-enters immediately after a stop-out'],stress:['doubles down on losers to justify the entry','chases the loss with more size','abandons the plan when behind'],tell:['trades hardest right after a stop-out','confuses being right with being whole','treats the market as a personal opponent']},
 {tag:'meme-chaser',style:'spontaneous',lam:1.4,dt:{m:.42,n:.66,p:.44},bf:{openness:.85,conscientiousness:.30,extraversion:.76,agreeableness:.46,neuroticism:.60},bias:['fomo','herd-behavior','recency'],
  entry:['chases whatever is trending','enters late into parabolic moves','buys the loudest ticker in the feed'],stress:['adds into the vertical move','refuses to miss the run','holds through the top expecting more'],tell:['trades the feed, not the thesis','lives for the excitement','narrates every position online']},
 {tag:'disciplined-swing',style:'analytical',lam:1.9,dt:{m:.30,n:.34,p:.22},bf:{openness:.60,conscientiousness:.82,extraversion:.45,agreeableness:.52,neuroticism:.34},bias:['confirmation','anchoring'],
  entry:['enters on a rules-based signal','sizes consistently against a plan','waits for the setup without forcing it'],stress:['honors predefined stops','trims into strength by rule','sits out when conditions are unclear'],tell:['over-weights confirming evidence','journals every trade','reviews mistakes methodically']},
 {tag:'options-gambler',style:'spontaneous',lam:1.3,dt:{m:.58,n:.70,p:.62},bf:{openness:.80,conscientiousness:.34,extraversion:.70,agreeableness:.36,neuroticism:.64},bias:['overconfidence','gamblers-fallacy','illusion-of-control'],
  entry:['buys short-dated options for the payoff','bets on the binary event','swings for the fences on conviction'],stress:['expects a reversal after any streak','presses the bet when it moves','rolls losers into more leverage'],tell:['overrates its own edge','treats variance as skill','remembers the wins, forgets the zeros']},
 {tag:'conservative-hodler',style:'deliberative',lam:2.2,dt:{m:.24,n:.26,p:.16},bf:{openness:.44,conscientiousness:.80,extraversion:.36,agreeableness:.62,neuroticism:.30},bias:['status-quo','endowment'],
  entry:['buys quality and holds','rarely trades, adds slowly','accumulates on a schedule'],stress:['sits through volatility unmoved','is slow to rebalance even when it helps','ignores short-term noise entirely'],tell:['values the position above the market','prefers the current allocation','tunes out the daily tape']},
 {tag:'copy-trader',style:'dependent',lam:1.8,dt:{m:.36,n:.44,p:.30},bf:{openness:.45,conscientiousness:.46,extraversion:.58,agreeableness:.72,neuroticism:.58},bias:['herd-behavior','authority-bias','bandwagon'],
  entry:['mirrors popular traders','enters when the accounts it follows do','waits for a signal from someone it trusts'],stress:['exits a beat behind the crowd','defers to loud authority','panics when the leader goes quiet'],tell:['trades social proof over analysis','always a step late','cannot articulate its own thesis']},
 {tag:'news-reactor',style:'intuitive',lam:2.1,dt:{m:.40,n:.48,p:.38},bf:{openness:.60,conscientiousness:.40,extraversion:.66,agreeableness:.50,neuroticism:.68},bias:['recency','availability','salience'],
  entry:['trades the headline reflexively','reacts before the dust settles','front-runs its own interpretation'],stress:['overweights the latest vivid story','flips on every new print','whipsaws on conflicting reports'],tell:['anchors to whatever is most recent','mistakes noise for signal','trades the emotion of the news']},
 {tag:'scalper',style:'intuitive',lam:1.7,dt:{m:.44,n:.40,p:.42},bf:{openness:.55,conscientiousness:.66,extraversion:.60,agreeableness:.42,neuroticism:.55},bias:['recency','disposition-effect'],
  entry:['scalps intraday for small edges','takes many quick shots','works the order book for ticks'],stress:['cuts winners early for small gains','occasionally lets a loser run','over-trades a quiet session'],tell:['realizes gains too fast','holds losers hoping for scratch','burns out after a hot streak']},
 {tag:'yield-chaser',style:'dependent',lam:1.9,dt:{m:.38,n:.42,p:.34},bf:{openness:.52,conscientiousness:.58,extraversion:.50,agreeableness:.55,neuroticism:.52},bias:['herd-behavior','authority-bias','optimism'],
  entry:['chases the highest advertised yield','trusts popular picks','reaches for return over safety'],stress:['ignores the underlying risk for the number','follows the loudest expert','stays in too long for the carry'],tell:['confuses yield with safety','reaches for return','underprices tail risk']},
 {tag:'contrarian',style:'analytical',lam:2.0,dt:{m:.50,n:.46,p:.30},bf:{openness:.72,conscientiousness:.68,extraversion:.40,agreeableness:.40,neuroticism:.40},bias:['confirmation','overconfidence'],
  entry:['fades the crowd deliberately','buys what others are dumping','takes the unpopular side'],stress:['adds as the crowd presses against it','mistakes being early for being wrong','holds conviction past the evidence'],tell:['enjoys being the lone voice','distrusts consensus reflexively','anchors to a bearish or bullish identity']},
 {tag:'momentum-rider',style:'intuitive',lam:1.6,dt:{m:.40,n:.52,p:.44},bf:{openness:.66,conscientiousness:.56,extraversion:.64,agreeableness:.46,neuroticism:.48},bias:['recency','hot-hand','herd-behavior'],
  entry:['buys strength and sells weakness','rides trends until they break','adds to winners'],stress:['gives back gains at the turn','overstays the trend','confuses a pause for a reversal'],tell:['loves a strong chart','hates sitting in cash','extrapolates the last leg']},
 {tag:'value-hunter',style:'deliberative',lam:2.1,dt:{m:.30,n:.30,p:.20},bf:{openness:.64,conscientiousness:.78,extraversion:.38,agreeableness:.56,neuroticism:.36},bias:['anchoring','confirmation','endowment'],
  entry:['buys on a valuation gap','builds a position patiently','waits years for the thesis'],stress:['averages down on falling knives','anchors to intrinsic value','ignores momentum entirely'],tell:['quotes multiples from memory','distrusts hype','holds through deep drawdowns']},
 {tag:'day-gambler',style:'spontaneous',lam:1.2,dt:{m:.52,n:.66,p:.60},bf:{openness:.70,conscientiousness:.28,extraversion:.72,agreeableness:.38,neuroticism:.66},bias:['gamblers-fallacy','illusion-of-control','overconfidence'],
  entry:['opens the app looking for action','bets on gut most mornings','sizes by mood'],stress:['chases every intraday swing','tilts after a red morning','revenge-sizes to get back to flat'],tell:['cannot sit flat','treats it like a casino','measures the day by dopamine']},
 {tag:'risk-manager',style:'analytical',lam:2.4,dt:{m:.28,n:.24,p:.18},bf:{openness:.58,conscientiousness:.86,extraversion:.40,agreeableness:.54,neuroticism:.34},bias:['zero-risk','ambiguity-aversion'],
  entry:['sizes by volatility and stop distance','never risks more than a fixed fraction','pre-defines the exit before entry'],stress:['cuts fast and small when wrong','reduces gross into uncertainty','protects capital above all'],tell:['thinks in R-multiples','sleeps fine flat','treats survival as job one']},
 {tag:'fomo-buyer',style:'spontaneous',lam:1.5,dt:{m:.36,n:.60,p:.40},bf:{openness:.74,conscientiousness:.34,extraversion:.72,agreeableness:.50,neuroticism:.62},bias:['fomo','bandwagon','recency'],
  entry:['buys after the move has run','fears missing the next leg','enters on social momentum'],stress:['adds at the highs','cannot wait for a pullback','sells at the lows in regret'],tell:['watches everyone else’s gains','buys tops, sells bottoms','trades to relieve anxiety']},
 {tag:'diamond-hands',style:'deliberative',lam:2.6,dt:{m:.34,n:.50,p:.28},bf:{openness:.60,conscientiousness:.62,extraversion:.48,agreeableness:.52,neuroticism:.44},bias:['sunk-cost','endowment','loss-aversion'],
  entry:['commits to a conviction hold','ignores volatility on purpose','buys the dip on principle'],stress:['refuses to sell at any loss','treats holding as identity','doubles down through drawdowns'],tell:['wears the loss as a badge','distrusts anyone who sells','anchors to the entry price']},
 {tag:'algo-fader',style:'analytical',lam:1.8,dt:{m:.48,n:.38,p:.40},bf:{openness:.70,conscientiousness:.74,extraversion:.42,agreeableness:.44,neuroticism:.40},bias:['overconfidence','clustering-illusion'],
  entry:['trades a systematic edge','sizes by backtested expectancy','removes discretion where it can'],stress:['overrides the system under stress','sees signal in noise','tinkers with a working model'],tell:['trusts the numbers over the gut','distrusts stories','fights the urge to intervene']},
 {tag:'social-trader',style:'dependent',lam:1.7,dt:{m:.34,n:.54,p:.34},bf:{openness:.62,conscientiousness:.44,extraversion:.78,agreeableness:.64,neuroticism:.54},bias:['herd-behavior','bandwagon','authority-bias'],
  entry:['trades what the community trades','enters on group hype','seeks confirmation before acting'],stress:['sells when the chat turns fearful','defers to the loudest voice','needs reassurance to hold'],tell:['posts every trade','trades for belonging','cannot hold a lonely position']},
 {tag:'perfectionist',style:'deliberative',lam:2.3,dt:{m:.30,n:.44,p:.22},bf:{openness:.66,conscientiousness:.88,extraversion:.36,agreeableness:.54,neuroticism:.50},bias:['analysis-paralysis','ambiguity-aversion','information-bias'],
  entry:['waits for the perfect setup','over-researches before acting','rarely pulls the trigger'],stress:['misses the move over-analyzing','second-guesses after entry','needs certainty that never comes'],tell:['always one more data point','regrets the trades not taken','treats a loss as a personal failure']},
 {tag:'whale-watcher',style:'intuitive',lam:1.8,dt:{m:.46,n:.50,p:.44},bf:{openness:.64,conscientiousness:.52,extraversion:.58,agreeableness:.46,neuroticism:.52},bias:['authority-bias','availability','herd-behavior'],
  entry:['follows large-wallet flows','front-runs perceived smart money','trades on on-chain signals'],stress:['chases a whale into a trap','over-reads a single transfer','flips on the next big move'],tell:['watches the order flow obsessively','trusts size over thesis','narrates what the whales must know']},
 {tag:'set-and-forget',style:'deliberative',lam:2.0,dt:{m:.26,n:.28,p:.18},bf:{openness:.50,conscientiousness:.76,extraversion:.34,agreeableness:.60,neuroticism:.32},bias:['status-quo','default-effect','omission'],
  entry:['dollar-cost-averages on autopilot','sets it and ignores it','automates contributions'],stress:['does nothing through volatility','forgets to rebalance for months','tunes out drawdowns by design'],tell:['checks the account quarterly at most','prefers rules to decisions','treats inaction as strategy']},
];

// domain tags used to route personas to themed packs
function personaTags(a){
 const base=['trading','retail-trading',a.tag];
 const packs=[];
 if(chance(0.72)) packs.push('robinhood');
 if(chance(0.45)) packs.push('solana');
 if(chance(0.30)) packs.push('defi');
 return [...new Set([...base,...packs])];
}

// ---- general-population profile composition --------------------------------
const DOMAINS = ['career','relationships','money','health','learning','risk','conflict','creativity'];
const OPEN_HI=['seeks out novel experiences','is drawn to abstract ideas','questions established conventions','loves exploring unfamiliar territory'];
const OPEN_LO=['prefers the familiar and proven','is practical and concrete','values tradition and routine','is skeptical of untested ideas'];
const CON_HI=['plans carefully and follows through','keeps commitments meticulously','works in a disciplined, orderly way','rarely leaves loose ends'];
const CON_LO=['works in bursts and improvises','is flexible to the point of disorganized','resists rigid schedules','follows impulse over plan'];
const EXT_HI=['is energized by people and action','thinks out loud and moves fast','seeks the center of the room','recharges through social contact'];
const EXT_LO=['prefers depth over breadth of contact','recharges alone and reflects','is reserved until trust is earned','speaks little but observes closely'];
const AGR_HI=['gives others the benefit of the doubt','avoids conflict to keep the peace','is quick to cooperate and help','reads others’ feelings carefully'];
const AGR_LO=['bargains hard and guards their interests','is blunt and comfortable with friction','trusts only what is proven','competes rather than accommodates'];
const NEU_HI=['feels stress vividly and early','is sensitive to threat and loss','ruminates on what might go wrong','swings with the emotional weather'];
const NEU_LO=['stays calm under pressure','recovers quickly from setbacks','is even-keeled and hard to rattle','treats stress as background noise'];
const traitPhrase=(bf)=>[
 bf.openness>0.5?pick(OPEN_HI):pick(OPEN_LO),
 bf.conscientiousness>0.5?pick(CON_HI):pick(CON_LO),
 bf.extraversion>0.5?pick(EXT_HI):pick(EXT_LO),
 bf.agreeableness>0.5?pick(AGR_HI):pick(AGR_LO),
 bf.neuroticism>0.5?pick(NEU_HI):pick(NEU_LO),
];
function profileSummary(bf){
 const p=traitPhrase(bf); const two=pickN(p,2);
 const dom=pick(DOMAINS);
 return `In ${dom} decisions, ${two[0]} and ${two[1]}. ${cap(pick(p))}.`;
}
const ALLBIAS = BIAS.map(b=>b[0]);

// ============================================================================
// GENERATION
// ============================================================================
const files = {};

// --- 1. biases.sql ---
{
 const vals = BIAS.map(([slug,name,desc,ex,mit,src])=>
   `('${esc(slug)}','${esc(name)}','${esc(desc)}','${jesc(ex)}'::jsonb,'${jesc(mit)}'::jsonb,'${esc(src)}')`);
 files['biases.sql'] =
`-- Cognitive-bias taxonomy: ${BIAS.length} literature-grounded entries.
-- Feeds the cognitive-bias-simulator product. Idempotent on slug.
`+chunked('INSERT INTO biases (slug, name, description, examples, mitigations, source) VALUES', vals, 'ON CONFLICT (slug) DO NOTHING');
}

// --- 2. scenarios.sql (explicit ids reused by responses) ---
const scenarioIndex = []; // {id, slug, category, title, description}
{
 const vals=[];
 for(const [category,list] of Object.entries(SC)){
   for(const [slug,title,description] of list){
     const id=uuid();
     scenarioIndex.push({id,slug,category,title,description});
     vals.push(`('${id}','${esc(slug)}','${esc(category)}','${esc(title)}','${esc(description)}')`);
   }
 }
 files['scenarios.sql'] =
`-- ${scenarioIndex.length} scenarios across trading / negotiation / social / crisis.
`+chunked('INSERT INTO scenarios (id, slug, category, title, description) VALUES', vals, 'ON CONFLICT (slug) DO NOTHING');
}

// --- 3. profiles.sql (general population) ---
const N_PROFILES = 1200;
const profileIndex = []; // {id, tags, archetypeless}
{
 const vals=[];
 for(let i=0;i<N_PROFILES;i++){
   const bf={openness:clamp(rng()),conscientiousness:clamp(rng()),extraversion:clamp(rng()),agreeableness:clamp(rng()),neuroticism:clamp(rng())};
   const dt={machiavellianism:clamp(0.15+rng()*0.7),narcissism:clamp(0.15+rng()*0.7),psychopathy:clamp(0.10+rng()*0.6)};
   const lambda=r2(1.0+rng()*2.0), alpha=r2(0.7+rng()*0.28), beta=r2(0.7+rng()*0.28);
   const sysPref = bf.conscientiousness*0.6 + (1-bf.neuroticism)*0.4 > 0.5 ? 'system2':'system1';
   const crt = clamp(bf.conscientiousness*0.5 + bf.openness*0.3 + rng()*0.3);
   const style = pick(STYLES);
   const ml = mbti(bf);
   const sb = pickN(ALLBIAS, 2+Math.floor(rng()*3)).map((s,j)=>({slug:s,strength:r2(0.4+rng()*0.5-j*0.05)}));
   const summary = profileSummary(bf);
   const tags = ['general-population', style, `mbti-${ml.toLowerCase()}`];
   if(dt.machiavellianism>0.6||dt.narcissism>0.6||dt.psychopathy>0.55) tags.push('dark-triad-elevated');
   if(bf.neuroticism>0.7) tags.push('high-neuroticism');
   if(bf.conscientiousness>0.7) tags.push('high-conscientiousness');
   const content={big_five:bf,dark_triad:dt,prospect_theory:{lambda,alpha,beta},cognitive_reflection:{system_preference:sysPref,crt_score:crt},summary,decision_style:style,mbti_label:ml,suggested_biases:sb,tags};
   const q = r2(0.72+rng()*0.20);
   const id=uuid();
   profileIndex.push({id,tags,kind:'general'});
   vals.push(`('${id}','${jesc(content)}'::jsonb,'${jesc(bf)}'::jsonb,'${ml}','${esc(style)}','${esc(summary)}',${arr(tags)},'approved',${q})`);
 }
 files['profiles.sql'] =
`-- ${N_PROFILES} general-population profiles (Big Five + Dark Triad + prospect theory
-- + cognitive reflection). status=approved so they serve immediately. Idempotent on id.
`+chunked('INSERT INTO profiles (id, content, big_five, mbti_label, decision_style, summary, tags, status, quality_score) VALUES', vals, 'ON CONFLICT (id) DO NOTHING');
}

// --- 4. personas.sql (trader counterparties) ---
const PER_ARCH = 55; // ~55 * 22 archetypes = 1210
const personaIndex = []; // {id, tag, style, dt, bf}
{
 const vals=[];
 for(const a of ARCH){
   for(let i=0;i<PER_ARCH;i++){
     const bf={openness:jit(a.bf.openness),conscientiousness:jit(a.bf.conscientiousness),extraversion:jit(a.bf.extraversion),agreeableness:jit(a.bf.agreeableness),neuroticism:jit(a.bf.neuroticism)};
     const dt={machiavellianism:jit(a.dt.m,0.10),narcissism:jit(a.dt.n,0.10),psychopathy:jit(a.dt.p,0.10)};
     const lambda=r2(a.lam+(rng()*0.6-0.3)), alpha=0.88, beta=0.88;
     const sysPref = bf.conscientiousness>0.6?'system2':'system1';
     const crt = clamp(bf.conscientiousness*0.6+rng()*0.2);
     const ml = mbti(bf);
     const summary = `${cap(pick(a.entry))} and ${pick(a.stress)}. ${cap(pick(a.tell))}.`;
     const sb = a.bias.map((s,j)=>({slug:s,strength:r2(j===0?0.72:0.56)}));
     const tags = personaTags(a);
     const content={big_five:bf,dark_triad:dt,prospect_theory:{lambda,alpha,beta},cognitive_reflection:{system_preference:sysPref,crt_score:crt},summary,decision_style:a.style,mbti_label:ml,suggested_biases:sb,tags,archetype:a.tag};
     const q = r2(0.76+rng()*0.16);
     const id=uuid();
     personaIndex.push({id,tag:a.tag,style:a.style,arch:a});
     vals.push(`('${id}','${jesc(content)}'::jsonb,'${jesc(bf)}'::jsonb,'${ml}','${esc(a.style)}','${esc(summary)}',${arr(tags)},'approved',${q})`);
   }
 }
 files['personas.sql'] =
`-- ${personaIndex.length} retail-trading counterparty personas across ${ARCH.length} archetypes.
-- Tagged retail-trading/robinhood/solana so they serve the themed packs. Idempotent on id.
`+chunked('INSERT INTO profiles (id, content, big_five, mbti_label, decision_style, summary, tags, status, quality_score) VALUES', vals, 'ON CONFLICT (id) DO NOTHING');
}

// --- 5. responses.sql (profile-conditioned) ---
// per-archetype reaction fragments keyed by scenario category
const REACT = {
 trading:{
  panic:['sells everything at the worst tick','freezes, then liquidates near the low','cuts the whole position on impulse'],
  chase:['adds to the position anyway','sizes up into the move','can’t resist and buys more'],
  hold:['does nothing and waits it out','honors the plan and holds','sits on hands deliberately'],
  rules:['follows the written stop','executes the pre-set exit','sizes by the rule, no more'],
 },
 negotiation:{
  panic:['concedes quickly to end the tension','accepts a poor deal to avoid conflict','caves at the deadline'],
  chase:['counters aggressively to win','pushes for more out of pride','escalates the ask'],
  hold:['holds the reservation price calmly','lets silence do the work','waits without flinching'],
  rules:['anchors to a prepared number','walks if it crosses the line','trades concessions by plan'],
 },
 social:{
  panic:['withdraws and avoids the person','ruminates instead of addressing it','defers to keep the peace'],
  chase:['confronts loudly and publicly','makes it about status','needs to be seen winning'],
  hold:['addresses it privately and calmly','states the boundary once','lets it go without resentment'],
  rules:['sticks to the facts','separates the issue from the person','follows a considered response'],
 },
 crisis:{
  panic:['spirals and reacts to each new blow','makes a rushed irreversible choice','looks for someone to blame'],
  chase:['takes a bold gamble to reverse it','doubles down to force a fix','acts fast to feel in control'],
  hold:['stabilizes first, then decides','triages calmly and buys time','protects the essentials'],
  rules:['works the checklist','contains the damage methodically','decides on principle, not panic'],
 },
};
function reactBucket(arch){
 const n=arch.bf.neuroticism, c=arch.bf.conscientiousness, style=arch.style;
 if(style==='analytical'||style==='deliberative'||arch.tag==='risk-manager') return c>0.7?'rules':'hold';
 if(n>0.68 && (arch.tag.includes('panic')||arch.tag==='perfectionist'||style==='avoidant')) return 'panic';
 if(arch.tag.includes('chaser')||arch.tag.includes('gambler')||arch.tag.includes('revenge')||arch.tag.includes('fomo')||arch.tag.includes('momentum')) return 'chase';
 return pick(['panic','chase','hold','rules']);
}
const AROUSAL=['calm','tense','anxious','excited','detached','defensive','resolute'];
const N_RESP_TARGET = 1800;
{
 const gen_id = uuid();
 const run_id = uuid();
 const byCat = scenarioIndex.reduce((m,s)=>{(m[s.category]=m[s.category]||[]).push(s);return m;},{});
 const vals=[];
 // personas: weight toward trading scenarios (their domain), plus one cross-category
 const pool = [...personaIndex];
 // shuffle deterministically
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 let count=0;
 for(const p of pool){
   if(count>=N_RESP_TARGET) break;
   const arch=p.arch;
   const scs=[pick(byCat.trading), chance(0.5)?pick(byCat.trading):pick([...byCat.crisis,...byCat.social,...byCat.negotiation])];
   for(const s of scs){
     if(count>=N_RESP_TARGET) break;
     const bucket=reactBucket(arch);
     const react=pick(REACT[s.category][bucket]);
     const tell=pick(arch.tell), stress=pick(arch.stress);
     const response=`Faced with "${s.title.toLowerCase()}", this ${arch.tag.replace(/-/g,' ')} ${react}. It ${stress}.`;
     const disp = bucket==='rules'?'high self-control':bucket==='panic'?'high threat-sensitivity':bucket==='chase'?'reward-seeking':'steady';
     const reasoning=`Their profile (${arch.style} style, ${disp} under stress) drives the move: ${cap(tell)}, and the ${s.category} pressure amplifies ${arch.bias[0].replace(/-/g,' ')}.`;
     const arc=`${cap(pick(AROUSAL))} → ${pick(AROUSAL)} → ${bucket==='panic'?'regret':bucket==='rules'?'composure':bucket==='chase'?'adrenaline':'acceptance'}`;
     const conf=r2(bucket==='rules'?0.7+rng()*0.25:bucket==='panic'?0.45+rng()*0.3:0.55+rng()*0.35);
     vals.push(`('${uuid()}','${p.id}','${s.id}','${esc(response)}','${esc(reasoning)}','${esc(arc)}',${conf},'${run_id}')`);
     count++;
   }
 }
 files['responses.sql'] =
`-- ${count} profile-conditioned scenario responses. References the personas + scenarios
-- loaded above. Self-contained: creates its own generator + generation_run first.
INSERT INTO generators (slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES ('procedural-bulk', 1, 'profile_scenario_response', 'Procedural bulk response generator (seeded, zero-inference).',
 'procedural', '{}'::jsonb, '{}'::jsonb, '{"provider":"procedural","model":"seeded-v1"}'::jsonb, '[]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, status, finished_at)
VALUES ('${run_id}', (SELECT id FROM generators WHERE slug='procedural-bulk' AND version=1 LIMIT 1),
 'procedural-bulk', 1, '{"seed":${SEED}}'::jsonb, 'seeded-v1', ${count}, ${count}, 'done', now())
ON CONFLICT (id) DO NOTHING;

`+chunked('INSERT INTO profile_scenario_responses (id, profile_id, scenario_id, response, reasoning_chain, emotional_arc, confidence, generation_run_id) VALUES', vals, 'ON CONFLICT (id) DO NOTHING');
}

// ---- write files ----
let total=0;
for(const [name,sql] of Object.entries(files)){
 writeFileSync(OUT+name, sql);
 const rows=(sql.match(/\n\('/g)||[]).length + (sql.match(/VALUES\n\('/g)||[]).length;
 console.log(`wrote ${name.padEnd(16)} ${(sql.length/1024).toFixed(0)}KB`);
}
console.log('\ncounts:');
console.log('  biases   ', BIAS.length);
console.log('  scenarios', scenarioIndex.length);
console.log('  profiles ', profileIndex.length);
console.log('  personas ', personaIndex.length);
console.log('  responses (target)', N_RESP_TARGET);
