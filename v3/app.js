// V3-Navigator: Persistent sidebar tree navigation, docs-style split pane
const hc = new HelpCenter();
hc.variantId = 'v3-navigator';
const app = document.getElementById('app');

hc.loadContent().then(() => { window.addEventListener('hashchange', route); route(); });

function route() {
  const { view, slug, params } = hc.parseHash();
  const mainContent = buildMain(view, slug, params);
  app.innerHTML = `
    <aside class="nav-sidebar" role="navigation" aria-label="Problem categories">${buildSidebar(view, slug)}</aside>
    <div class="nav-main">${mainContent}</div>`;
  // Mobile toggle
  const toggleHtml = `<button class="sidebar-toggle" aria-label="Toggle navigation">☰</button>`;
  if (!document.querySelector('.sidebar-toggle')) {
    document.body.insertAdjacentHTML('beforeend', toggleHtml);
    document.querySelector('.sidebar-toggle').addEventListener('click', () => {
      const mob = document.querySelector('.mobile-nav');
      if (mob) { mob.classList.toggle('open'); }
      else {
        const mobileNav = document.createElement('div');
        mobileNav.className = 'mobile-nav open';
        mobileNav.innerHTML = buildSidebar(view, slug);
        document.body.appendChild(mobileNav);
        bindSidebarLinks(mobileNav);
        mobileNav.addEventListener('click', e => { if (e.target.closest('.tree-issue')) mobileNav.classList.remove('open'); });
      }
    });
  }
  bindSidebarLinks(app.querySelector('.nav-sidebar'));
  bindMainActions(view, slug);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function buildSidebar(view, slug) {
  let html = `<div class="sidebar-title">Problems</div>
    <input class="sidebar-search" type="search" placeholder="Quick search…" aria-label="Search problems">`;
  for (const cat of CATEGORIES) {
    const issues = hc.getCategoryIssues(cat.id);
    const isOpen = view === 'category' && slug === cat.id || view === 'problem' && issues.some(i => i.id === slug);
    html += `<div class="tree-group">
      <div class="tree-cat${isOpen ? ' open' : ''}" data-cat="${cat.id}"><span>${esc(cat.short)}</span><span class="arrow">›</span></div>
      <div class="tree-issues">${issues.map(i => {
        const active = view === 'problem' && slug === i.id;
        const limited = hc.isLimited(i) ? ' limited' : '';
        return `<a class="tree-issue${active ? ' active' : ''}${limited}" href="#problem/${i.id}">${esc(i.title)}</a>`;
      }).join('')}</div>
    </div>`;
  }
  return html;
}

function bindSidebarLinks(container) {
  if (!container) return;
  container.querySelectorAll('.tree-cat').forEach(el => {
    el.addEventListener('click', () => { el.classList.toggle('open'); });
  });
  const searchInput = container.querySelector('.sidebar-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      container.querySelectorAll('.tree-group').forEach(group => {
        const issues = group.querySelectorAll('.tree-issue');
        let anyVisible = false;
        issues.forEach(iss => {
          const match = !q || iss.textContent.toLowerCase().includes(q);
          iss.style.display = match ? '' : 'none';
          if (match) anyVisible = true;
        });
        group.style.display = anyVisible || !q ? '' : 'none';
        if (q && anyVisible) group.querySelector('.tree-cat')?.classList.add('open');
      });
    });
  }
}

function buildMain(view, slug, params) {
  switch (view) {
    case 'category': return renderCategory(slug);
    case 'problem': return renderProblem(slug);
    case 'problems': return renderAllProblems();
    case 'search': return renderSearchPage(params?.q || '');
    default: return renderHome();
  }
}

