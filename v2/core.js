// HelpCenter Core — shared logic for all variants
// Content loading, search, routing, step state, branch logic

const DISCORD_SUPPORT = 'https://discord.com/channels/1253075447848243361/1273676808436453447';

const CATEGORIES = [
  { id: 'connect', title: "I can't open or play the game", short: 'Game & connection', description: 'Loading, sign-in, room entry, black screens, and disconnects.' },
  { id: 'nightmare', title: 'Nightmare, Keys & AP', short: 'Nightmare, Keys & AP', description: 'Nightmare sessions, Keys, AP, multipliers, and squad problems.' },
  { id: 'craft', title: 'Craft, NFTs & Dust', short: 'Craft, NFTs & Dust', description: 'Dust balances and costs, Craft actions, and missing or incorrect NFTs.' },
  { id: 'purchases', title: 'Purchases, claims & rewards', short: 'Purchases & rewards', description: 'Paid items, Shop delivery, claims, ads, and reward status.' },
  { id: 'account', title: 'Account, login & wallets', short: 'Account & wallets', description: 'Sign-in identity, linked wallets, Main Wallet, restrictions, and security.' },
  { id: 'progress', title: 'Leaderboard, referrals & Glider', short: 'Leaderboard & Glider', description: 'Rank updates, referral stages, and Glider verification or rewards.' }
];

const ISSUE_ALIASES = {
  'purchase-not-received': ['purchase missing', 'paid but no item', 'payment successful', 'base pay', 'crossmint', 'booster', 'threat', 'lootbox'],
  'nightmare-did-not-start': ['nightmare not starting', 'no virus', 'key deducted', 'nightmare room'],
  'game-wont-load': ['black screen', 'loading', 'cannot sign in', 'stuck loading', 'base app reload'],
  'dust-balance-incorrect': ['dust 0', 'no resources', 'missing dust', 'dust cost', 'dust balance'],
  'main-wallet-connection': ['wrong wallet', 'main wallet', 'wallet mismatch', 'connected wallet'],
  'wallet-security': ['hacked', 'scam', 'seed phrase', 'private key', 'unexpected transaction', 'compromised'],
  'cant-join-room': ['code0', 'code 0', 'code(0)', 'code 4001', '4001', 'code 1006', '1006', 'room error', 'unknown error'],
  'lag-and-disconnects': ['lag', 'disconnect', 'reconnect', 'freeze', 'match stopped'],
  'nightmare-key-missing': ['lost key', 'missing key', 'double spent key', 'key removed twice', 'key reset'],
  'ap-missing-or-incorrect': ['ap zero', 'activity points', 'missing multiplier', 'ap wrong', 'multiplier'],
  'craft-action-failed': ['claim disappeared', 'claim failed', 'upgrade failed', 'dismantle failed', 'wrong nft burned', 'craft stuck'],
  'nft-not-showing': ['missing nft', 'nft metadata', 'token not visible', 'opensea', 'mint missing'],
  'ads-or-roulette-not-working': ['ads unavailable', 'watch and spin', 'roulette', 'ad reward', 'ad will not load'],
  'wallet-already-linked': ['wallet linked', 'duplicate account', 'new empty account', 'original account', 'login wrong account'],
  'leaderboard-not-updated': ['rank missing', 'leaderboard stale', 'ap rank', 'rank not updated'],
  'referral-not-counted': ['referral', 'invite', 'revenue share', 'referral payout', 'purchase attribution'],
  'glider-verification-or-reward': ['glider pending', 'portfolio verification', 'second verification', 'unstake', 'glider reward']
};

const COMMON_IDS = ['purchase-not-received', 'game-wont-load', 'nightmare-did-not-start', 'dust-balance-incorrect', 'cant-join-room', 'wallet-already-linked'];

