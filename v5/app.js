// V5-Reader: Long-form editorial scroll, typography-forward, all sections visible
const hc = new HelpCenter();
hc.variantId = 'v5-reader';
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
    <p class="home-subtitle">Step-by-step troubleshooting for Clash of Coins. No sign-in required.</p>
    <div class="search-wrap"><span class="search-icon">⌕</span>
      <input class="search-input" type="search" placeholder="Describe the problem or enter an error code" aria-label="Search problems" autocomplete="off">
      <div class="search-results" role="listbox"></div>
    </div>
    <div class="search-hint">Examples: purchase missing · CODE(0) · Dust balance · wallet compromised</div>
    <div class="section-label">Common problems</div>
    <div class="issue-list">${common.map(i => issueRow(i, true)).join('')}</div>
    <div class="section-label">Browse by topic</div>
    <div class="cat-links">${CATEGORIES.map(c => {
      const count = hc.getCategoryIssues(c.id).length;
      return `<div class="cat-link" data-cat="${c.id}" role="button" tabindex="0">
        <div><div class="name">${esc(c.short)}</div><div class="desc">${esc(c.description)}</div></div>
        <span class="count">${count}</span>
      </div>`;
    }).join('')}</div>`;
  setupSearch(); bindAll();
}

function renderCategory(slug) {
  const cat = hc.getCategory(slug);
  if (!cat) { location.hash = '#home'; return; }
  const issues = hc.getCategoryIssues(slug);
  app.innerHTML = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <span>${esc(cat.short)}</span></div>
    <h1 class="cat-title">${esc(cat.short)}</h1><p class="cat-desc">${esc(cat.description)}</p>
    <div class="issue-list">${issues.map(i => issueRow(i, true)).join('')}</div>`;
  bindAll();
}