function renderHome() {
  const common = hc.getCommonIssues();
  return `<h1 class="home-title">How can we help?</h1>
    <div class="search-wrap"><span class="search-icon">⌕</span>
      <input class="search-input" type="search" placeholder="Describe the problem or enter an error code" aria-label="Search problems" autocomplete="off">
      <div class="search-results" role="listbox"></div>
    </div>
    <div class="search-hint">Try: purchase missing · CODE(0) · Dust balance</div>
    <div class="section-label">Common problems</div>
    <div class="issue-list">${common.map(i => issueRow(i)).join('')}</div>
    <div class="section-label">All topics</div>
    <div class="issue-list">${CATEGORIES.map(c => `<div class="issue-row" data-cat="${c.id}" role="button" tabindex="0"><span>${esc(c.short)}</span><span class="chevron">›</span></div>`).join('')}</div>`;
}

function renderCategory(slug) {
  const cat = hc.getCategory(slug);
  if (!cat) return renderHome();
  const issues = hc.getCategoryIssues(slug);
  return `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <span>${esc(cat.short)}</span></div>
    <h1 class="cat-title">${esc(cat.short)}</h1><p class="cat-desc">${esc(cat.description)}</p>
    <div class="issue-list">${issues.map(i => issueRow(i)).join('')}</div>`;
}

