/* تنظيم تبويبات لوحة الأدمن في مجموعات قابلة للطي + بحث. لا يغيّر أي تبويب أو لوحة، بس يعيد ترتيب الأزرار. */
(function(){
  const nameOf = b => { const m = /switchTab\('([^']+)'/.exec(b.getAttribute('onclick') || ''); return m ? m[1] : ''; };
  const mobile = () => window.matchMedia('(max-width:1023px)').matches;
  function build(){
    const bar = document.querySelector('.tabs'); if(!bar || bar.dataset.grouped) return;
    if(!bar.querySelector('.tab-group')) return;
    bar.dataset.grouped = '1';
    const wrap = document.createElement('div'); wrap.className = 'tg-wrap';
    const search = document.createElement('input'); search.type = 'search'; search.className = 'tg-search'; search.placeholder = '🔎 دوّر على قسم'; wrap.appendChild(search);
    let g = null; const groups = [];
    [].slice.call(bar.children).forEach(el => {
      if(el.classList.contains('tab-group')){ g = { title: el.textContent.trim(), tabs: [] }; groups.push(g); }
      else if(el.classList.contains('tab') && g){ g.tabs.push(el); }
    });
    const saved = localStorage.getItem('adminNavOpen') || '';
    groups.forEach((gr, i) => {
      if(!gr.tabs.length) return;
      const box = document.createElement('div'); box.className = 'tg'; box.dataset.id = String(i);
      const sp = gr.title.indexOf(' '); const ic = sp > 0 ? gr.title.slice(0, sp) : '📁', tt = sp > 0 ? gr.title.slice(sp + 1) : gr.title;
      const h = document.createElement('button'); h.type = 'button'; h.className = 'tg-h'; h.innerHTML = '<span class="tg-i">' + ic + '</span><span class="tg-t">' + tt + '</span><span class="tg-c">' + gr.tabs.length + '</span>';
      const b = document.createElement('div'); b.className = 'tg-b'; gr.tabs.forEach(t => b.appendChild(t));
      h.onclick = () => { const open = !box.classList.contains('open'); if(mobile()) wrap.querySelectorAll('.tg.open').forEach(x => x.classList.remove('open')); box.classList.toggle('open', open); if(open) localStorage.setItem('adminNavOpen', box.dataset.id); };
      box.appendChild(h); box.appendChild(b); wrap.appendChild(box);
    });
    [].slice.call(bar.children).forEach(el => { if(el.classList.contains('tab-group') || el.classList.contains('tab-search')) el.remove(); });
    bar.appendChild(wrap);
    const openFor = btn => { const x = btn && btn.closest('.tg'); if(x){ if(mobile()) wrap.querySelectorAll('.tg.open').forEach(y => y.classList.remove('open')); x.classList.add('open'); } };
    openFor(bar.querySelector('.tab.active'));
    if(!wrap.querySelector('.tg.open')){ const f = wrap.querySelector('.tg[data-id="' + saved + '"]') || wrap.querySelector('.tg'); if(f) f.classList.add('open'); }
    bar.addEventListener('click', e => { const t = e.target.closest('.tab'); if(t) openFor(t); });
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      wrap.querySelectorAll('.tg').forEach(x => { let any = false; x.querySelectorAll('.tab').forEach(t => { const hit = !q || t.textContent.toLowerCase().includes(q); t.style.display = hit ? '' : 'none'; if(hit) any = true; }); x.style.display = any ? '' : 'none'; if(q && any) x.classList.add('open'); });
    });
  }
  const css = document.createElement('style'); css.textContent = `
.tg-wrap{display:flex;flex-direction:column;gap:6px;width:100%}
.tg-search{width:100%;box-sizing:border-box;padding:10px 14px;border-radius:12px;border:1px solid rgba(240,207,122,.35);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:13px}
.tg-search::placeholder{color:#b9c4e2}
.tg-h{display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;border:0;border-radius:12px;background:transparent;color:#f0cf7a;font:inherit;font-weight:900;font-size:13.5px;cursor:pointer;text-align:start}
.tg-h:hover{background:rgba(255,255,255,.07)}.tg-i{font-size:17px}.tg-t{flex:1}
.tg-c{font-size:11px;background:rgba(240,207,122,.18);color:#f0cf7a;border-radius:999px;padding:1px 8px}
.tg-h::after{content:'▾';font-size:11px;opacity:.7;transition:transform .15s}.tg.open>.tg-h::after{transform:rotate(180deg)}
.tg.open>.tg-h{background:rgba(240,207,122,.10)}
.tg-b{display:none;flex-direction:column;gap:2px;padding:2px 0 8px;margin-inline-start:14px;border-inline-start:1px solid rgba(240,207,122,.25)}
.tg.open>.tg-b{display:flex}
@media (min-width:1024px){ .tabs::after{display:none} .tabs{padding-top:70px !important} .tg-b .tab{padding:9px 12px;font-size:13.5px} .tg-b .tab.active::before{inset-inline-end:-1px} }
}`;
  document.head.appendChild(css);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(build, 0)); else setTimeout(build, 0);
})();
