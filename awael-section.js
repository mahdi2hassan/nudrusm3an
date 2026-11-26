/* الخدمات الجامعية (أوائل) داخل نُدرس معًا — اشتراك مستقل مدته days يوم (الافتراضي 28)
   Firestore:
     siteSettings/awaelSection : { enabled, price, days, cash, instapay, whatsapp, note }   (الأدمن يعدّلها)
     awaelPayReqs/{uid}        : طلب دفع من الطالب (status: pending | rejected)
     awaelSubs/{uid}           : الاشتراك الفعلي { status:'active', expiresMs, ... } (الأدمن فقط يكتب)
     awaelContent/{sectionId}  : محتوى الأقسام (يقرأه المشترك النشط فقط)  */
(function(){
  const DAY = 24 * 60 * 60 * 1000;
  const S = { loaded:false, settings:null, sub:null, req:null, sections:null, open:null, err:'' };
  const $ = id => document.getElementById(id);
  const E = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
  function defaults(){ return { enabled:true, price:0, days:28 }; }
  function isActive(){ return !!(S.sub && S.sub.status === 'active' && Number(S.sub.expiresMs) > Date.now()); }
  function daysLeft(){ return S.sub ? Math.max(0, Math.ceil((Number(S.sub.expiresMs) - Date.now()) / DAY)) : 0; }

  async function load(force){
    if(!currentUid){ return; }
    if(S.uid !== currentUid){ S.uid = currentUid; S.loaded = false; S.sub = S.req = S.sections = null; S.open = null; }
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

  function payBlock(){
    const st = S.settings, price = Number(st.price) || 0, days = Number(st.days) || 28;
    const cash = st.cash || (typeof PAY_CASH_NUMBER !== 'undefined' ? PAY_CASH_NUMBER : '');
    const insta = st.instapay || (typeof PAY_INSTAPAY_NUMBER !== 'undefined' ? PAY_INSTAPAY_NUMBER : '');
    const wa = st.whatsapp || (typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '');
    const me = (typeof pendingUser !== 'undefined' && pendingUser) || {};
    const msg = encodeURIComponent('مرحبًا، أنا ' + (me.name || '') + ' حوّلت ' + price + ' جنيه لاشتراك الخدمات الجامعية (' + days + ' يوم) على نُدرس معًا، برجاء التفعيل.');
    if(S.req && S.req.status === 'pending'){
      return '<div class="card-panel"><h3>⏳ طلبك قيد المراجعة</h3><p>بعد تأكيد التحويل من فريقنا هيتفتح الوصول تلقائيًا.</p>' + (wa ? '<a class="btn-primary" target="_blank" rel="noopener" href="https://wa.me/' + E(wa) + '?text=' + msg + '">تواصل واتساب</a>' : '') + '</div>';
    }
    const rejected = S.req && S.req.status === 'rejected' ? '<div class="auth-status err">طلبك السابق اترفض. تأكد من التحويل وابعت الطلب تاني.</div>' : '';
    return '<div class="card-panel"><h3>🎓 الخدمات الجامعية</h3>' +
      '<p>كل خدمات الجامعات المصرية (MIS، النتائج، التسجيل، الروابط الرسمية) في مكان واحد. مدة الاشتراك ' + days + ' يوم، وبعدها الوصول لهذا القسم بس بيتقفل لحد ما تجدد. اشتراك نُدرس معًا مستقل عنه.</p>' +
      '<p><b>السعر: ' + (price > 0 ? price + ' جنيه' : 'سيتم تحديده') + '</b></p>' +
      (insta ? '<p>💜 إنستاباي: <b dir="ltr">' + E(insta) + '</b></p>' : '') + (cash ? '<p>💚 محفظة/كاش: <b dir="ltr">' + E(cash) + '</b></p>' : '') +
      (st.note ? '<p>' + E(st.note) + '</p>' : '') + rejected +
      '<div class="field"><label>رقم التحويل أو آخر 4 أرقام من الرقم اللي حوّلت منه</label><input type="text" id="awael-ref" maxlength="60"></div>' +
      '<button class="btn-primary" onclick="awaelSendRequest()"' + (price > 0 && st.enabled !== false ? '' : ' disabled') + '>حوّلت المبلغ — أرسل الطلب</button>' +
      '<div class="auth-status" id="awael-status"></div></div>';
  }

  function render(){
    const box = $('awael-body'); if(!box) return;
    if(S.err && !S.settings){ box.innerHTML = '<div class="empty-state">' + E(S.err) + '</div>'; return; }
    if(!isActive()){
      const expired = S.sub && Number(S.sub.expiresMs) > 0 ? '<div class="top-banner pending" style="display:block;margin-bottom:12px;">انتهى اشتراك الخدمات الجامعية. جدّد عشان يرجع الوصول.</div>' : '';
      box.innerHTML = expired + payBlock(); return;
    }
    const left = daysLeft();
    const head = '<div class="top-banner active" style="display:block;margin-bottom:12px;">✓ الخدمات الجامعية مفعّلة — باقي ' + left + ' يوم' + (left <= 7 ? ' · <a href="#" onclick="awaelShowRenew();return false;">جدّد الآن</a>' : '') + '</div>';
    if(S.err){ box.innerHTML = head + '<div class="empty-state">' + E(S.err) + '</div>'; return; }
    if(!S.sections || !S.sections.length){ box.innerHTML = head + '<div class="empty-state">المحتوى هيتضاف قريبًا.</div>'; return; }
    if(S.open){
      const sec = S.sections.find(s => s.id === S.open);
      if(sec){ box.innerHTML = head + sectionHtml(sec); return; }
    }
    box.innerHTML = head + '<div class="aw-grid">' + S.sections.map(s =>
      '<button class="aw-card" onclick="awaelOpen(\'' + E(s.id) + '\')"><span class="aw-ic">' + E(s.icon || '📁') + '</span><b>' + E(s.title) + '</b>' + (s.sub ? '<small>' + E(s.sub) + '</small>' : '') + '</button>').join('') + '</div>';
  }
  function sectionHtml(sec){
    const items = (sec.items || []).map(it => {
      if(it.t === 'label') return '<div class="aw-lbl">' + E(it.title) + '</div>';
      const u = safeUrl(it.url); if(!u) return '';
      return '<a class="aw-item" href="' + E(u) + '" target="_blank" rel="noopener noreferrer"><span class="aw-ic">' + E(it.icon || '🔗') + '</span><span><b>' + E(it.title) + '</b>' + (it.desc ? '<small>' + E(it.desc) + '</small>' : '') + '</span></a>';
    }).join('');
    return '<button class="btn-primary" style="margin-bottom:10px;" onclick="awaelOpen(null)">→ رجوع للأقسام</button><h2>' + E(sec.icon || '') + ' ' + E(sec.title) + '</h2>' + (sec.note ? '<div class="empty-state">' + E(sec.note) + '</div>' : '') + '<div class="aw-list">' + items + '</div>';
  }

  window.awaelOpen = id => { S.open = id; render(); window.scrollTo(0, 0); };
  window.awaelShowRenew = () => {
    const box = $('awael-body'); if(!box) return;
    box.innerHTML = '<button class="btn-primary" style="margin-bottom:10px;" onclick="awaelOpen(null)">→ رجوع</button>' + payBlock();
  };
  window.awaelSendRequest = async function(){
    const st = $('awael-status'); const price = Number(S.settings && S.settings.price) || 0, days = Number(S.settings && S.settings.days) || 28;
    if(!(price > 0)) return;
    const me = (typeof pendingUser !== 'undefined' && pendingUser) || {};
    st.className = 'auth-status pending'; st.textContent = 'جاري الإرسال…';
    try{
      await db.collection('awaelPayReqs').doc(currentUid).set({
        uid: currentUid, name: String(me.name || '').slice(0, 80), phone: String(me.phone || '').slice(0, 30),
        amount: price, days: days, ref: String(($('awael-ref') || {}).value || '').trim().slice(0, 60),
        status: 'pending', createdMs: Date.now()
      });
      st.className = 'auth-status ok'; st.textContent = '✓ تم إرسال طلبك. هيتفعل بعد تأكيد التحويل.';
      setTimeout(() => load(true), 800);
    }catch(e){ console.warn(e); st.className = 'auth-status err'; st.textContent = 'حصل خطأ في الإرسال. حاول تاني بعد شوية.'; }
  };
  window.awaelLoad = load;
  window.awaelReset = () => { S.loaded = false; S.sub = S.req = S.sections = null; S.open = null; };
})();