function renderAllProblems() {
  let html = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <span>All</span></div><h1 class="cat-title">All problems</h1>`;
  for (const cat of CATEGORIES) {
    html += `<div class="section-label">${esc(cat.short)}</div><div class="issue-list">${hc.getCategoryIssues(cat.id).map(i => issueRow(i)).join('')}</div>`;
  }
  return html;
}

function renderProblem(slug) {
  const issue = hc.getIssue(slug);
  if (!issue) return renderHome();
  const cat = hc.getCategory(issue.category);
  const state = hc.getStepState(slug);
  const isWS = slug === 'wallet-security';
  const outcomes = hc.getOutcomeTerminals(issue);

  let html = `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> <a href="#category/${issue.category}">${esc(cat?.short || '')}</a></div>
    <h2 class="article-title">${esc(issue.title)}</h2><p class="article-problem">${esc(issue.problem)}</p>`;
  if (hc.isLimited(issue)) html += `<div class="limited-notice">${esc(issue.limitedNotice || 'Not fully verified.')}</div>`;
  if (issue.caution) html += `<div class="caution-box">${esc(issue.caution)}</div>`;
  if (issue.whatMayBeHappening?.length) html += `<div class="what-happening"><div class="what-happening-title">What may be happening</div><ul>${issue.whatMayBeHappening.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  if (issue.splitInfo) html += `<div class="split-banner">Distinct causes: ${issue.splitInfo.splitBranches.map(b => b.replace(/-/g,' ')).join(', ')}. Identify which applies first.</div>`;

  if (state.solved) return html + `<div class="solved-panel"><h3>Glad that worked</h3><a href="#home">Back to all problems</a></div>`;

  html += `<div class="fixes-label">Possible fixes</div>` + renderSteps(slug, issue, state);
  if (isWS && outcomes && state.exhausted) html += renderOutcomes(slug, outcomes);
  if (state.exhausted && !isWS) html += renderRelated(issue) + renderDiscord(issue);
  return html;
}

function renderSteps(slug, issue, state) {
  let html = '';
  for (let i = 0; i < issue.fixes.length; i++) {
    const fix = issue.fixes[i], active = i === state.currentStep && !state.exhausted, completed = !!state.completed[i], future = i > state.currentStep && !state.exhausted;
    const cls = active ? 'active' : completed ? 'completed' : future ? 'future' : '';
    const branches = hc.getBranches(slug, i), chosen = state.branchChoices[i];
    html += `<div class="fix-step ${cls}"><div class="fix-header" tabindex="0"><span class="fix-num">${completed ? '✓' : i+1}</span><span>${esc(fix.title)}${completed && chosen!=null && branches ? ': '+esc(branches[chosen].label) : ''}</span></div>`;
    if (active) {
      html += `<div class="fix-body"><div class="action">${esc(fix.action)}</div><div class="expected">${esc(fix.expected)}</div>`;
      if (fix.ambiguityNote) html += `<div class="ambiguity">${esc(fix.ambiguityNote)}</div>`;
      if (fix.next) html += `<div class="next-text">${esc(fix.next)}</div>`;
      if (branches) {
        html += `<div class="branch-list">${branches.map((b,bi) => `<button class="branch-btn${chosen===bi?' selected':''}" data-issue="${slug}" data-step="${i}" data-branch="${bi}">${esc(b.label)}</button>`).join('')}</div>`;
        if (chosen != null) {
          const c = branches[chosen]; html += `<div class="branch-note">${esc(c.note)}</div>`;
          if (c.terminal === 'safe') html += `<div class="step-actions"><button class="btn btn-success" data-solved="${slug}">This fixed it</button></div>`;
          else if (c.terminal === 'related' && c.related) html += `<div class="step-actions"><a class="btn btn-primary" href="#problem/${c.related}">Open related guide</a></div>`;
          else html += `<div class="step-actions"><button class="btn btn-primary" data-advance="${slug}">Next fix</button><button class="btn btn-ghost" data-advance="${slug}">Already tried</button></div>`;
        }
      } else html += `<div class="step-actions"><button class="btn btn-success" data-solved="${slug}">This fixed it</button><button class="btn btn-primary" data-advance="${slug}">Next fix</button><button class="btn btn-ghost" data-advance="${slug}">Skip</button></div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  return html;
}

function renderOutcomes(id, outcomes) { return `<div class="fixes-label" style="margin-top:16px">What describes your situation?</div><div class="outcome-list">${outcomes.map(o => `<button class="outcome-btn" data-outcome="${o.id}" data-issue="${id}">${esc(o.label)}</button>`).join('')}</div><div class="outcome-result-container"></div>`; }
function renderRelated(issue) { if (!issue.relatedProblems?.length) return ''; return `<div class="related-section"><div class="related-label">Related problems</div>${issue.relatedProblems.map(rid => { const r = hc.getIssue(rid); return r ? `<a class="related-link" href="#problem/${rid}">${esc(r.title)}</a>` : ''; }).join('')}</div>`; }
function renderDiscord(issue) { const fb = hc.content.commonFallback, details = hc.generateCopyDetails(issue.id); return `<div class="discord-fallback"><h3>${esc(fb.heading)}</h3><p>${esc(fb.body)}</p><a class="discord-link" href="${DISCORD_SUPPORT}" target="_blank" rel="noopener noreferrer">${esc(fb.cta)} ↗</a><button class="btn btn-ghost copy-btn" data-copy="${esc(details)}">Copy details</button><p class="existing-ticket">${esc(fb.existingTicket)}</p><p class="safety-note">${esc(fb.safety)}</p><p style="font-size:10px;color:var(--dim);margin-top:6px">This page has not sent a support request.</p></div>`; }
function renderSearchPage(query) { const results = hc.search(query); return `<div class="breadcrumb"><a href="#home">Help</a> <span>›</span> Search</div><h1 class="cat-title">Search: ${esc(query)}</h1>${results.length ? `<div class="issue-list">${results.map(i => issueRow(i)).join('')}</div>` : '<p style="color:var(--muted);margin-top:12px">No exact match. <a href="#problems">Browse topics</a>.</p>'}`; }
function issueRow(issue) { const limited = hc.isLimited(issue) ? ' limited' : ''; return `<div class="issue-row${limited}" data-issue="${issue.id}" role="button" tabindex="0"><span>${esc(issue.title)}</span><span class="chevron">›</span></div>`; }

function bindMainActions(view, slug) {
  // Search
  const input = app.querySelector('.nav-main .search-input');
  const box = app.querySelector('.nav-main .search-results');
  if (input && box) {
    let debounce, activeIdx = -1;
    input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => {
      const q = input.value.trim(); if (!q) { box.innerHTML = ''; return; }
      const results = hc.search(q); if (!results.length) { box.innerHTML = `<div class="search-no-match">No match.</div>`; return; }
      activeIdx = -1; box.innerHTML = results.map(r => { const cat = hc.getCategory(r.category); return `<div class="search-result" data-issue="${r.id}" tabindex="-1"><div>${esc(r.title)}</div><div class="cat">${esc(cat?.short||'')}</div></div>`; }).join('');
      box.querySelectorAll('.search-result').forEach(el => { el.addEventListener('click', () => { location.hash = `#problem/${el.dataset.issue}`; }); });
    }, 180); });
    input.addEventListener('keydown', e => { const items = box.querySelectorAll('.search-result'); if (e.key==='ArrowDown'){e.preventDefault();activeIdx=Math.min(activeIdx+1,items.length-1);items.forEach((el,i)=>el.classList.toggle('active',i===activeIdx))} else if(e.key==='ArrowUp'){e.preventDefault();activeIdx=Math.max(activeIdx-1,-1);items.forEach((el,i)=>el.classList.toggle('active',i===activeIdx))} else if(e.key==='Enter'&&activeIdx>=0&&items[activeIdx]){location.hash=`#problem/${items[activeIdx].dataset.issue}`} else if(e.key==='Escape'){box.innerHTML='';activeIdx=-1} });
    input.addEventListener('focus', () => { if (!input.value.trim()) { const common = hc.getCommonIssues().slice(0,5); box.innerHTML = common.map(r => `<div class="search-result" data-issue="${r.id}" tabindex="-1"><div>${esc(r.title)}</div></div>`).join(''); box.querySelectorAll('.search-result').forEach(el => { el.addEventListener('click', () => { location.hash = `#problem/${el.dataset.issue}`; }); }); } });
    document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) { box.innerHTML = ''; } });
  }
  // Issue/cat rows
  app.querySelectorAll('.nav-main [data-issue]').forEach(el => {
    if (el.classList.contains('branch-btn') || el.classList.contains('outcome-btn')) return;
    const h = () => { location.hash = `#problem/${el.dataset.issue}`; };
    el.addEventListener('click', h); el.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();h()} });
  });
  app.querySelectorAll('.nav-main [data-cat]').forEach(el => {
    const h = () => { location.hash = `#category/${el.dataset.cat}`; };
    el.addEventListener('click', h); el.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();h()} });
  });
  // Step actions
  if (view === 'problem' && slug) {
    app.querySelectorAll('[data-advance]').forEach(btn => { btn.addEventListener('click', () => { hc.advanceStep(slug); route(); }); });
    app.querySelectorAll('[data-solved]').forEach(btn => { btn.addEventListener('click', () => { hc.markSolved(slug); route(); }); });
    app.querySelectorAll('.branch-btn').forEach(btn => { btn.addEventListener('click', () => { hc.selectBranch(btn.dataset.issue, parseInt(btn.dataset.step), parseInt(btn.dataset.branch)); route(); }); });
    app.querySelectorAll('.outcome-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const outcomes = hc.getOutcomeTerminals(hc.getIssue(slug));
        const o = outcomes?.find(x => x.id === btn.dataset.outcome); if (!o) return;
        const c = app.querySelector('.outcome-result-container'), cls = o.terminal==='safe'?'safe':'escalate';
        let h = `<div class="outcome-result ${cls}"><p>${esc(o.guidance)}</p>`;
        if (o.showDiscord) h += renderRelated(hc.getIssue(slug)) + renderDiscord(hc.getIssue(slug));
        else h += `<div style="margin-top:8px"><a href="#home">Back to all problems</a></div>`;
        c.innerHTML = h + `</div>`;
        app.querySelectorAll('[data-copy]').forEach(b => { b.addEventListener('click', () => { navigator.clipboard?.writeText(b.dataset.copy).then(()=>{b.textContent='Copied';setTimeout(()=>{b.textContent='Copy details'},2000)}); }); });
      });
    });
    app.querySelectorAll('[data-copy]').forEach(b => { b.addEventListener('click', () => { navigator.clipboard?.writeText(b.dataset.copy).then(()=>{b.textContent='Copied';setTimeout(()=>{b.textContent='Copy details'},2000)}); }); });
  }
}
