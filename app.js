(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const imageInput = $('imageInput');
  const pasteZone = $('pasteZone');
  const previewCanvas = $('previewCanvas');
  const progressText = $('progressText');
  const bar = $('bar');

  const textInput = $('textInput');
  const importTextBtn = $('importTextBtn');
  const copyImportBtn = $('copyImportBtn');

  const receiverName = $('receiverName');
  const receiverCode = $('receiverCode');
  const deputyName = $('deputyName');
  const deputyCode = $('deputyCode');

  const addRowBtn = $('addRowBtn');
  const rowsBody = $('rowsBody');
  const clearImageBtn = $('clearImageBtn');
  const clearAllBtn = $('clearAllBtn');

  const finalOut = $('finalOut');
  const copyFinalBtn = $('copyFinalBtn');

  const modal = $('modal');
  const closeModalBtn = $('closeModalBtn');
  const saveRowBtn = $('saveRowBtn');
  const mName = $('mName');
  const mCode = $('mCode');
  const mLoc = $('mLoc');
  const mState = $('mState');

  const LOCS = ['لوس','ساندي','بوليتو'];
  // 💡 تم توحيد اسم الحالة إلى "خارج الخدمة"
  const STATES = ['في الميدان','مشغول - اختبار','مشغول - تدريب','خارج الخدمة'];

  let rows = []; // {id,name,code,loc,state}
  let editId = null;

  function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(2,6); }

  function setProgress(p){
    const v = Math.max(0, Math.min(100, Math.round(p)));
    progressText.textContent = v + '%';
    bar.style.setProperty('--w', v + '%');
  }

  function sanitizeCode(s){
    // فقط للحروف والأرقام
    return (s||'').toString().toUpperCase().replace(/[^A-Z0-9-]/g,'').replace(/-+/g,'-').trim();
  }

  function sanitizeArabicName(s){
    const t = (s||'').toString()
      .replace(/[\u200e\u200f\u202a-\u202e]/g,'')
      .replace(/[~`!@#$%^&*()_+=\[\]{};:'\"\\|<>/?،,.؟…]/g,' ')
      .replace(/\d+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    // keep arabic letters and spaces
    const only = t.replace(/[^\u0600-\u06FF\s]/g,' ').replace(/\s+/g,' ').trim();
    return only || t;
  }

  // 💡 تم تحديث هذه الدالة لدعم الأكواد الرقمية (115, 311) والأكواد الحرفية (DA1) معًا
  function bestCodeFromString(text){
    const s = (text||'').toString().toUpperCase().replace(/\s+/g,'');
    
    // 1. مطابقة الأكواد الحرفية القياسية (DA1, N8, etc.)
    const mAlpha = s.match(/\b(DS|DA|AD|D|N|C|T|V|A)-?\d{1,3}\b/);
    if (mAlpha) return mAlpha[0].replace('-', '');
    
    // 2. مطابقة الأكواد الرقمية (115, 311, 406 - من 2 إلى 4 خانات)
    const mDigit = s.match(/\b\d{2,4}\b/);
    if (mDigit) return mDigit[0];
    
    return '';
  }

  function parsePairs(text){
    const out=[];
    const lines = (text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    for (const ln of lines){
      let name='', code='';
      
      // المحاولة الأولى: فصل الكود والاسم بشكل صريح بـ |
      const parts = ln.split('|').map(x=>x.trim()).filter(Boolean);
      if (parts.length>=2){
        name = sanitizeArabicName(parts[0]);
        // استخدام bestCodeFromString لتوحيد استخراج الكود
        code = bestCodeFromString(parts[1]) || sanitizeCode(parts[1]); 
      } 
      
      // المحاولة الثانية: استخراج الكود من السطر كاملاً (وهذا هو المهم لحل مشكلة التوزيع)
      if (!code) {
        code = bestCodeFromString(ln); // ابحث عن كود رقمي/حرفي قوي أولاً
      }
      
      // إذا وجدنا الكود، نحذف الكود من السطر ليبقى الاسم
      if (code) {
        // نستخدم RegExp لضمان حذف الكود حتى لو كان ملتصقاً
        name = sanitizeArabicName(ln.replace(new RegExp(code, 'i'), ' '));
      } else {
        // إذا لم نجد كوداً ذا معنى (رقمي أو حرفي)، نجرب الكود الخام
        code = sanitizeCode(ln.split(' ').pop()); 
        name = sanitizeArabicName(ln.replace(new RegExp(code, 'i'), ' '));
        if (!bestCodeFromString(code)) continue; // نرفض إذا لم يكن الكود المستخلص خامًا ذا معنى
      }
      
      // تنظيف الاسم مرة أخرى
      if (name.toUpperCase().includes(code.toUpperCase())) {
          name = sanitizeArabicName(name.replace(new RegExp(code, "i"), " "));
      }
      
      if (!name || !code) continue;
      out.push({ id: uid(), name, code, loc: 'لوس', state: 'في الميدان' });
    }
    return out;
  }

  function upsertRow(r){
    // استخدام bestCodeFromString لتحديد الكود الأساسي للمقارنة
    const code = bestCodeFromString(r.code) || sanitizeCode(r.code);
    const name = sanitizeArabicName(r.name);
    if (!code || !name) return;
    
    // المقارنة بالكود الموحد فقط
    const idx = rows.findIndex(x => bestCodeFromString(x.code) === bestCodeFromString(code));
    
    const item = { 
        id: r.id || uid(), 
        name, 
        code, 
        loc: LOCS.includes(r.loc)? r.loc:'لوس', 
        // 💡 تم التوحيد هنا
        state: STATES.includes(r.state)? r.state:'في الميدان' 
    };
    
    if (idx>=0) rows[idx] = { ...rows[idx], ...item };
    else rows.push(item);
  }

  function removeRow(id){
    rows = rows.filter(r=>r.id !== id);
  }

  function openModal(mode, row){
    modal.classList.remove('hidden');
    editId = row?.id || null;
    mName.value = row?.name || '';
    mCode.value = row?.code || '';
    mLoc.value = row?.loc || 'لوس';
    mState.value = row?.state || 'في الميدان';
    mName.focus();
  }
  function closeModal(){
    modal.classList.add('hidden');
    editId = null;
  }

  function statePill(state){
    const s = state || 'في الميدان';
    let cls = 'field';
    if (s === 'مشغول - اختبار') cls = 'busy1';
    else if (s === 'مشغول - تدريب') cls = 'busy2';
    // 💡 تم التوحيد هنا
    else if (s === 'خارج الخدمة') cls = 'out';
    return `<span class="pill ${cls}">${s}</span>`;
  }

  function renderRows(){
    rowsBody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.code)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>
          <select data-act="loc" data-id="${r.id}" class="in" style="padding:8px 10px">
            ${LOCS.map(l => `<option value="${l}" ${l===r.loc?'selected':''}>${l}</option>`).join('')}
          </select>
        </td>
        <td>
          <select data-act="state" data-id="${r.id}" class="in" style="padding:8px 10px">
            ${STATES.map(s => `<option value="${s}" ${s===r.state?'selected':''}>${s}</option>`).join('')}
          </select>
          <div style="margin-top:6px">${statePill(r.state)}</div>
        </td>
        <td style="white-space:nowrap">
          <button class="smallBtn" data-act="edit" data-id="${r.id}">تعديل</button>
          <button class="smallBtn danger" data-act="del" data-id="${r.id}">حذف</button>
        </td>
      </tr>
    `).join('');
    updateFinal();
  }

  function updateFinal(){
    const recN = sanitizeArabicName(receiverName.value);
    const recC = bestCodeFromString(receiverCode.value) || sanitizeCode(receiverCode.value);
    const depN = sanitizeArabicName(deputyName.value);
    const depC = bestCodeFromString(deputyCode.value) || sanitizeCode(deputyCode.value);

    // الإقصاء يكون لـ "خارج الخدمة"
    const active = rows.filter(r => r.state !== 'خارج الخدمة');
    const count = active.length;

    const byLoc = {
      'لوس': rows.filter(r=>r.loc==='لوس' && r.state!=='خارج الخدمة'),
      'ساندي': rows.filter(r=>r.loc==='ساندي' && r.state!=='خارج الخدمة'),
      'بوليتو': rows.filter(r=>r.loc==='بوليتو' && r.state!=='خارج الخدمة'),
    };
    const outOfService = rows.filter(r=>r.state==='خارج الخدمة'); // 💡 تم التوحيد هنا

    const lines = [];
    lines.push('📌 استلام العمليات 📌\n');
    lines.push(`المستلم : ${recN || ''}${recC ? ' | ' + recC : ''}\n`);
    lines.push(`النائب : ${depN || ''}${depC ? ' | ' + depC : ''}\n`);
    lines.push(`عدد و اسماء الوحدات الاسعافيه في الميدان :{${count}}\n`);

    lines.push('🏥 مستشفى لوس');
    byLoc['لوس'].forEach(r => lines.push(`${r.name} | ${r.code}${(r.state && r.state.startsWith('مشغول')) ? ` ( ${r.state} )` : ''}`));
    lines.push('');
    lines.push('🏥 مستشفى ساندي');
    byLoc['ساندي'].forEach(r => lines.push(`${r.name} | ${r.code}${(r.state && r.state.startsWith('مشغول')) ? ` ( ${r.state} )` : ''}`));
    lines.push('');
    lines.push('🏥 مستشفى بوليتو');
    byLoc['بوليتو'].forEach(r => lines.push(`${r.name} | ${r.code}${(r.state && r.state.startsWith('مشغول')) ? ` ( ${r.state} )` : ''}`));
    lines.push('');
    // إظهار تفاصيل "خارج الخدمة"
    lines.push(`خارج الخدمة : (${outOfService.length})`);
    outOfService.forEach(r => lines.push(`${r.name} | ${r.code}`));
    lines.push('\n🎙️ تم استلام العمليات و جاهزون للتعامل مع البلاغات\n');
    lines.push('الملاحظات : تحديث');
    finalOut.textContent = lines.join('\n');
  }

  function escapeHtml(str){
    return (str||'').toString()
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  // Clipboard helpers
  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      toast('تم النسخ');
    }catch{
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('تم النسخ');
    }
  }

  function toast(msg){
    // minimal toast
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:12px;bottom:12px;background:rgba(0,0,0,.75);color:#fff;padding:10px 12px;border-radius:12px;z-index:99;font-weight:800';
    document.body.appendChild(el);
    setTimeout(()=>{ el.remove(); }, 1200);
  }

  // OCR (tesseract.js)
  let workerPromise = null;

  async function ensureWorker(){
    if (workerPromise) return workerPromise;
    workerPromise = (async ()=>{
      // Load tesseract from CDN
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      const { createWorker } = window.Tesseract || {};
      if (!createWorker) throw new Error('Tesseract not loaded');
      
      const w = await createWorker('ara+eng', 1, { 
        // تثبيت مصدر الملفات لـ CDN لمنع مشكلات الـ Path
        langPath: 'https://unpkg.com/tesseract.js-lang@5/tessdata',
        logger: m => {
          // 💡 تصحيح شريط التقدم: يتم التحديث بناءً على progress فقط
          if (m?.progress != null) setProgress(m.progress*100);
        }
      });
      
      // 💡 إعدادات OCR محسنة للقوائم
      await w.setParameters({
          tessedit_pageseg_mode: "6", // P_L_SINGLE_BLOCK
          preserve_interword_spaces: "1",
          tessedit_char_blacklist: '[]{}()', 
      });
      return w;
    })();
    return workerPromise;
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if ([...document.scripts].some(s => s.src === src)) return resolve(); 
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
  }

  function fileToImage(file) {
      return new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = reject;
          img.src = url;
      });
  }
  
  function drawPreviewFromImage(img){
    const ctx = previewCanvas.getContext('2d');
    const maxW = previewCanvas.clientWidth || 600;
    const scale = Math.min(1, maxW / img.width);
    previewCanvas.width = Math.floor(img.width * scale);
    previewCanvas.height = Math.floor(img.height * scale);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0,0,previewCanvas.width,previewCanvas.height);
    ctx.drawImage(img,0,0,previewCanvas.width,previewCanvas.height);
  }
  
  function clearPreview(){
    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0,0,previewCanvas.width,previewCanvas.height);
    setProgress(0);
  }

