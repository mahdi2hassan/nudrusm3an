/* لوحة الأدمن: الخدمات الجامعية — الإعدادات، طلبات الدفع، المشتركين، المحتوى */
(function(){
  const DAY = 24 * 60 * 60 * 1000;
  const $ = id => document.getElementById(id);
  const E = s => escapeHtml(String(s == null ? '' : s));
  const fmt = ms => ms ? new Date(ms).toLocaleString('ar-EG', { dateStyle:'medium', timeStyle:'short' }) : '—';
  let CFG = {}, SECS = [];
  const msg = (id, ok, t) => { const el = $(id); if(el){ el.className = 'status ' + (ok ? 'ok' : 'err'); el.textContent = t; } };
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  window.awaelAdminInit = async function(){
    await loadSettings(); loadReqs(); loadSubs(); loadContent();
  };

  async function loadSettings(){
    try{ const d = await db.collection('siteSettings').doc('awaelSection').get(); CFG = d.exists ? d.data() : {}; }catch(e){ console.warn(e); CFG = {}; }
    $('aw-on').checked = CFG.enabled !== false; $('aw-price').value = CFG.price != null ? CFG.price : '';
    $('aw-days').value = CFG.days || 28; $('aw-insta').value = CFG.instapay || ''; $('aw-cash').value = CFG.cash || '';
    $('aw-wa').value = CFG.whatsapp || ''; $('aw-note').value = CFG.note || '';
  }
  window.awaelSaveSettings = async function(){
    const price = Math.max(0, Number($('aw-price').value) || 0), days = Math.min(365, Math.max(1, Math.round(Number($('aw-days').value) || 28)));
    const data = { enabled: $('aw-on').checked, price, days, instapay: $('aw-insta').value.trim(), cash: $('aw-cash').value.trim(), whatsapp: $('aw-wa').value.trim().replace(/[^0-9]/g, ''), note: $('aw-note').value.trim().slice(0, 300), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    try{ await db.collection('siteSettings').doc('awaelSection').set(data, { merge:true }); audit('awael_settings', '', '', 'السعر ' + price + ' · المدة ' + days + ' يوم'); msg('aw-set-status', true, '✓ اتحفظت.'); }
    catch(e){ msg('aw-set-status', false, 'حصل خطأ: ' + e.message); }
  };

  async function loadReqs(){
    const el = $('aw-reqs'); el.innerHTML = '…';
    try{
      const snap = await db.collection('awaelPayReqs').get();
      const list = snap.docs.map(d => Object.assign({ id:d.id }, d.data())).sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
      el.innerHTML = list.length ? list.map(r => '<div class="urow"><div class="u-top"><div><div class="u-name">' + E(r.name || r.id) + ' <span class="badge ' + (r.status === 'pending' ? 'pending_payment' : 'expired') + '">' + (r.status === 'pending' ? 'قيد المراجعة' : 'مرفوض') + '</span></div><div class="u-meta">' + E(r.phone || '') + ' · ' + E(r.amount) + ' جنيه · ' + E(r.days) + ' يوم · مرجع: ' + E(r.ref || '—') + ' · ' + E(fmt(r.createdMs)) + '</div></div></div><div class="u-controls">' +
        (r.status === 'pending' ? '<button class="save-btn" onclick="awaelConfirm(\'' + E(r.id) + '\')">✓ تأكيد الدفع وتفعيل</button><button class="save-btn" onclick="awaelReject(\'' + E(r.id) + '\')">رفض</button>' : '') +
        '<button class="save-btn" onclick="awaelDelReq(\'' + E(r.id) + '\')">حذف</button></div></div>').join('') : '<div class="empty">مفيش طلبات.</div>';
    }catch(e){ el.textContent = 'تعذّر التحميل: ' + e.message; }
  }
  window.awaelConfirm = async function(uid){
    try{
      const rq = (await db.collection('awaelPayReqs').doc(uid).get()).data(); if(!rq) return;
      if(!confirm('تأكيد استلام ' + rq.amount + ' جنيه من ' + (rq.name || uid) + ' وتفعيل الخدمات الجامعية ' + rq.days + ' يوم؟')) return;
      const cur = (await db.collection('awaelSubs').doc(uid).get()).data();
      const now = Date.now(), base = cur && cur.status === 'active' && cur.expiresMs > now ? cur.expiresMs : now;
      const days = Math.min(365, Math.max(1, Number(rq.days) || Number(CFG.days) || 28));
      const expiresMs = base + days * DAY;
      await db.collection('awaelSubs').doc(uid).set({ uid, name: rq.name || '', phone: rq.phone || '', status:'active', expiresMs, activatedMs: (cur && cur.activatedMs) || now, lastPaidMs: now, lastAmount: Number(rq.amount) || 0, confirmedBy: (auth.currentUser && auth.currentUser.email) || '' }, { merge:true });
      await db.collection('awaelPayReqs').doc(uid).delete();
      db.collection('notifications').add({ recipientUid: uid, type:'plan', text:'✓ تم تفعيل الخدمات الجامعية لمدة ' + days + ' يوم', viewId:'v-awael', read:false, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      audit('awael_confirm', uid, rq.name || '', rq.amount + ' جنيه · حتى ' + new Date(expiresMs).toLocaleDateString('ar-EG'));
      toast('اتفعّل الاشتراك.'); loadReqs(); loadSubs();
    }catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };
  window.awaelReject = async function(uid){
    if(!confirm('رفض الطلب؟')) return;
    try{ await db.collection('awaelPayReqs').doc(uid).update({ status:'rejected', rejectedMs: Date.now() }); audit('awael_reject', uid, '', ''); loadReqs(); }catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };
  window.awaelDelReq = async function(uid){
    if(!confirm('حذف الطلب؟')) return;
    try{ await db.collection('awaelPayReqs').doc(uid).delete(); loadReqs(); }catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };

  async function loadSubs(){
    const el = $('aw-subs'); el.innerHTML = '…';
    try{
      const snap = await db.collection('awaelSubs').get();
      const now = Date.now();
      const list = snap.docs.map(d => Object.assign({ id:d.id }, d.data())).sort((a, b) => (b.expiresMs || 0) - (a.expiresMs || 0));
      el.innerHTML = list.length ? list.map(s => { const act = s.status === 'active' && s.expiresMs > now; const left = Math.ceil((s.expiresMs - now) / DAY);
        return '<div class="urow"><div class="u-top"><div><div class="u-name">' + E(s.name || s.id) + ' <span class="badge ' + (act ? 'active' : 'expired') + '">' + (act ? 'باقي ' + left + ' يوم' : 'منتهي') + '</span></div><div class="u-meta">' + E(s.phone || '') + ' · ينتهي ' + E(fmt(s.expiresMs)) + '</div></div></div><div class="u-controls"><button class="save-btn" onclick="awaelExtend(\'' + E(s.id) + '\')">مد أيام</button>' + (act ? '<button class="save-btn" onclick="awaelRevoke(\'' + E(s.id) + '\')">إنهاء الآن</button>' : '') + '</div></div>'; }).join('') : '<div class="empty">مفيش مشتركين.</div>';
    }catch(e){ el.textContent = 'تعذّر التحميل: ' + e.message; }
  }
  window.awaelExtend = async function(uid){
    const n = Math.round(Number(prompt('عدد الأيام اللي هتتضاف:', '7')) || 0); if(!n || n < 1 || n > 365) return;
    try{ const cur = (await db.collection('awaelSubs').doc(uid).get()).data() || {}; const base = cur.status === 'active' && cur.expiresMs > Date.now() ? cur.expiresMs : Date.now();
      await db.collection('awaelSubs').doc(uid).set({ status:'active', expiresMs: base + n * DAY }, { merge:true }); audit('awael_extend', uid, cur.name || '', '+' + n + ' يوم'); loadSubs(); }catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };
  window.awaelRevoke = async function(uid){
    if(!confirm('إنهاء الوصول الآن؟')) return;
    try{ await db.collection('awaelSubs').doc(uid).set({ status:'expired', expiresMs: Date.now() }, { merge:true }); audit('awael_revoke', uid, '', ''); loadSubs(); }catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };

  /* ---------- المحتوى ---------- */
  async function loadContent(){
    const el = $('aw-content'); el.innerHTML = '…';
    try{
      const snap = await db.collection('awaelContent').get();
      SECS = snap.docs.map(d => Object.assign({ id:d.id }, d.data())).sort((a, b) => (a.order || 0) - (b.order || 0));
      renderContent();
    }catch(e){ el.textContent = 'تعذّر التحميل: ' + e.message; }
  }
  function itemRow(it, i){
    if(it.t === 'label') return '<div class="aw-row" data-i="' + i + '" data-t="label"><span>🏷️</span><input class="aw-in" data-k="title" value="' + E(it.title) + '" placeholder="عنوان فرعي"><button class="save-btn" onclick="awaelItemMove(this,-1)">↑</button><button class="save-btn" onclick="awaelItemMove(this,1)">↓</button><button class="save-btn" onclick="this.parentNode.remove()">✕</button></div>';
    return '<div class="aw-row" data-i="' + i + '" data-t="link"><input class="aw-in" style="width:46px" data-k="icon" value="' + E(it.icon || '🔗') + '"><input class="aw-in" data-k="title" value="' + E(it.title) + '" placeholder="العنوان"><input class="aw-in" data-k="desc" value="' + E(it.desc || '') + '" placeholder="وصف"><input class="aw-in" dir="ltr" data-k="url" value="' + E(it.url || '') + '" placeholder="https://"><button class="save-btn" onclick="awaelItemMove(this,-1)">↑</button><button class="save-btn" onclick="awaelItemMove(this,1)">↓</button><button class="save-btn" onclick="this.parentNode.remove()">✕</button></div>';
  }
  function renderContent(){
    const el = $('aw-content');
    el.innerHTML = SECS.length ? SECS.map(s => '<details class="card" data-id="' + E(s.id) + '" style="margin:8px 0;padding:10px;"><summary><b>' + E(s.icon || '') + ' ' + E(s.title) + '</b> <small>(' + (s.items || []).filter(x => x.t !== 'label').length + ' رابط)' + (s.hidden ? ' · مخفي' : '') + '</small></summary>' +
      '<div class="field"><label>الاسم</label><input class="aw-sin" data-k="title" value="' + E(s.title) + '"></div><div class="field"><label>أيقونة (إيموجي)</label><input class="aw-sin" data-k="icon" value="' + E(s.icon || '') + '"></div><div class="field"><label>سطر تحت الاسم</label><input class="aw-sin" data-k="sub" value="' + E(s.sub || '') + '"></div><div class="field"><label>ملاحظة أعلى القسم</label><input class="aw-sin" data-k="note" value="' + E(s.note || '') + '"></div><div class="field"><label>الترتيب</label><input type="number" class="aw-sin" data-k="order" value="' + E(s.order || 0) + '"></div>' +
      '<div class="field"><label>المجموعة (في الشريط السفلي)</label><select class="aw-sin" data-k="group">' + [['services','الخدمات'],['univ','الجامعة'],['research','البحث'],['egypt','كل الجامعات'],['other','أخرى']].map(o => '<option value="' + o[0] + '"' + ((s.group || 'other') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<label><input type="checkbox" class="aw-sin" data-k="hidden" ' + (s.hidden ? 'checked' : '') + ' style="width:auto"> مخفي</label>' +
      '<div class="aw-items">' + (s.items || []).map(itemRow).join('') + '</div>' +
      '<button class="save-btn" onclick="awaelItemAdd(this,\'link\')">+ رابط</button> <button class="save-btn" onclick="awaelItemAdd(this,\'label\')">+ عنوان فرعي</button> <button class="btn" onclick="awaelSaveSection(\'' + E(s.id) + '\')">حفظ القسم</button> <button class="save-btn" onclick="awaelDelSection(\'' + E(s.id) + '\')">حذف القسم</button></details>').join('') : '<div class="empty">مفيش محتوى. استورد المحتوى الأولي أو أضف قسم.</div>';
  }
  window.awaelItemAdd = (btn, t) => { const box = btn.parentNode.querySelector('.aw-items'); const d = document.createElement('div'); d.innerHTML = itemRow(t === 'label' ? { t, title:'' } : { t:'link', icon:'🔗', title:'', desc:'', url:'' }, 0); box.appendChild(d.firstChild); };
  window.awaelItemMove = (btn, dir) => { const row = btn.parentNode, p = row.parentNode; if(dir < 0 && row.previousElementSibling) p.insertBefore(row, row.previousElementSibling); if(dir > 0 && row.nextElementSibling) p.insertBefore(row.nextElementSibling, row); };
  window.awaelSaveSection = async function(id){
    const box = document.querySelector('#aw-content details[data-id="' + id + '"]'); if(!box) return;
    const g = {}; box.querySelectorAll('.aw-sin').forEach(i => { g[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; });
    const items = []; let bad = '';
    box.querySelectorAll('.aw-row').forEach(r => {
      const o = { t: r.dataset.t }; r.querySelectorAll('.aw-in').forEach(i => { o[i.dataset.k] = i.value.trim(); });
      if(o.t === 'link'){ if(!/^https?:\/\//i.test(o.url)) { bad = 'الرابط لازم يبدأ بـ https:// : ' + (o.title || o.url); } if(!o.title) bad = 'رابط من غير عنوان'; }
      items.push(o);
    });
    if(bad){ toast(bad, { type:'err' }); return; }
    try{ await db.collection('awaelContent').doc(id).set({ title: g.title.trim(), icon: g.icon.trim(), sub: g.sub.trim(), note: g.note.trim(), order: Number(g.order) || 0, hidden: !!g.hidden, group: g.group || 'other', items, updatedMs: Date.now() }); audit('awael_content', '', g.title, 'حفظ قسم'); toast('اتحفظ القسم.'); loadContent(); }
    catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };
  window.awaelDelSection = async function(id){
    if(!confirm('حذف القسم بالكامل؟')) return;
    try{ await db.collection('awaelContent').doc(id).delete(); audit('awael_content', '', id, 'حذف قسم'); loadContent(); }catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };
  window.awaelAddSection = async function(){
    const t = ($('aw-new-title').value || '').trim(); let id = slug($('aw-new-id').value);
    if(!t || !id){ toast('اكتب الاسم ومعرّف بحروف إنجليزية.', { type:'err' }); return; }
    try{ if((await db.collection('awaelContent').doc(id).get()).exists){ toast('المعرّف مستخدم.', { type:'err' }); return; }
      await db.collection('awaelContent').doc(id).set({ title: t, icon:'📁', sub:'', note:'', order: SECS.length + 1, hidden:false, items:[], updatedMs: Date.now() }); $('aw-new-title').value = $('aw-new-id').value = ''; loadContent(); }
    catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };
  window.awaelImportSeed = async function(){
    if(SECS.length && !confirm('فيه محتوى موجود. الاستيراد هيكتب فوق الأقسام اللي بنفس المعرّف. تكمل؟')) return;
    try{
      const r = await fetch('awael-seed.json', { cache:'no-store' }); if(!r.ok) throw new Error('الملف مش موجود');
      const seed = await r.json(); let n = 0;
      for(const s of seed.sections){ await db.collection('awaelContent').doc(slug(s.id)).set({ title:s.title, icon:s.icon || '', sub:s.sub || '', note:s.note || '', order:s.order || 0, hidden:false, group:s.group || 'other', items:s.items || [], updatedMs: Date.now() }); n++; }
      audit('awael_content', '', '', 'استيراد ' + n + ' قسم'); toast('اتستورد ' + n + ' قسم.'); loadContent();
    }catch(e){ toast('حصل خطأ: ' + e.message, { type:'err' }); }
  };
})();
