// V2-Bento: Asymmetric grid dashboard layout
const hc = new HelpCenter();
hc.variantId = 'v2-bento';
const app = document.getElementById('app');

hc.loadContent().then(() => { window.addEventListener('hashchange', route); route(); });

function route() {
  const { view, slug, params } = hc.parseHash();
  app.innerHTML = '';
  switch (view) {
    case 'category': renderCategory(slug); break;
    case 'problem': renderProblem(slug); break;
    case 'problems': renderAllProblems(); break;
    case 'search': renderSearchPage(params.q || ''); break;
    default: renderHome();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderHome() {
  const common = hc.getCommonIssues();
  app.innerHTML = `
    <h1 class="home-title">How can we help?</h1>
    <div class="search-wrap">
      <span class="search-icon">⌕</span>
      <input class="search-input" type="search" placeholder="Describe the problem or enter an error code" aria-label="Search problems" autocomplete="off">
      <div class="search-results" role="listbox"></div>
    </div>
    <div class="search-hint">Try: purchase missing · CODE(0) · Dust balance · wallet compromised</div>
    <div class="section-label">Common problems</div>
    <div class="common-grid">${common.map(i =>
      `<div class="common-card" data-issue="${i.id}" role="button" tabindex="0"><span>${esc(i.title)}</span><span class="chevron">›</span></div>`
    ).join('')}</div>
    <div class="section-label">Browse by topic</div>
    <div class="bento-grid">${CATEGORIES.map((c, idx) => {
      const count = hc.getCategoryIssues(c.id).length;
      const large = idx === 0 || idx === 3 ? ' large' : '';
      return `<div class="bento-card${large}" data-cat="${c.id}" role="button" tabindex="0">
        <div><div class="card-count">${count}</div><div class="card-title">${esc(c.short)}</div><div class="card-desc">${esc(c.description)}</div></div>
        <div class="card-chevron">→</div>
      </div>`;
    }).join('')}</div>`;
  setupSearch();
  bindAll();
}

function renderCategory(slug) {
  const cat = hc.getCategory(slug);
  if (!cat) { location.hash = '#home'; return; }
  const issues = hc.getCategoryIssues(slug);
  app.innerHTML = `
    <div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <span>${esc(cat.short)}</span></div>
    <h1 class="cat-title">${esc(cat.short)}</h1>
    <p class="cat-desc">${esc(cat.description)}</p>
    <div class="cat-issues">${issues.map(i => issueRow(i)).join('')}</div>`;
  bindAll();
}

function renderAllProblems() {
  let html = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <span>All problems</span></div><h1 class="cat-title">All problems</h1>`;
  for (const cat of CATEGORIES) {
    const issues = hc.getCategoryIssues(cat.id);
    html += `<div class="section-label">${esc(cat.short)}</div><div class="cat-issues">${issues.map(i => issueRow(i)).join('')}</div>`;
  }
  app.innerHTML = html;
  bindAll();
}

function renderProblem(slug) {
  const issue = hc.getIssue(slug);
  if (!issue) { location.hash = '#home'; return; }
  const cat = hc.getCategory(issue.category);
  const state = hc.getStepState(slug);
  const isWS = slug === 'wallet-security';
  const outcomes = hc.getOutcomeTerminals(issue);

  // Side rail
  const sideHtml = `<div class="article-side">
    <div class="side-card"><h4>On this page</h4>
      <a href="javascript:void(0)">Possible fixes</a>
      <a href="javascript:void(0)">Related problems</a>
    </div>
    ${issue.relatedProblems?.length ? `<div class="side-card"><h4>Related</h4>${issue.relatedProblems.map(rid => {
      const r = hc.getIssue(rid);
      return r ? `<a href="#problem/${rid}">${esc(r.title)}</a>` : '';
    }).join('')}</div>` : ''}
  </div>`;

  let main = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <a href="#category/${issue.category}">${esc(cat?.short || '')}</a></div>
    <h2 class="article-title">${esc(issue.title)}</h2>
    <p class="article-problem">${esc(issue.problem)}</p>`;

  if (hc.isLimited(issue)) main += `<div class="limited-notice">${esc(issue.limitedNotice || 'This article has not been fully verified.')}</div>`;
  if (issue.caution) main += `<div class="caution-box">${esc(issue.caution)}</div>`;
  if (issue.whatMayBeHappening?.length) {
    main += `<div class="what-happening"><div class="what-happening-title">What may be happening</div><ul>${issue.whatMayBeHappening.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  }
  if (issue.splitInfo) main += `<div class="split-banner">This problem has several distinct causes. First identify which applies: ${issue.splitInfo.splitBranches.map(b => b.replace(/-/g,' ')).join(', ')}.</div>`;

  if (state.solved) {
    main += `<div class="solved-panel"><h3>Glad that worked</h3><a href="#home">Back to all problems</a></div>`;
    app.innerHTML = `<div class="article-wrap"><div class="article-main">${main}</div>${sideHtml}</div>`;
    return;
  }

  main += `<div class="fixes-label">Possible fixes</div>`;
  main += renderSteps(slug, issue, state);

  if (isWS && outcomes && state.exhausted) main += renderOutcomes(slug, outcomes);
  if (state.exhausted && !isWS) { main += renderRelated(issue); main += renderDiscord(issue); }

  app.innerHTML = `<div class="article-wrap"><div class="article-main">${main}</div>${sideHtml}</div>`;
  bindStepActions(slug);
}

function renderSteps(slug, issue, state) {
  let html = '';
  for (let i = 0; i < issue.fixes.length; i++) {
    const fix = issue.fixes[i];
    const active = i === state.currentStep && !state.exhausted;
    const completed = !!state.completed[i];
    const future = i > state.currentStep && !state.exhausted;
    const cls = active ? 'active' : completed ? 'completed' : future ? 'future' : '';
    const branches = hc.getBranches(slug, i);
    const chosen = state.branchChoices[i];

    html += `<div class="fix-step ${cls}"><div class="fix-header" tabindex="0" role="button" aria-expanded="${active}"><span class="fix-num">${completed ? '✓' : i+1}</span><span>${esc(fix.title)}${completed && chosen!=null && branches ? ': '+esc(branches[chosen].label) : ''}</span></div>`;
    if (active) {
      html += `<div class="fix-body"><div class="action">${esc(fix.action)}</div><div class="expected">${esc(fix.expected)}</div>`;
      if (fix.ambiguityNote) html += `<div class="ambiguity">${esc(fix.ambiguityNote)}</div>`;
      if (fix.next) html += `<div class="next-text">${esc(fix.next)}</div>`;
      if (branches) {
        html += `<div class="branch-list">${branches.map((b,bi) => `<button class="branch-btn${chosen===bi?' selected':''}" data-issue="${slug}" data-step="${i}" data-branch="${bi}">${esc(b.label)}</button>`).join('')}</div>`;
        if (chosen != null) {
          const c = branches[chosen];
          html += `<div class="branch-note">${esc(c.note)}</div>`;
          if (c.terminal === 'safe') html += `<div class="step-actions"><button class="btn btn-success" data-solved="${slug}">This fixed it</button></div>`;
          else if (c.terminal === 'related' && c.related) html += `<div class="step-actions"><a class="btn btn-primary" href="#problem/${c.related}">Open related guide</a></div>`;
          else html += `<div class="step-actions"><button class="btn btn-primary" data-advance="${slug}">Next fix</button><button class="btn btn-ghost" data-advance="${slug}">Already tried</button></div>`;
        }
      } else {
        html += `<div class="step-actions"><button class="btn btn-success" data-solved="${slug}">This fixed it</button><button class="btn btn-primary" data-advance="${slug}">Next fix</button><button class="btn btn-ghost" data-advance="${slug}">Skip</button></div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  return html;
}

function renderOutcomes(issueId, outcomes) {
  let html = `<div class="fixes-label" style="margin-top:20px">What describes your situation?</div><div class="outcome-list">${outcomes.map(o => `<button class="outcome-btn" data-outcome="${o.id}" data-issue="${issueId}">${esc(o.label)}</button>`).join('')}</div><div class="outcome-result-container"></div>`;
  return html;
}
function renderRelated(issue) {
  if (!issue.relatedProblems?.length) return '';
  return `<div class="related-section"><div class="related-label">Try a related problem first</div>${issue.relatedProblems.map(rid => { const r = hc.getIssue(rid); return r ? `<a class="related-link" href="#problem/${rid}">${esc(r.title)}</a>` : ''; }).join('')}</div>`;
}
function renderDiscord(issue) {
  const fb = hc.content.commonFallback;
  const details = hc.generateCopyDetails(issue.id);
  return `<div class="discord-fallback"><h3>${esc(fb.heading)}</h3><p>${esc(fb.body)}</p><a class="discord-link" href="${DISCORD_SUPPORT}" target="_blank" rel="noopener noreferrer">${esc(fb.cta)} ↗</a><button class="btn btn-ghost copy-btn" data-copy="${esc(details)}">Copy details</button><p class="existing-ticket">${esc(fb.existingTicket)}</p><p class="safety-note">${esc(fb.safety)}</p><p style="font-size:10px;color:var(--dim);margin-top:6px">This page has not sent a support request.</p></div>`;
}
function renderSearchPage(query) {
  const results = hc.search(query);
  app.innerHTML = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <span>Search</span></div><h1 class="cat-title">Search: ${esc(query)}</h1>${results.length ? `<div class="cat-issues">${results.map(i => issueRow(i)).join('')}</div>` : '<p style="color:var(--muted);font-size:13px;margin-top:12px">No exact match. Try fewer words or <a href="#problems">browse topics</a>.</p>'}`;
  bindAll();
}
function issueRow(issue) {
  const limited = hc.isLimited(issue) ? ' limited' : '';
  return `<div class="issue-row${limited}" data-issue="${issue.id}" role="button" tabindex="0"><span>${esc(issue.title)}</span><span class="chevron">›</span></div>`;
}

function setupSearch() {
  const input = app.querySelector('.search-input');
  const box = app.querySelector('.search-results');
  if (!input || !box) return;
  let debounce, activeIdx = -1;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = input.value.trim();
      if (!q) { box.innerHTML = ''; activeIdx = -1; return; }
      const results = hc.search(q);
      if (!results.length) { box.innerHTML = `<div class="search-no-match">No exact match. Try fewer words or browse topics.</div>`; activeIdx = -1; return; }
      activeIdx = -1;
      box.innerHTML = results.map(r => { const cat = hc.getCategory(r.category); return `<div class="search-result" data-issue="${r.id}" tabindex="-1"><div>${esc(r.title)}</div><div class="cat">${esc(cat?.short || '')}</div></div>`; }).join('');
      box.querySelectorAll('.search-result').forEach(el => { el.addEventListener('click', () => { location.hash = `#problem/${el.dataset.issue}`; }); });
    }, 180);
  });
  input.addEventListener('keydown', e => {
    const items = box.querySelectorAll('.search-result');
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx+1, items.length-1); items.forEach((el,i) => el.classList.toggle('active', i === activeIdx)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx-1, -1); items.forEach((el,i) => el.classList.toggle('active', i === activeIdx)); }
    else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) { location.hash = `#problem/${items[activeIdx].dataset.issue}`; }
    else if (e.key === 'Escape') { box.innerHTML = ''; activeIdx = -1; }
  });
  input.addEventListener('focus', () => {
    if (!input.value.trim()) {
      const common = hc.getCommonIssues().slice(0, 5);
      box.innerHTML = common.map(r => `<div class="search-result" data-issue="${r.id}" tabindex="-1"><div>${esc(r.title)}</div></div>`).join('');
      box.querySelectorAll('.search-result').forEach(el => { el.addEventListener('click', () => { location.hash = `#problem/${el.dataset.issue}`; }); });
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) { box.innerHTML = ''; activeIdx = -1; } });
}