const BRANCH_CHOICES = {
  'purchase-not-received:0': [
    { label: 'Pending', note: 'Wait safely. Do not repeat the purchase while the payment is pending.', terminal: 'safe' },
    { label: 'Successful', note: 'The payment completed. Continue to check the CoC account and delivery.', terminal: 'continue' },
    { label: 'Failed or cancelled', note: 'Delivery is not expected from this attempt. Keep the receipt if the provider still charged you.', terminal: 'safe' },
    { label: "I can’t find it", note: 'Continue without guessing. The later support path will list the details you can provide.', terminal: 'continue' }
  ],
  'nightmare-did-not-start:0': [
    { label: 'A Key was removed', note: 'Do not use another Key. Continue to classify whether a playable session existed.', terminal: 'continue' },
    { label: 'No Key was removed', note: 'This is more likely a room-entry problem. Open the related room-entry guide.', terminal: 'related', related: 'cant-join-room' },
    { label: "I can’t tell", note: 'Do not test with another Key. Continue with the information you have.', terminal: 'continue' }
  ],
  'cant-join-room:0': [
    { label: 'Only one room fails', note: 'Avoid that room and note any in-game notices before trying it again.', terminal: 'safe' },
    { label: 'All free rooms fail', note: 'Continue to reset the local room session safely.', terminal: 'continue' },
    { label: "I can’t check", note: 'Continue without using a paid item or Nightmare Key as a test.', terminal: 'continue' }
  ],
  'craft-action-failed:0': [
    { label: 'Wrong NFT or irreversible result', note: 'Stop all Craft actions. Do not change wallets or submit another transaction; continue only to collect the private-support details.', terminal: 'continue' },
    { label: 'Pending', note: 'Wait safely. Do not submit the action again while the transaction is pending.', terminal: 'safe' },
    { label: 'Failed or reverted', note: 'Keep the error and receipt. Do not assume a network fee will be returned.', terminal: 'continue' },
    { label: 'Successful', note: 'Continue to verify wallet identity and the delivered result without another transaction.', terminal: 'continue' },
    { label: 'No transaction found', note: 'Continue to check the selected wallet before attempting any new action.', terminal: 'continue' }
  ],
  'glider-verification-or-reward:0': [
    { label: 'A waiting window is shown', note: 'Wait for the exact window displayed by Glider. An old duration from Discord may not apply.', terminal: 'safe' },
    { label: 'Verification or claim', note: 'Continue to verify the submitted portfolio and balance.', terminal: 'continue' },
    { label: "I can’t identify the stage", note: 'Continue with the portfolio details you can see.', terminal: 'continue' }
  ],
  'ap-missing-or-incorrect:0': [
    { label: 'Live display differs from result', note: 'This is likely a display issue. The result screen value is more reliable.', terminal: 'safe' },
    { label: 'Result AP looks wrong', note: 'Continue to compare with your personal AP total.', terminal: 'continue' },
    { label: 'Personal total is wrong', note: 'Continue to check for multiplier or event differences.', terminal: 'continue' },
    { label: 'Leaderboard is stale', note: 'If your personal total is correct, this is a leaderboard update delay.', terminal: 'related', related: 'leaderboard-not-updated' }
  ],
  'ads-or-roulette-not-working:0': [
    { label: 'No ads are loading', note: 'Ad availability depends on your region and provider. This may be temporary.', terminal: 'continue' },
    { label: 'Ad plays but crashes', note: 'Note the error and continue to try basic fixes.', terminal: 'continue' },
    { label: 'Watched but no reward', note: 'Do not watch another ad. Keep the exact completion time and continue only to check delivery and prepare private-support evidence.', terminal: 'continue' },
    { label: 'Cooldown or limit reached', note: 'Daily limits reset. Wait and try again later.', terminal: 'safe' }
  ],
  'wallet-already-linked:0': [
    { label: 'I signed in and see the wrong account', note: 'Continue to verify which sign-in method matches your original account.', terminal: 'continue' },
    { label: 'A new empty account opened', note: 'Do not progress or level this account. Continue to find your original sign-in.', terminal: 'continue' },
    { label: 'Wallet says already linked', note: 'Continue to check which account owns this wallet address.', terminal: 'continue' }
  ]
};

class HelpCenter {
  constructor() {
    this.content = null;
    this.stepStates = {};
    this.variantId = '';
  }

  async loadContent() {
    const res = await fetch('data/support-content.json');
    this.content = await res.json();
    return this.content;
  }

