/* الخدمات الجامعية (أوائل) داخل نُدرس معًا — اشتراك مستقل مدته days يوم (الافتراضي 28)
   Firestore:
     siteSettings/awaelSection : { enabled, price, days, cash, instapay, whatsapp, note }   (الأدمن يعدّلها)
     awaelPayReqs/{uid}        : طلب دفع من الطالب (status: pending | rejected)
     awaelSubs/{uid}           : الاشتراك الفعلي { status:'active', expiresMs, ... } (الأدمن فقط يكتب)
     awaelContent/{sectionId}  : محتوى الأقسام (يقرأه المشترك النشط فقط)  */
(function(){
  const DAY = 24 * 60 * 60 * 1000;
  const S = { loaded:false, settings:null, sub:null, req:null, sections:null, open:null, menu:null, q:'', err:'' };
  const $ = id => document.getElementById(id);
  const E = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
  function defaults(){ return { enabled:true, price:0, days:28 }; }
  function isActive(){ return !!(S.sub && S.sub.status === 'active' && Number(S.sub.expiresMs) > Date.now()); }
  function daysLeft(){ return S.sub ? Math.max(0, Math.ceil((Number(S.sub.expiresMs) - Date.now()) / DAY)) : 0; }

  async function load(force){
    if(!currentUid){ return; }
    if(S.uid !== currentUid){ S.uid = currentUid; S.loaded = false; S.sub = S.req = S.sections = null; S.open = null; S.menu = null; S.q = ''; }
    if(S.loaded && !force){ render(); return; }
    const box = $('awael-body'); if(box) box.innerHTML = '<div class="empty-state">جاري التحميل…</div>';
    S.err = '';
    try{
      const [st, sb, rq] = await Promise.all([
        db.collection('siteSettings').doc('awaelSection').get(),
        db.collection('awaelSubs').doc(currentUid).get(),
        db.collection('awaelPayReqs').doc(currentUid).get()
      ]);
      S.settings = Object.assign(defaults(), st.exists ? st.data() : {});
      S.sub = sb.exists ? sb.data() : null;
      S.req = rq.exists ? rq.data() : null;
      S.sections = null;
      if(isActive()){
        try{
          const snap = await db.collection('awaelContent').get();
          S.sections = snap.docs.map(d => Object.assign({ id:d.id }, d.data())).filter(s => !s.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));
        }catch(e){ console.warn(e); S.err = 'تعذّر تحميل المحتوى الآن. حاول لاحقًا.'; }
      }
      S.loaded = true;
    }catch(e){ console.warn(e); S.err = 'تعذّر تحميل الخدمة الآن. حاول لاحقًا.'; }
    render();
  }

  const GROUPS = [
    { id:'services', title:'الخدمات', icon:'🎓' }, { id:'univ', title:'الجامعة', icon:'🏛️' },
    { id:'research', title:'البحث', icon:'🔬' }, { id:'egypt', title:'كل الجامعات', icon:'🌍' }, { id:'other', title:'أخرى', icon:'📁' }
  ];
  const MAP = { student:'services', results:'services', financial:'services', digital:'services', affairs:'univ', military:'univ', reg:'univ', faculties:'univ', centers:'univ', research:'research', 'mis-egypt':'egypt' };
  const groupOf = s => (GROUPS.find(g => g.id === (s.group || MAP[s.id])) || GROUPS[4]).id;

  function payBlock(){
    const st = S.settings, price = Number(st.price) || 0, days = Number(st.days) || 28;
    const cash = st.cash || (typeof PAY_CASH_NUMBER !== 'undefined' ? PAY_CASH_NUMBER : '');
    const insta = st.instapay || (typeof PAY_INSTAPAY_NUMBER !== 'undefined' ? PAY_INSTAPAY_NUMBER : '');
    const wa = st.whatsapp || (typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '');
    const me = (typeof pendingUser !== 'undefined' && pendingUser) || {};
    const msg = encodeURIComponent('مرحبًا، أنا ' + (me.name || '') + ' حوّلت ' + price + ' جنيه لاشتراك الخدمات الجامعية (' + days + ' يوم) على نُدرس معًا، برجاء التفعيل.');
    if(S.req && S.req.status === 'pending'){
      return '<div class="awx-pay"><div class="awx-crest">⏳</div><h3>طلبك قيد المراجعة</h3><p>بعد تأكيد التحويل من فريقنا هيتفتح الوصول تلقائيًا.</p>' + (wa ? '<a class="awx-btn" target="_blank" rel="noopener" href="https://wa.me/' + E(wa) + '?text=' + msg + '">تواصل واتساب</a>' : '') + '</div>';
    }
    const rejected = S.req && S.req.status === 'rejected' ? '<div class="awx-warn">طلبك السابق اترفض. تأكد من التحويل وابعت الطلب تاني.</div>' : '';
    return '<div class="awx-pay"><div class="awx-crest">🎓</div><h3>الخدمات الجامعية</h3>' +
      '<p>كل خدمات الجامعات المصرية (MIS، النتائج، التسجيل، الروابط الرسمية) في مكان واحد. مدة الاشتراك ' + days + ' يوم، وبعدها الوصول لهذا القسم بس بيتقفل لحد ما تجدد. اشتراك نُدرس معًا مستقل عنه.</p>' +
      '<div class="awx-price">' + (price > 0 ? price + ' <small>جنيه / ' + days + ' يوم</small>' : '<small>السعر هيتحدد قريبًا</small>') + '</div>' +
      '<div class="awx-methods">' + (insta ? '<div><span>💜 إنستاباي</span><b dir="ltr">' + E(insta) + '</b></div>' : '') + (cash ? '<div><span>💚 محفظة / كاش</span><b dir="ltr">' + E(cash) + '</b></div>' : '') + '</div>' +
      (st.note ? '<p class="awx-note">' + E(st.note) + '</p>' : '') + rejected +
      '<label class="awx-lab">رقم التحويل أو آخر 4 أرقام من الرقم اللي حوّلت منه</label><input class="awx-in" type="text" id="awael-ref" maxlength="60">' +
      '<button class="awx-btn" onclick="awaelSendRequest()"' + (price > 0 && st.enabled !== false ? '' : ' disabled') + '>حوّلت المبلغ — أرسل الطلب</button>' +
      '<div class="awx-status" id="awael-status"></div></div>';
  }

  function linkHtml(it){
    if(it.t === 'label') return '<div class="awx-lbl">' + E(it.title) + '</div>';
    const u = safeUrl(it.url); if(!u) return '';
    return '<a class="awx-link" href="' + E(u) + '" target="_blank" rel="noopener noreferrer"><span class="awx-ic">' + E(it.icon || '🔗') + '</span><span class="awx-lt"><b>' + E(it.title) + '</b>' + (it.desc ? '<small>' + E(it.desc) + '</small>' : '') + '</span><span class="awx-arr">‹</span></a>';
  }
  function sectionBlock(sec, open){
    return '<details class="awx-sec"' + (open ? ' open' : '') + '><summary><span class="awx-ic">' + E(sec.icon || '📁') + '</span><span class="awx-st"><b>' + E(sec.title) + '</b>' + (sec.sub ? '<small>' + E(sec.sub) + '</small>' : '') + '</span></summary>' +
      (sec.note ? '<div class="awx-notebox">' + E(sec.note) + '</div>' : '') + '<div class="awx-links">' + (sec.items || []).map(linkHtml).join('') + '</div></details>';
  }
  function searchHtml(q){
    q = q.trim().toLowerCase(); if(!q) return '';
    const out = [];
    (S.sections || []).forEach(sec => (sec.items || []).forEach(it => { if(it.t !== 'label' && ((it.title || '') + ' ' + (it.desc || '') + ' ' + (it.url || '')).toLowerCase().includes(q)) out.push(linkHtml(it)); }));
    return out.length ? '<div class="awx-links">' + out.slice(0, 40).join('') + '</div>' : '<div class="awx-empty">مفيش نتائج.</div>';
  }

  function fixedBox(html){
    let f = document.getElementById('awx-fixed');
    if(!f){ f = document.createElement('div'); f.id = 'awx-fixed'; document.body.appendChild(f);
      setInterval(() => { const v = document.getElementById('v-awael'); const on = v && v.offsetParent !== null && f.dataset.has === '1'; f.style.display = on ? '' : 'none'; }, 300); }
    f.dataset.has = html ? '1' : '0'; f.innerHTML = html; f.style.display = html ? '' : 'none';
  }
  function render(){
    const box = $('awael-body'); if(!box) return;
    if(!isActive() || S.err) fixedBox('');
    if(S.err && !S.settings){ box.innerHTML = '<div class="awx-empty">' + E(S.err) + '</div>'; return; }
    if(!isActive()){
      const expired = S.sub && Number(S.sub.expiresMs) > 0 ? '<div class="awx-warn">انتهى اشتراك الخدمات الجامعية. جدّد عشان يرجع الوصول.</div>' : '';
      box.innerHTML = '<div class="awx">' + expired + payBlock() + '</div>'; return;
    }
    const left = daysLeft();
    const hero = '<div class="awx-hero"><div><small>الخدمات الجامعية</small><b>اشتراكك فعّال</b></div><div class="awx-days"><span>' + left + '</span><small>يوم متبقي</small></div></div>' +
      (left <= 7 ? '<div class="awx-warn">اشتراكك قرّب يخلص. <a href="#" onclick="awaelShowRenew();return false;">جدّد الآن</a></div>' : '');
    if(S.err){ box.innerHTML = '<div class="awx">' + hero + '<div class="awx-empty">' + E(S.err) + '</div></div>'; return; }
    const secs = S.sections || [];
    if(!secs.length){ box.innerHTML = '<div class="awx">' + hero + '<div class="awx-empty">المحتوى هيتضاف قريبًا.</div></div>'; return; }
    const q = S.q || '';
    let main;
    if(q.trim()) main = searchHtml(q);
    else if(S.open){ const gs = secs.filter(s => groupOf(s) === S.open); main = gs.map((s, i) => sectionBlock(s, gs.length === 1 || i === 0)).join(''); }
    else main = '<div class="awx-grid">' + GROUPS.filter(g => secs.some(s => groupOf(s) === g.id)).map(g => '<button class="awx-tile" onclick="awaelOpen(\'' + g.id + '\')"><span class="awx-ic">' + g.icon + '</span><b>' + E(g.title) + '</b><small>' + secs.filter(s => groupOf(s) === g.id).reduce((n, s) => n + (s.items || []).filter(i => i.t !== 'label').length, 0) + ' رابط</small></button>').join('') + '</div>';
    const bar = '<nav class="awx-bar"><button class="' + (!S.open && !q.trim() ? 'on' : '') + '" onclick="awaelOpen(null)"><span>🏠</span>الرئيسية</button>' +
      GROUPS.filter(g => secs.some(s => groupOf(s) === g.id)).map(g => '<button class="' + (S.open === g.id ? 'on' : '') + '" onclick="awaelMenu(\'' + g.id + '\')"><span>' + g.icon + '</span>' + E(g.title) + '<i>▾</i></button>').join('') + '</nav>';
    let sheet = '';
    if(S.menu){
      const gs = secs.filter(s => groupOf(s) === S.menu);
      sheet = '<div class="awx-shade" onclick="awaelMenu(null)"></div><div class="awx-sheet">' + gs.map(s => '<button onclick="awaelPick(\'' + E(S.menu) + '\',\'' + E(s.id) + '\')"><span class="awx-ic">' + E(s.icon || '📁') + '</span>' + E(s.title) + '<small>' + (s.items || []).filter(i => i.t !== 'label').length + '</small></button>').join('') + '</div>';
    }
    const title = S.open && !q.trim() ? '<div class="awx-h">' + E((GROUPS.find(g => g.id === S.open) || {}).title || '') + '</div>' : '';
    box.innerHTML = '<div class="awx">' + hero + '<input class="awx-in awx-search" type="search" placeholder="🔎 ابحث في كل الروابط" value="' + E(q) + '" oninput="awaelSearch(this.value)">' + title + '<div id="awx-main">' + main + '</div></div>';
    fixedBox(sheet + bar);
    const inp = box.querySelector('.awx-search'); if(inp && S.focusSearch){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  window.awaelOpen = id => { S.open = id; S.menu = null; S.q = ''; S.pick = null; render(); window.scrollTo(0, 0); };
  window.awaelMenu = id => { S.menu = S.menu === id ? null : id; S.focusSearch = false; render(); };
  window.awaelPick = (g, secId) => {
    S.open = g; S.menu = null; S.q = ''; render();
    const d = document.querySelectorAll('#awael-body .awx-sec'); const secs = (S.sections || []).filter(s => groupOf(s) === g);
    const i = secs.findIndex(s => s.id === secId); d.forEach((el, k) => { el.open = k === i; }); if(d[i]) d[i].scrollIntoView({ behavior:'smooth', block:'start' });
  };
  window.awaelSearch = v => {
    S.q = v; S.focusSearch = true; const m = $('awx-main'); if(!m){ render(); return; }
    if(v.trim()) m.innerHTML = searchHtml(v); else render();
  };
  window.awaelShowRenew = () => {
    const box = $('awael-body'); if(!box) return;
    box.innerHTML = '<div class="awx"><button class="awx-btn awx-back" onclick="awaelOpen(null)">→ رجوع</button>' + payBlock() + '</div>';
  };
  window.awaelSendRequest = async function(){
    const st = $('awael-status'); const price = Number(S.settings && S.settings.price) || 0, days = Number(S.settings && S.settings.days) || 28;
    if(!(price > 0)) return;
    const me = (typeof pendingUser !== 'undefined' && pendingUser) || {};
    st.className = 'awx-status'; st.textContent = 'جاري الإرسال…';
    try{
      await db.collection('awaelPayReqs').doc(currentUid).set({
        uid: currentUid, name: String(me.name || '').slice(0, 80), phone: String(me.phone || '').slice(0, 30),
        amount: price, days: days, ref: String(($('awael-ref') || {}).value || '').trim().slice(0, 60),
        status: 'pending', createdMs: Date.now()
      });
      st.className = 'awx-status ok'; st.textContent = '✓ تم إرسال طلبك. هيتفعل بعد تأكيد التحويل.';
      setTimeout(() => load(true), 800);
    }catch(e){ console.warn(e); st.className = 'awx-status err'; st.textContent = 'حصل خطأ في الإرسال. حاول تاني بعد شوية.'; }
  };
  window.awaelLoad = load;
  window.awaelReset = () => { S.loaded = false; S.sub = S.req = S.sections = null; S.open = null; S.menu = null; S.q = ''; };
})();