function bindAll() {
  app.querySelectorAll('[data-issue]').forEach(el => {
    if (el.classList.contains('branch-btn') || el.classList.contains('outcome-btn')) return;
    const handler = () => { location.hash = `#problem/${el.dataset.issue}`; };
    el.addEventListener('click', handler);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });
  app.querySelectorAll('[data-cat]').forEach(el => {
    const handler = () => { location.hash = `#category/${el.dataset.cat}`; };
    el.addEventListener('click', handler);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });
}

function bindStepActions(issueId) {
  app.querySelectorAll('[data-advance]').forEach(btn => { btn.addEventListener('click', () => { hc.advanceStep(issueId); renderProblem(issueId); }); });
  app.querySelectorAll('[data-solved]').forEach(btn => { btn.addEventListener('click', () => { hc.markSolved(issueId); renderProblem(issueId); }); });
  app.querySelectorAll('.branch-btn').forEach(btn => {
    btn.addEventListener('click', () => { hc.selectBranch(btn.dataset.issue, parseInt(btn.dataset.step), parseInt(btn.dataset.branch)); renderProblem(issueId); });
  });
  app.querySelectorAll('.outcome-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const outcomes = hc.getOutcomeTerminals(hc.getIssue(issueId));
      const outcome = outcomes?.find(o => o.id === btn.dataset.outcome);
      if (!outcome) return;
      const container = app.querySelector('.outcome-result-container');
      const cls = outcome.terminal === 'safe' ? 'safe' : 'escalate';
      let html = `<div class="outcome-result ${cls}"><p>${esc(outcome.guidance)}</p>`;
      if (outcome.showDiscord) { html += renderRelated(hc.getIssue(issueId)) + renderDiscord(hc.getIssue(issueId)); }
      else { html += `<div style="margin-top:10px"><a href="#home" style="font-size:13px">Back to all problems</a></div>`; }
      html += `</div>`;
      container.innerHTML = html;
      app.querySelectorAll('[data-copy]').forEach(btn => { btn.addEventListener('click', () => { navigator.clipboard?.writeText(btn.dataset.copy).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy details'; }, 2000); }); }); });
    });
  });
  app.querySelectorAll('[data-copy]').forEach(btn => { btn.addEventListener('click', () => { navigator.clipboard?.writeText(btn.dataset.copy).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy details'; }, 2000); }); }); });
}