async function runOCRFromFile(file){
    try{
      setProgress(0);
      
      const img = await fileToImage(file);
      drawPreviewFromImage(img); 

      const w = await ensureWorker();
      
      const { data } = await w.recognize(img); // استخدام كائن الصورة مباشرة
      
      const raw = (data?.text || '').trim();
      const cleaned = raw.replace(/\s+\|\s+/g,' | ');

      const pairs = parsePairs(cleaned);

      if (!pairs.length){
        alert('لم يتم استخراج أسماء/أكواد بشكل كافٍ. قد تكون الصورة غير واضحة. استخدم الاستيراد بالنص.');
        setProgress(0);
        textInput.value = cleaned;
        return;
      }
      
      // عرض النص المستخرج في صندوق النص
      textInput.value = pairs.map(p=>`${p.name} | ${p.code}`).join('\n');
      
      // دمج وتوزيع الوحدات على الجدول
      pairs.forEach(upsertRow);
      renderRows(); 
      
      setProgress(100);

    }catch(e){
      console.error(e);
      alert('تعذر استخراج النص. قد يكون اتصال CDN غير مستقر أو الصورة غير واضحة. استخدم الاستيراد بالنص.');
      setProgress(0);
    }
  }

  // Events
  imageInput.addEventListener('change', (e)=>{
    const file = e.target.files?.[0];
    if (file) runOCRFromFile(file);
    imageInput.value = '';
  });

  pasteZone.addEventListener('click', ()=> pasteZone.focus());

  // Paste image via CTRL+V
  document.addEventListener('paste', (e)=>{
    const items = e.clipboardData?.items || [];
    for (const it of items){
      if (it.type && it.type.startsWith('image/')){
        const file = it.getAsFile();
        if (file){
          runOCRFromFile(file);
          e.preventDefault();
          return;
        }
      }
    }
  });

  importTextBtn.addEventListener('click', ()=>{
    const items = parsePairs(textInput.value);
    if (!items.length){ alert('الصق نص صحيح أولاً.'); return; }
    items.forEach(upsertRow);
    renderRows();
  });

  copyImportBtn.addEventListener('click', ()=> copyText(textInput.value || ''));

  addRowBtn.addEventListener('click', ()=> openModal('add', null));

  closeModalBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });

  saveRowBtn.addEventListener('click', ()=>{
    const name = sanitizeArabicName(mName.value);
    const code = bestCodeFromString(mCode.value) || sanitizeCode(mCode.value);
    if (!name || !code){ alert('الاسم والكود مطلوبين'); return; }
    const item = { id: editId || uid(), name, code, loc: mLoc.value, state: mState.value };
    upsertRow(item);
    renderRows();
    closeModal();
  });

  rowsBody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const row = rows.find(r=>r.id===id);
    if (act==='edit' && row) openModal('edit', row);
    if (act==='del'){ removeRow(id); renderRows(); }
  });

  rowsBody.addEventListener('change', (e)=>{
    const el = e.target;
    const act = el.dataset.act;
    const id = el.dataset.id;
    const row = rows.find(r=>r.id===id);
    if (!row) return;
    if (act==='loc') row.loc = LOCS.includes(el.value)? el.value : 'لوس';
    // 💡 تم التوحيد هنا
    if (act==='state') row.state = STATES.includes(el.value)? el.value : 'في الميدان';
    renderRows();
  });

  [receiverName, receiverCode, deputyName, deputyCode].forEach(inp=>{
    inp.addEventListener('input', updateFinal);
  });

  copyFinalBtn.addEventListener('click', ()=> copyText(finalOut.textContent || ''));

  clearImageBtn.addEventListener('click', ()=>{ clearPreview(); });

  clearAllBtn.addEventListener('click', ()=>{
    rows = [];
    renderRows();
    textInput.value = '';
    receiverName.value = '';
    receiverCode.value = '';
    deputyName.value = '';
    deputyCode.value = '';
    setProgress(0);
  });

  // Initial render
  renderRows();
  setProgress(0);
})();