function renderAllProblems() {
  let html = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> All</div><h1 class="cat-title">All problems</h1>`;
  for (const cat of CATEGORIES) {
    html += `<div class="section-label">${esc(cat.short)}</div><div class="issue-list">${hc.getCategoryIssues(cat.id).map(i => issueRow(i, true)).join('')}</div>`;
  }
  app.innerHTML = html; bindAll();
}

function renderProblem(slug) {
  const issue = hc.getIssue(slug);
  if (!issue) { location.hash = '#home'; return; }
  const cat = hc.getCategory(issue.category);
  const state = hc.getStepState(slug);
  const isWS = slug === 'wallet-security';
  const outcomes = hc.getOutcomeTerminals(issue);

  let html = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <a href="#category/${issue.category}">${esc(cat?.short || '')}</a></div>
    <h2 class="article-title">${esc(issue.title)}</h2>
    <p class="article-problem">${esc(issue.problem)}</p>`;

  if (hc.isLimited(issue)) html += `<div class="limited-notice">${esc(issue.limitedNotice || 'Not fully verified.')}</div>`;
  if (issue.caution) html += `<div class="caution-box">${esc(issue.caution)}</div>`;

  // TOC
  html += `<div class="toc"><div class="toc-title">On this page</div>`;
  if (issue.whatMayBeHappening?.length) html += `<a href="javascript:void(0)" onclick="document.getElementById('wh').scrollIntoView({behavior:'smooth'})">What may be happening</a>`;
  html += `<a href="javascript:void(0)" onclick="document.getElementById('fixes').scrollIntoView({behavior:'smooth'})">Possible fixes</a>`;
  if (issue.relatedProblems?.length) html += `<a href="javascript:void(0)" onclick="document.getElementById('related').scrollIntoView({behavior:'smooth'})">Related problems</a>`;
  html += `</div>`;

  if (issue.whatMayBeHappening?.length) {
    html += `<div class="what-happening" id="wh"><div class="what-happening-title">What may be happening</div><ul>${issue.whatMayBeHappening.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  }
  if (issue.splitInfo) html += `<div class="split-banner">This problem has several distinct causes: ${issue.splitInfo.splitBranches.map(b => b.replace(/-/g,' ')).join(', ')}. Identify which applies before proceeding.</div>`;

  html += `<hr class="article-divider">`;

  if (state.solved) {
    html += `<div class="solved-panel"><h3>Glad that worked</h3><a href="#home" style="font-size:14px">Back to all problems</a></div>`;
    app.innerHTML = html; return;
  }

  // All fix sections visible (reader style) — but only current one is interactive
  html += `<div class="fixes-label" id="fixes">Possible fixes</div>`;
  for (let i = 0; i < issue.fixes.length; i++) {
    const fix = issue.fixes[i];
    const active = i === state.currentStep && !state.exhausted;
    const completed = !!state.completed[i];
    const future = i > state.currentStep && !state.exhausted;
    const cls = active ? 'active' : completed ? 'completed' : future ? 'future' : '';
    const branches = hc.getBranches(slug, i);
    const chosen = state.branchChoices[i];

    html += `<div class="fix-section ${cls}">
      <div class="fix-num-label">${completed ? '✓ Completed' : `Step ${i + 1}`}</div>
      <div class="fix-title">${esc(fix.title)}${completed && chosen != null && branches ? ' — ' + esc(branches[chosen].label) : ''}</div>`;

    if (completed) {
      // Show summary only
    } else if (active) {
      html += `<div class="action">${esc(fix.action)}</div><div class="expected">${esc(fix.expected)}</div>`;
      if (fix.ambiguityNote) html += `<div class="ambiguity">${esc(fix.ambiguityNote)}</div>`;
      if (fix.next) html += `<div class="next-text">${esc(fix.next)}</div>`;
      if (branches) {
        html += `<div class="branch-list">${branches.map((b, bi) => `<button class="branch-btn${chosen===bi?' selected':''}" data-issue="${slug}" data-step="${i}" data-branch="${bi}">${esc(b.label)}</button>`).join('')}</div>`;
        if (chosen != null) {
          const c = branches[chosen];
          html += `<div class="branch-note">${esc(c.note)}</div>`;
          if (c.terminal === 'safe') html += `<div class="step-actions"><button class="btn btn-success" data-solved="${slug}">This fixed it</button></div>`;
          else if (c.terminal === 'related' && c.related) html += `<div class="step-actions"><a class="btn btn-primary" href="#problem/${c.related}">Open related guide</a></div>`;
          else html += `<div class="step-actions"><button class="btn btn-primary" data-advance="${slug}">Continue reading →</button></div>`;
        }
      } else {
        html += `<div class="step-actions"><button class="btn btn-success" data-solved="${slug}">This fixed it</button><button class="btn btn-primary" data-advance="${slug}">Next section →</button><button class="btn btn-ghost" data-advance="${slug}">Skip</button></div>`;
      }
    }
    html += `</div>`;
  }

  // Wallet-security outcome terminals
  if (isWS && outcomes && state.exhausted) {
    html += `<hr class="article-divider"><div class="fixes-label">What describes your situation?</div>
      <div class="outcome-list">${outcomes.map(o => `<button class="outcome-btn" data-outcome="${o.id}" data-issue="${slug}">${esc(o.label)}</button>`).join('')}</div>
      <div class="outcome-result-container"></div>`;
  }

  // Related + Discord
  if (issue.relatedProblems?.length) {
    html += `<div class="related-section" id="related"><div class="related-label">Related problems</div>${issue.relatedProblems.map(rid => { const r = hc.getIssue(rid); return r ? `<a class="related-link" href="#problem/${rid}">${esc(r.title)}</a>` : ''; }).join('')}</div>`;
  }

  if (state.exhausted && !isWS) {
    html += renderDiscord(issue);
  }

  app.innerHTML = html;
  bindStepActions(slug);
}

function renderDiscord(issue) {
  const fb = hc.content.commonFallback, details = hc.generateCopyDetails(issue.id);
  return `<div class="discord-fallback"><h3>${esc(fb.heading)}</h3><p>${esc(fb.body)}</p>
    <a class="discord-link" href="${DISCORD_SUPPORT}" target="_blank" rel="noopener noreferrer">${esc(fb.cta)} ↗</a>
    <button class="btn btn-ghost copy-btn" data-copy="${esc(details)}">Copy details</button>
    <p class="existing-ticket">${esc(fb.existingTicket)}</p><p class="safety-note">${esc(fb.safety)}</p>
    <p style="font-size:10px;color:var(--dim);margin-top:6px">This page has not sent a support request.</p></div>`;
}

function renderSearchPage(query) {
  const results = hc.search(query);
  app.innerHTML = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> Search</div>
    <h1 class="cat-title">Search: ${esc(query)}</h1>
    ${results.length ? `<div class="issue-list">${results.map(i => issueRow(i, true)).join('')}</div>` : '<p style="color:var(--muted);margin-top:14px">No exact match. Try fewer words or <a href="#problems">browse topics</a>.</p>'}`;
  bindAll();
}

function issueRow(issue, showCat) {
  const cat = showCat ? hc.getCategory(issue.category) : null;
  const limited = hc.isLimited(issue) ? ' limited' : '';
  return `<div class="issue-row${limited}" data-issue="${issue.id}" role="button" tabindex="0">
    <span class="title">${esc(issue.title)}</span>
    ${cat ? `<span class="cat-label">${esc(cat.short)}</span>` : ''}
  </div>`;
}

function setupSearch() {
  const input = app.querySelector('.search-input'), box = app.querySelector('.search-results');
  if (!input || !box) return;
  let debounce, activeIdx = -1;
  input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => {
    const q = input.value.trim(); if (!q) { box.innerHTML = ''; return; }
    const results = hc.search(q); if (!results.length) { box.innerHTML = `<div class="search-no-match">No match. Try fewer words.</div>`; return; }
    activeIdx = -1; box.innerHTML = results.map(r => { const cat = hc.getCategory(r.category); return `<div class="search-result" data-issue="${r.id}" tabindex="-1"><div>${esc(r.title)}</div><div class="cat">${esc(cat?.short||'')}</div></div>`; }).join('');
    box.querySelectorAll('.search-result').forEach(el => { el.addEventListener('click', () => { location.hash = `#problem/${el.dataset.issue}`; }); });
  }, 180); });
  input.addEventListener('keydown', e => { const items = box.querySelectorAll('.search-result'); if(e.key==='ArrowDown'){e.preventDefault();activeIdx=Math.min(activeIdx+1,items.length-1);items.forEach((el,i)=>el.classList.toggle('active',i===activeIdx))} else if(e.key==='ArrowUp'){e.preventDefault();activeIdx=Math.max(activeIdx-1,-1);items.forEach((el,i)=>el.classList.toggle('active',i===activeIdx))} else if(e.key==='Enter'&&activeIdx>=0&&items[activeIdx]){location.hash=`#problem/${items[activeIdx].dataset.issue}`} else if(e.key==='Escape'){box.innerHTML='';activeIdx=-1} });
  input.addEventListener('focus', () => { if (!input.value.trim()) { const c = hc.getCommonIssues().slice(0,5); box.innerHTML = c.map(r => `<div class="search-result" data-issue="${r.id}" tabindex="-1"><div>${esc(r.title)}</div></div>`).join(''); box.querySelectorAll('.search-result').forEach(el => { el.addEventListener('click', () => { location.hash = `#problem/${el.dataset.issue}`; }); }); } });
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) box.innerHTML = ''; });
}