  isPublished(issue) {
    return issue?.governance?.publicationState === 'published';
  }

  getIssue(id) {
    const issue = this.content?.issues?.find(i => i.id === id) || null;
    return this.isPublished(issue) ? issue : null;
  }

  getCategory(id) {
    return CATEGORIES.find(c => c.id === id) || null;
  }

  getCategoryIssues(categoryId) {
    return (this.content?.issues || []).filter(i => i.category === categoryId && this.isPublished(i));
  }

  getCommonIssues() {
    return COMMON_IDS.map(id => this.getIssue(id)).filter(Boolean);
  }

  getBranches(issueId, stepIndex) {
    return BRANCH_CHOICES[`${issueId}:${stepIndex}`] || null;
  }

  search(query) {
    if (!query || !this.content) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const scored = [];
    for (const issue of this.content.issues) {
      if (!this.isPublished(issue)) continue;
      let score = 0;
      const title = issue.title.toLowerCase();
      if (title.includes(q)) score += 10;
      if (title === q) score += 5;
      const aliases = ISSUE_ALIASES[issue.id] || [];
      for (const a of aliases) {
        if (a.includes(q) || q.includes(a)) { score += 8; break; }
      }
      const problem = (issue.problem || '').toLowerCase();
      if (problem.includes(q)) score += 3;
      if (score > 0) scored.push({ issue, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.issue).slice(0, 7);
  }

  isLimited(issue) {
    return issue?.governance?.publicationState === 'limited';
  }

  hasSplitInfo(issue) {
    return !!issue?.splitInfo;
  }

  getOutcomeTerminals(issue) {
    return issue?.outcomeTerminals || null;
  }

  getStepState(issueId) {
    if (!this.stepStates[issueId]) {
      this.stepStates[issueId] = { currentStep: 0, completed: {}, branchChoices: {}, solved: false, exhausted: false };
    }
    return this.stepStates[issueId];
  }

  advanceStep(issueId) {
    const state = this.getStepState(issueId);
    const issue = this.getIssue(issueId);
    if (!issue) return;
    state.completed[state.currentStep] = true;
    if (state.currentStep < issue.fixes.length - 1) {
      state.currentStep++;
    } else {
      state.exhausted = true;
    }
  }

  markSolved(issueId) {
    const state = this.getStepState(issueId);
    state.solved = true;
  }

  selectBranch(issueId, stepIndex, choiceIndex) {
    const state = this.getStepState(issueId);
    state.branchChoices[stepIndex] = choiceIndex;
  }

  resetIssue(issueId) {
    delete this.stepStates[issueId];
  }

  generateCopyDetails(issueId) {
    const issue = this.getIssue(issueId);
    const state = this.getStepState(issueId);
    if (!issue) return '';
    const lines = [`Problem: ${issue.title}`];
    for (const [stepIdx, choiceIdx] of Object.entries(state.branchChoices)) {
      const branches = this.getBranches(issueId, parseInt(stepIdx));
      if (branches && branches[choiceIdx]) {
        lines.push(`Step ${parseInt(stepIdx) + 1}: ${branches[choiceIdx].label}`);
      }
    }
    const completedSteps = Object.keys(state.completed).map(Number).sort();
    for (const idx of completedSteps) {
      if (!state.branchChoices[idx] && issue.fixes[idx]) {
        lines.push(`Tried: ${issue.fixes[idx].title}`);
      }
    }
    return lines.join('\n');
  }

  parseHash() {
    const hash = location.hash.slice(1) || 'home';
    const [path, queryStr] = hash.split('?');
    const parts = path.split('/');
    const params = {};
    if (queryStr) {
      for (const pair of queryStr.split('&')) {
        const [k, v] = pair.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    return { view: parts[0], slug: parts[1], params };
  }
}

// Escape HTML
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Expose globals
window.HelpCenter = HelpCenter;
window.CATEGORIES = CATEGORIES;
window.COMMON_IDS = COMMON_IDS;
window.DISCORD_SUPPORT = DISCORD_SUPPORT;
window.BRANCH_CHOICES = BRANCH_CHOICES;
window.ISSUE_ALIASES = ISSUE_ALIASES;
window.esc = esc;