function bindAll() {
  app.querySelectorAll('[data-issue]').forEach(el => { if(el.classList.contains('branch-btn')||el.classList.contains('outcome-btn'))return; const h=()=>{location.hash=`#problem/${el.dataset.issue}`}; el.addEventListener('click',h); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();h()}}); });
  app.querySelectorAll('[data-cat]').forEach(el => { const h=()=>{location.hash=`#category/${el.dataset.cat}`}; el.addEventListener('click',h); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();h()}}); });
}

function bindStepActions(slug) {
  app.querySelectorAll('[data-advance]').forEach(b => { b.addEventListener('click', () => { hc.advanceStep(slug); renderProblem(slug); }); });
  app.querySelectorAll('[data-solved]').forEach(b => { b.addEventListener('click', () => { hc.markSolved(slug); renderProblem(slug); }); });
  app.querySelectorAll('.branch-btn').forEach(b => { b.addEventListener('click', () => { hc.selectBranch(b.dataset.issue, parseInt(b.dataset.step), parseInt(b.dataset.branch)); renderProblem(slug); }); });
  app.querySelectorAll('.outcome-btn').forEach(b => {
    b.addEventListener('click', () => {
      const outcomes = hc.getOutcomeTerminals(hc.getIssue(slug)); const o = outcomes?.find(x => x.id === b.dataset.outcome); if (!o) return;
      const c = app.querySelector('.outcome-result-container'), cls = o.terminal==='safe'?'safe':'escalate';
      let h = `<div class="outcome-result ${cls}"><p>${esc(o.guidance)}</p>`;
      if (o.showDiscord) h += renderDiscord(hc.getIssue(slug));
      else h += `<div style="margin-top:10px"><a href="#home">Back to all problems</a></div>`;
      c.innerHTML = h + `</div>`;
      app.querySelectorAll('[data-copy]').forEach(x => { x.addEventListener('click', () => { navigator.clipboard?.writeText(x.dataset.copy).then(()=>{x.textContent='Copied';setTimeout(()=>{x.textContent='Copy details'},2000)}); }); });
    });
  });
  app.querySelectorAll('[data-copy]').forEach(x => { x.addEventListener('click', () => { navigator.clipboard?.writeText(x.dataset.copy).then(()=>{x.textContent='Copied';setTimeout(()=>{x.textContent='Copy details'},2000)}); }); });
}
