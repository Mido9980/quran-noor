/* ===== نُور — app ===== */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const LS = 'noor.v2';
  const DEFAULTS = {
    ui: 'ar', theme: 'night', fs: 30, lh: 2.05, showTr: true, trLang: 'ru',
    reciter: 'Alafasy_128kbps', last: null, bm: [], prog: {}, tab: 'home'
  };
  let S = Object.assign({}, DEFAULTS, safeParse(localStorage.getItem(LS)));
  const APP = { meta: null, index: null, texts: {}, norm: {}, current: null };

  function safeParse(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } }
  function dec(x) { try { return decodeURIComponent(x || ''); } catch (e) { return x || ''; } }
  function t(k) { const d = I18N[S.ui] || I18N.ar; return d[k] != null ? d[k] : (I18N.en[k] != null ? I18N.en[k] : k); }
  function isRTL() { return RTL_UI.indexOf(S.ui) >= 0; }
  function ar(n) { return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]); }
  function num(n) { return S.ui === 'ar' || S.ui === 'ur' ? ar(n) : String(n); }
  function total() { return APP.meta ? APP.meta.reduce((a, m) => a + m.verses, 0) : 6236; }
  function cleanName(s) { return String(s || '').replace(/^سُوْرَةُ\s*/, '').replace(/^سورة\s*/, ''); }
  function surahName(n) { return cleanName(APP.meta[n - 1].ar); }

  /* ---------- theme + i18n chrome ---------- */
  function applyUI() {
    document.documentElement.setAttribute('data-theme', S.theme);
    document.documentElement.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', S.ui);
    document.documentElement.style.setProperty('--ayah-size', S.fs + 'px');
    document.documentElement.style.setProperty('--ayah-lh', S.lh);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', S.theme === 'night' ? '#070b18' : S.theme === 'day' ? '#f6f3ec' : '#f2e6ce');
    document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('.tab').forEach(b => {
      const k = b.getAttribute('data-tab');
      b.classList.toggle('active', k === S.tab);
    });
  }

  /* ---------- toast / sheet ---------- */
  let toastT = null;
  function toast(msg) {
    const n = $('#toast'); n.textContent = msg; n.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { n.hidden = true; }, 2200);
  }
  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5Z" fill="currentColor"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 5.5H6.5A2 2 0 0 0 4.5 7.5V16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L8 8m4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    bm: '<svg viewBox="0 0 24 24"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    bmf: '<svg viewBox="0 0 24 24"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    sajda: '<svg viewBox="0 0 24 24"><path d="M4 17h16M7 13.5c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M9.5 7V5h5v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };

  function openSheet(title, sub, opts) {
    const wrap = $('#sheetWrap'), sheet = $('#sheet');
    sheet.innerHTML = '<div class="grab"></div><h3>' + title + '</h3>' + (sub ? '<div class="sub">' + sub + '</div>' : '');
    const box = el('div', 'opts');
    opts.forEach(o => {
      const b = el('button', 'sopt' + (o.cls ? ' ' + o.cls : ''), (o.icon ? o.icon : '') + '<span>' + o.label + '</span>');
      b.addEventListener('click', () => { closeSheet(); o.onClick && o.onClick(); });
      box.appendChild(b);
    });
    sheet.appendChild(box);
    wrap.hidden = false;
  }
  function closeSheet() { $('#sheetWrap').hidden = true; }
  document.addEventListener('click', e => { if (e.target.id === 'sheetBackdrop') closeSheet(); });

  /* ---------- data ---------- */
  async function loadText(code) {
    if (APP.texts[code]) return APP.texts[code];
    const r = await fetch('data/' + code + '.json');
    if (!r.ok) throw new Error('data');
    APP.texts[code] = await r.json();
    return APP.texts[code];
  }
  async function boot() {
    applyUI();
    applyStaticTexts();
    try {
      const [m, ix] = await Promise.all([
        fetch('data/meta.json').then(r => r.json()),
        fetch('data/index.json').then(r => r.json())
      ]);
      APP.meta = m; APP.index = ix;
    } catch (e) { $('#view').innerHTML = '<div class="empty"><p>' + t('error') + '</p></div>'; return; }
    route();
    registerSW();
  }
  function applyStaticTexts() {
    $('#themeBtn').style.display = '';
    $('#topTitle').textContent = 'نُور';
  }

  /* ---------- router ---------- */
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  window.addEventListener('hashchange', route);
  function parts() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    return h ? h.split('/') : [];
  }
  function route() {
    if (!APP.meta) return;
    const p = parts();
    const v = p[0] || 'home';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (v === 's') return renderReader(+p[1], p[2] ? +p[2] : null, 'surah');
    if (v === 'j') return renderReader(+p[1], null, 'juz');
    if (v === 'p') return renderReader(+p[1], null, 'page');
    if (v === 'search') return renderSearch(p[1] || '');
    if (v === 'saved') return renderSaved();
    if (v === 'settings') return renderSettings();
    return renderHome();
  }
  function setTop(title, sub, back) {
    $('#topTitle').textContent = title;
    $('#topSub').textContent = sub || '';
    const b = $('#backBtn');
    b.hidden = !back;
    b.onclick = () => history.length > 1 ? history.back() : go('#/home');
  }
  function setTab(k) { S.tab = k; save(); document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === k)); }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    const k = b.getAttribute('data-tab');
    setTab(k);
    if (k === 'home') go('#/home');
    else if (k === 'read') go('#/home');
    else if (k === 'saved') go('#/saved');
    else go('#/settings');
    if (k === 'read') setTimeout(() => { const s = $('#segList'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }));

  /* ---------- home ---------- */
  function ringSVG(pct) {
    const r = 34, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<div class="ring"><svg viewBox="0 0 86 86">'
      + '<circle cx="43" cy="43" r="' + r + '" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="7"/>'
      + '<circle cx="43" cy="43" r="' + r + '" fill="none" stroke="url(#gg)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>'
      + '<defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--gold)"/></linearGradient></defs>'
      + '</svg><div class="val">' + Math.round(pct) + '<small>' + t('pct') + '</small></div></div>';
  }
  function progressPct() {
    let n = 0; Object.keys(S.prog).forEach(k => { n += S.prog[k]; });
    return Math.min(100, (n / total()) * 100);
  }
  function renderHome() {
    setTop('نُور', t('tagline'));
    setTab('home');
    const v = $('#view'); v.innerHTML = '';
    const pct = progressPct();
    const last = S.last && APP.meta[S.last.s - 1] ? S.last : null;

    const hero = el('div', 'hero fade-in');
    hero.innerHTML = '<div class="txt">'
      + '<div class="kicker">' + t('khatma') + '</div>'
      + '<h3>' + (last ? t('surah_word') + ' ' + surahName(last.s) : t('today')) + '</h3>'
      + '<p>' + (last ? t('verse_word') + ' ' + num(last.v) + ' • ' + t('last_read')
        : num(114) + ' ' + t('surahs') + ' • ' + num(total()) + ' ' + t('verses_unit') + ' • ' + t('offline_ready')) + '</p>'
      + '<button class="cta">' + (last ? t('continue') : t('start')) + '<svg viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>'
      + '</div>' + ringSVG(pct);
    hero.querySelector('.cta').addEventListener('click', () => {
      if (last) go('#/s/' + last.s + '/' + last.v); else go('#/s/1');
    });
    v.appendChild(hero);

    const sb = el('div', 'searchbox');
    sb.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M16 16l4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
      + '<input id="homeSearch" placeholder="' + t('search_ph') + '" />';
    v.appendChild(sb);
    const inp = $('#homeSearch', sb);
    inp.addEventListener('focus', () => go('#/search'));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go('#/search/' + encodeURIComponent(inp.value)); });

    const quick = [1, 18, 36, 55, 67, 56, 2];
    const qw = el('div', 'chips');
    quick.forEach(n => {
      const b = el('button', 'chip', t('surah_word') + ' ' + surahName(n));
      b.addEventListener('click', () => go('#/s/' + n));
      qw.appendChild(b);
    });
    const title = el('div', 'section-title', '<h2>' + t('quick') + '</h2>');
    v.appendChild(title); v.appendChild(qw);

    const seg = el('div', 'seg'); seg.id = 'segList';
    ['surahs', 'juz', 'pages_tab'].forEach((k, i) => {
      const b = el('button', i === 0 ? 'on' : '', t(k));
      b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        fill(i);
      });
      seg.appendChild(b);
    });
    v.appendChild(seg);
    const listBox = el('div', 'list');
    v.appendChild(listBox);

    function fill(mode) {
      listBox.innerHTML = '';
      if (mode === 0) {
        APP.meta.forEach(m => listBox.appendChild(surahRow(m)));
      } else if (mode === 1) {
        APP.index.juz.forEach((st, i) => listBox.appendChild(indexRow(i + 1, t('juz_word') + ' ' + num(i + 1), surahName(st[0]) + ' • ' + t('verse_word') + ' ' + num(st[1]), '#/j/' + (i + 1), i * 7)));
      } else {
        APP.index.pages.forEach((st, i) => listBox.appendChild(indexRow(i + 1, t('page_word') + ' ' + num(i + 1), surahName(st[0]) + ' • ' + t('verse_word') + ' ' + num(st[1]), '#/p/' + (i + 1), i * 3, true)));
      }
    }
    fill(0);
  }
  function surahRow(m) {
    const row = el('div', 'row');
    row.innerHTML = '<div class="orb" style="--h:' + (m.n * 13 % 360) + '">' + num(m.n) + '</div>'
      + '<div class="body"><h4>' + cleanName(m.ar) + (m.n === 1 || m.n === 9 ? '' : '') + '</h4>'
      + '<small>' + (m.type === 'مكية' ? t('makkiya') : t('madaniya')) + ' • ' + num(m.verses) + ' ' + t('verses_unit') + '</small></div>'
      + '<div class="go"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>';
    row.addEventListener('click', () => go('#/s/' + m.n));
    return row;
  }
  function indexRow(n, title, sub, hash, hue, small) {
    const row = el('div', 'row');
    row.innerHTML = '<div class="orb' + (small ? ' flat' : '') + '" style="--h:' + (hue % 360) + '">' + num(n) + '</div>'
      + '<div class="body"><h4>' + title + '</h4><small>' + sub + '</small></div>'
      + '<div class="go"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>';
    row.addEventListener('click', () => go(hash));
    return row;
  }

  /* ---------- reader ---------- */
  function rangeFor(kind, n) {
    // returns {fromS,fromV,toS,toV,label,sub}
    if (kind === 'surah') {
      return { fromS: n, fromV: 1, toS: n, toV: APP.meta[n - 1].verses };
    }
    const arr = kind === 'juz' ? APP.index.juz : APP.index.pages;
    const st = arr[n - 1];
    const nxt = arr[n] || [115, 1];
    let toS = nxt[0], toV = nxt[1] - 1;
    if (toV < 1) { toS = nxt[0] - 1; toV = APP.meta[toS - 1].verses; }
    return { fromS: st[0], fromV: st[1], toS: toS, toV: toV };
  }
  async function renderReader(n, targetVerse, kind) {
    if (kind === 'surah') { if (!n || n < 1 || n > 114) return go('#/home'); }
    else if (!n || n < 1 || n > (kind === 'juz' ? 30 : 604)) return go('#/home');
    const rng = rangeFor(kind, n);
    const m = APP.meta[rng.fromS - 1];
    const label = kind === 'surah' ? cleanName(m.ar) : (kind === 'juz' ? t('juz_word') + ' ' + num(n) : t('page_word') + ' ' + num(n));
    setTop(label, kind === 'surah' ? num(m.verses) + ' ' + t('verses_unit') : surahName(rng.fromS) + ' → ' + surahName(rng.toS), true);
    setTab('read');

    const v = $('#view');
    v.innerHTML = '<div class="skel" style="margin-top:16px"></div><div class="skel" style="margin-top:10px"></div><div class="skel" style="margin-top:10px"></div>';
    let arText;
    try { arText = await loadText('ar'); } catch (e) { v.innerHTML = '<div class="empty"><p>' + t('error') + '</p></div>'; return; }

    const verses = [];
    for (let s = rng.fromS; s <= rng.toS; s++) {
      const st = s === rng.fromS ? rng.fromV : 1;
      const en = s === rng.toS ? rng.toV : APP.meta[s - 1].verses;
      for (let x = st; x <= en; x++) verses.push([s, x]);
    }
    let tr = null;
    if (S.showTr) { try { tr = await loadText(S.trLang); } catch (e) { tr = null; } }
    APP.current = { kind, n, verses };

    v.innerHTML = '';
    const head = el('div', 'reader-head fade-in');
    head.innerHTML = '<p class="sn">' + (kind === 'surah' ? cleanName(m.ar) : label) + '</p>'
      + '<div class="meta">' + (kind === 'surah'
        ? (m.type === 'مكية' ? t('makkiya') : t('madaniya')) + ' • ' + num(m.verses) + ' ' + t('verses_unit')
        : surahName(rng.fromS) + ' • ' + t('verse_word') + ' ' + num(rng.fromV)) + '</div>'
      + '<div class="orn">۞</div>';
    v.appendChild(head);

    const box = el('div', 'verses');
    let lastSurah = 0;
    verses.forEach(pair => {
      const [s, vn] = pair;
      if (kind !== 'surah' && s !== lastSurah) {
        lastSurah = s;
        box.appendChild(el('div', 'surah-divider', t('surah_word') + ' ' + surahName(s) + ' <span class="tag">' + num(APP.meta[s - 1].verses) + '</span>'));
        if (s !== 1 && s !== 9) box.appendChild(el('div', 'basmala', 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'));
      }
      if (kind === 'surah' && vn === 1) {
        lastSurah = s;
        if (s !== 1 && s !== 9) box.appendChild(el('div', 'basmala', 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'));
      }
      box.appendChild(verseCard(s, vn, arText[s - 1][vn - 1], tr ? tr[s - 1][vn - 1] : null));
    });
    if (kind === 'surah') {
      box.appendChild(el('div', 'end-note', '﴿ <b>' + t('surah_word') + ' ' + cleanName(m.ar) + '</b> ﴾'));
      const nav = el('div', 'chips');
      nav.style.justifyContent = 'center';
      nav.style.flexWrap = 'wrap';
      if (n > 1) {
        const b = el('button', 'chip', '‹ ' + surahName(n - 1));
        b.addEventListener('click', () => go('#/s/' + (n - 1)));
        nav.appendChild(b);
      }
      if (n < 114) {
        const b = el('button', 'chip', surahName(n + 1) + ' ›');
        b.addEventListener('click', () => go('#/s/' + (n + 1)));
        nav.appendChild(b);
      }
      box.appendChild(nav);
    }
    v.appendChild(box);

    const bar = el('div', 'reader-bar');
    const trBtn = el('button', 'icon-btn', trOnIcon());
    trBtn.title = t('show_tr');
    trBtn.addEventListener('click', async () => {
      S.showTr = !S.showTr; save();
      trBtn.innerHTML = trOnIcon();
      if (S.showTr) { try { await loadText(S.trLang); } catch (e) { } }
      const vis = Array.from(box.querySelectorAll('.verse')).reverse().find(x => x.getBoundingClientRect().top < 140);
      const keep = vis ? +vis.dataset.v : null;
      await renderReader(n, keep, kind);
    });
    const minus = el('button', 'icon-btn', '<svg viewBox="0 0 24 24"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
    minus.addEventListener('click', () => { S.fs = Math.max(22, S.fs - 2); save(); applyUI(); });
    const plus = el('button', 'icon-btn', '<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
    plus.addEventListener('click', () => { S.fs = Math.min(46, S.fs + 2); save(); applyUI(); });
    const inc = el('button', 'icon-btn', '<svg viewBox="0 0 24 24"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>');
    inc.addEventListener('click', () => go('#/saved'));
    const empty = el('div', 'sp');
    bar.appendChild(trBtn);
    bar.appendChild(el('div', 'lbl', 'Aa'));
    bar.appendChild(minus); bar.appendChild(plus);
    bar.appendChild(empty); bar.appendChild(inc);
    v.appendChild(bar);

    // track progress
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const s = +en.target.dataset.s, vv = +en.target.dataset.v;
        S.last = { s: s, v: vv };
        if (!S.prog[s] || S.prog[s] < vv) S.prog[s] = vv;
        save();
      });
    }, { threshold: 0.6 });
    box.querySelectorAll('.verse').forEach(x => io.observe(x));

    if (targetVerse) {
      const tgt = box.querySelector('.verse[data-v="' + targetVerse + '"]');
      if (tgt) { tgt.classList.add('active'); setTimeout(() => tgt.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220); }
    }
    preparePlaylist(verses);
  }
  function trOnIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M4 6h9M8.5 6v1.5c0 3.6-2 6.6-4.5 8M6 9.5c1 2.3 3 4 5.5 4.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13.5 19l3.2-8 3.2 8M14.8 16.4h3.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function verseCard(s, vn, text, trText) {
    const key = s + ':' + vn;
    const saved = S.bm.indexOf(key) >= 0;
    const card = el('div', 'verse');
    card.dataset.s = s; card.dataset.v = vn;
    const isSajda = APP.index.sajda.some(x => x[0] === s && x[1] === vn);
    card.innerHTML = '<div class="vtop"><span class="vnum">' + num(s) + ' : ' + num(vn) + '</span>'
      + '<span class="vflags">' + (isSajda ? '<span title="' + t('sajda') + '">' + ICON.sajda + '</span>' : '')
      + (saved ? '<span class="bm">' + ICON.bmf + '</span>' : '') + '</span></div>'
      + '<div class="ayah" dir="rtl">' + text + ' <span class="end">﴿' + (S.ui === 'ar' || S.ui === 'ur' ? ar(vn) : vn) + '﴾</span></div>'
      + (trText ? '<div class="tr"' + (S.trLang === 'ur' ? ' dir="rtl"' : '') + '>' + esc(trText) + '</div>' : '');
    card.addEventListener('click', () => verseSheet(s, vn, text, trText));
    return card;
  }
  function esc(s) { return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  function verseSheet(s, vn, text, trText) {
    const key = s + ':' + vn;
    const saved = S.bm.indexOf(key) >= 0;
    const plain = text + '\n\n' + (trText || '') + '\n\n﴿ ' + surahName(s) + ' — ' + vn + ' ﴾\nنُور';
    openSheet(t('surah_word') + ' ' + surahName(s) + ' • ' + t('verse_word') + ' ' + vn, '', [
      { label: t('play'), icon: ICON.play, onClick: () => playVerse(s, vn) },
      { label: t('copy'), icon: ICON.copy, onClick: () => copy(plain) },
      { label: t('share'), icon: ICON.share, onClick: () => shareV(plain) },
      { label: saved ? t('del_bm') : t('save_bm'), icon: saved ? ICON.trash : ICON.bm, cls: saved ? 'danger' : '', onClick: () => toggleBm(key) }
    ]);
  }
  function copy(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast(t('copied')), () => toast(t('copied')));
    else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(t('copied')); }
  }
  function shareV(txt) {
    if (navigator.share) navigator.share({ title: 'نُور', text: txt }).catch(() => { });
    else copy(txt);
  }
  function toggleBm(key) {
    const i = S.bm.indexOf(key);
    if (i >= 0) { S.bm.splice(i, 1); toast(t('del_bm')); } else { S.bm.unshift(key); toast(t('save_bm')); }
    save();
    const p = parts();
    if (p[0] === 's' || p[0] === 'j' || p[0] === 'p') route();
  }

  /* ---------- audio ---------- */
  const RECITERS = {
    Alafasy_128kbps: 'مشاري العفاسي',
    Husary_128kbps: 'محمود خليل الحصري',
    Minshawi_Murattal_128kbps: 'محمد صديق المنشاوي',
    Abdul_Basit_Murattal_192kbps: 'عبد الباسط عبد الصمد',
    Shatri_128kbps: 'أبو بكر الشاطري'
  };
  const audio = new Audio();
  audio.preload = 'none';
  let PLAYLIST = [], PINDEX = -1, playing = false;
  function pad3(n) { return ('00' + n).slice(-3); }
  function preparePlaylist(verses) { PLAYLIST = verses.slice(); }
  function playVerse(s, vn) {
    const i = PLAYLIST.findIndex(p => p[0] === s && p[1] === vn);
    PINDEX = i >= 0 ? i : 0;
    if (i < 0) PLAYLIST = [[s, vn]];
    startTrack();
  }
  function startTrack() {
    const cur = PLAYLIST[PINDEX]; if (!cur) return;
    const [s, vn] = cur;
    audio.src = 'https://everyayah.com/data/' + S.reciter + '/' + pad3(s) + pad3(vn) + '.mp3';
    const pl = $('#player'); pl.hidden = false;
    $('#playerTitle').textContent = t('surah_word') + ' ' + surahName(s) + ' • ' + t('verse_word') + ' ' + vn;
    audio.play().then(() => { playing = true; setPlayIcon(); markActive(s, vn); })
      .catch(() => { toast(t('net_needed')); playing = false; setPlayIcon(); });
  }
  function setPlayIcon() {
    $('#playIcon').setAttribute('d', playing ? 'M8 5h3.2v14H8Zm4.8 0H16v14h-3.2Z' : 'M8 5.5v13l10-6.5Z');
  }
  function markActive(s, vn) {
    document.querySelectorAll('.verse.active').forEach(x => x.classList.remove('active'));
    const n = document.querySelector('.verse[data-s="' + s + '"][data-v="' + vn + '"]');
    if (n) { n.classList.add('active'); }
  }
  audio.addEventListener('ended', () => {
    if (PINDEX < PLAYLIST.length - 1) { PINDEX++; startTrack(); }
    else { playing = false; setPlayIcon(); }
  });
  audio.addEventListener('error', () => { toast(t('net_needed')); playing = false; setPlayIcon(); });
  $('#togglePlay').addEventListener('click', () => {
    if (!audio.src) { const p = parts(); if (PLAYLIST[0]) { PINDEX = 0; startTrack(); } return; }
    if (audio.paused) { audio.play().then(() => { playing = true; setPlayIcon(); }).catch(() => toast(t('net_needed'))); }
    else { audio.pause(); playing = false; setPlayIcon(); }
  });
  $('#nextAyah').addEventListener('click', () => { if (PLAYLIST.length) { PINDEX = Math.min(PLAYLIST.length - 1, PINDEX + 1); startTrack(); } });
  $('#prevAyah').addEventListener('click', () => { if (PLAYLIST.length) { PINDEX = Math.max(0, PINDEX - 1); startTrack(); } });
  $('#closePlayer').addEventListener('click', () => { audio.pause(); playing = false; setPlayIcon(); $('#player').hidden = true; });

  /* ---------- search ---------- */
  function norm(s) {
    return String(s).replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED\u06DF-\u06E8\u06EA-\u06ED]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^\u0621-\u064Aa-zA-Zа-яА-ЯёЁ0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').toLowerCase();
  }
  function normArr(code, data) {
    if (APP.norm[code]) return APP.norm[code];
    APP.norm[code] = data.map(ch => ch.map(v => norm(v)));
    return APP.norm[code];
  }
  async function renderSearch(q) {
    setTop(t('search_title'), t('search_hint'), true);
    setTab('read');
    const v = $('#view');
    v.innerHTML = '';
    const sb = el('div', 'searchbox');
    sb.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M16 16l4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
      + '<input id="q" placeholder="' + t('search_ph') + '" value="' + esc(dec(q)) + '" />';
    v.appendChild(sb);
    const out = el('div', 'list');
    v.appendChild(out);
    const inp = $('#q', sb);
    if (!q) setTimeout(() => inp.focus(), 120);
    let timer = null;
    const run = () => { clearTimeout(timer); timer = setTimeout(() => doSearch(inp.value, out), 260); };
    inp.addEventListener('input', run);
    if (q) doSearch(dec(q), out);
  }
  async function doSearch(query, out) {
    const q = norm(query).trim();
    if (q.length < 2) { out.innerHTML = ''; return; }
    out.innerHTML = '<div class="empty"><p>' + t('searching') + '</p></div>';
    let arData, trData = null;
    try { arData = await loadText('ar'); } catch (e) { out.innerHTML = '<div class="empty"><p>' + t('error') + '</p></div>'; return; }
    if (S.showTr) { try { trData = await loadText(S.trLang); } catch (e) { } }
    const arN = normArr('ar', arData), trN = trData ? normArr(S.trLang, trData) : null;
    const hits = [];
    for (let s = 1; s <= 114 && hits.length < 80; s++) {
      for (let i = 0; i < arN[s - 1].length; i++) {
        if (arN[s - 1][i].indexOf(q) >= 0 || (trN && trN[s - 1][i] && trN[s - 1][i].indexOf(q) >= 0)) {
          hits.push([s, i + 1]);
          if (hits.length >= 80) break;
        }
      }
    }
    out.innerHTML = '';
    if (!hits.length) { out.innerHTML = '<div class="empty"><div class="ei"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div><p>' + t('no_results') + '</p></div>'; return; }
    hits.forEach(([s, vn]) => {
      const row = el('div', 'row');
      const snippet = arData[s - 1][vn - 1];
      const trs = trData ? trData[s - 1][vn - 1] : '';
      row.innerHTML = '<div class="orb" style="--h:' + (s * 13 % 360) + '">' + num(s) + '</div>'
        + '<div class="body"><h4>' + surahName(s) + ' <span class="vnum">' + num(vn) + '</span></h4>'
        + '<small class="rv" style="font-family:AmiriQ,serif;font-size:14px;line-height:1.9;color:var(--text);direction:rtl;text-align:start">' + hl(snippet, query) + '</small>'
        + (trs ? '<small style="margin-top:4px">' + hl(trs.length > 120 ? trs.slice(0, 120) + '…' : trs, query) + '</small>' : '')
        + '</div>';
      row.addEventListener('click', () => go('#/s/' + s + '/' + vn));
      out.appendChild(row);
    });
  }
  function hl(text, q) {
    const raw = esc(text);
    if (!q) return raw;
    const i = raw.toLowerCase().indexOf(String(q).toLowerCase());
    if (i < 0) return raw;
    return raw.slice(0, i) + '<mark>' + raw.slice(i, i + q.length) + '</mark>' + raw.slice(i + q.length);
  }

  /* ---------- saved ---------- */
  function renderSaved() {
    setTop(t('bookmarks'), (S.last ? t('last_read') + ': ' + t('surah_word') + ' ' + surahName(S.last.s) : ''), false);
    setTab('saved');
    const v = $('#view'); v.innerHTML = '';
    if (S.last) {
      const last = el('div', 'hero fade-in');
      last.innerHTML = '<div class="txt"><div class="kicker">' + t('last_read') + '</div>'
        + '<h3>' + t('surah_word') + ' ' + surahName(S.last.s) + '</h3>'
        + '<p>' + t('verse_word') + ' ' + num(S.last.v) + '</p>'
        + '<button class="cta">' + t('continue') + '</button></div>' + ringSVG(progressPct());
      last.querySelector('.cta').addEventListener('click', () => go('#/s/' + S.last.s + '/' + S.last.v));
      v.appendChild(last);
    }
    const title = el('div', 'section-title', '<h2>' + t('bookmarks') + '</h2><span class="hint">' + num(S.bm.length) + '</span>');
    v.appendChild(title);
    if (!S.bm.length) {
      v.appendChild(el('div', 'empty', '<div class="ei">' + ICON.bm + '</div><p>' + t('no_bm') + '</p>'));
      return;
    }
    const list = el('div', 'list');
    S.bm.forEach(k => {
      const [s, vn] = k.split(':').map(Number);
      const row = el('div', 'row');
      row.innerHTML = '<div class="orb" style="--h:' + (s * 13 % 360) + '">' + num(s) + '</div>'
        + '<div class="body"><h4>' + surahName(s) + '</h4><small>' + t('verse_word') + ' ' + num(vn) + '</small></div>'
        + '<div class="go">' + ICON.close + '</div>';
      row.addEventListener('click', e => {
        if (e.target.closest('.go')) { toggleBm(k); renderSaved(); }
        else go('#/s/' + s + '/' + vn);
      });
      list.appendChild(row);
    });
    v.appendChild(list);
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    setTop(t('nav_settings'), '', false);
    setTab('settings');
    const v = $('#view'); v.innerHTML = '';

    function card(rows) { const c = el('div', 'card'); rows.forEach(r => c.appendChild(r)); v.appendChild(c); return c; }
    function row(icon, label, sub, control) {
      const r = el('div', 'srow');
      r.innerHTML = (icon ? '<div class="ico">' + icon + '</div>' : '')
        + '<div class="lbl"><b>' + label + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
      if (control) r.appendChild(control);
      return r;
    }
    function select(opts, val, onChange) {
      const s = document.createElement('select');
      opts.forEach(o => { const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (o[0] === val) op.selected = true; s.appendChild(op); });
      s.addEventListener('change', () => onChange(s.value));
      return s;
    }
    function sw(val, onChange) {
      const w = el('label', 'switch'); const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!val;
      i.addEventListener('change', () => onChange(i.checked));
      w.appendChild(i); w.appendChild(document.createElement('i'));
      return w;
    }
    const icUi = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 12h16M12 4c2.4 2.4 2.4 13.6 0 16M12 4c-2.4 2.4-2.4 13.6 0 16" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
    const icTr = '<svg viewBox="0 0 24 24"><path d="M4 6h9M8.5 6v1.5c0 3.6-2 6.6-4.5 8M6 9.5c1 2.3 3 4 5.5 4.8M13.5 19l3.2-8 3.2 8M14.8 16.4h3.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const icTh = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const icF = '<svg viewBox="0 0 24 24"><path d="M5 19V7h6.5a3.5 3.5 0 0 1 0 7H5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    const icSp = '<svg viewBox="0 0 24 24"><path d="M4 9h16M4 15h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    const icMic = '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    const icDl = '<svg viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    const icInfo = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5.5M12 7.8v.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

    // language + theme
    card([
      row(icUi, t('ui_lang'), UI_NAMES[S.ui], select(Object.keys(UI_NAMES).map(k => [k, UI_NAMES[k]]), S.ui, val => {
        S.ui = val; save(); applyUI(); renderSettings();
      })),
      row(icTr, t('show_tr'), '', sw(S.showTr, val => { S.showTr = val; save(); })),
      row(icTr, t('tr_lang'), TR_NAMES[S.trLang] || '', select(Object.keys(TR_NAMES).map(k => [k, TR_NAMES[k]]), S.trLang, val => {
        S.trLang = val; save(); loadText(val).catch(() => { });
      }))
    ]);

    const th = el('div', 'seg');
    [['night', t('night')], ['day', t('day')], ['paper', t('paper')]].forEach(([k, lbl]) => {
      const b = el('button', S.theme === k ? 'on' : '', lbl);
      b.addEventListener('click', () => { S.theme = k; save(); applyUI(); th.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      th.appendChild(b);
    });
    const c2 = el('div', 'card'); c2.appendChild(row(icTh, t('theme'), '', null)); c2.appendChild(th); v.appendChild(c2);

    // typography
    const fsw = (val, cb) => {
      const i = document.createElement('input'); i.type = 'range'; i.min = '22'; i.max = '46'; i.step = '1'; i.value = val;
      i.addEventListener('input', () => cb(+i.value));
      return i;
    };
    card([
      row(icF, t('font_size'), S.fs + 'px', fsw(S.fs, val => { S.fs = val; save(); applyUI(); })),
      row(icSp, t('line_height'), S.lh.toFixed(2), (() => {
        const i = document.createElement('input'); i.type = 'range'; i.min = '1.6'; i.max = '2.8'; i.step = '0.05'; i.value = S.lh;
        i.addEventListener('input', () => { S.lh = +i.value; save(); applyUI(); });
        return i;
      })()),
      row(icMic, t('reciter'), '', select(Object.keys(RECITERS).map(k => [k, RECITERS[k]]), S.reciter, val => { S.reciter = val; save(); }))
    ]);

    // offline + install
    const offRow = row(icDl, t('offline_ready'), num(114) + ' ' + t('surahs') + ' • ' + num(9) + ' ' + t('tr_lang'), null);
    const instRow = row(icDl, t('install'), '', (() => {
      const b = el('button', 'chip', '↓');
      b.addEventListener('click', async () => {
        if (window.__bip) { window.__bip.prompt(); const r = await window.__bip.userChoice; if (r && r.outcome === 'accepted') toast(t('installed')); window.__bip = null; }
        else toast(t('install'));
      });
      return b;
    })());
    const clearRow = row(icInfo, t('clear'), '', (() => {
      const b = el('button', 'chip', '⟲');
      b.addEventListener('click', () => { S.prog = {}; S.last = null; S.bm = []; save(); toast(t('cleared')); renderSettings(); });
      return b;
    })());
    card([offRow, instRow, clearRow]);

    const about = el('div', 'card');
    about.appendChild(row(icInfo, 'نُور — Noor', t('tagline'), null));
    about.appendChild(el('div', '', '<p style="font-size:12.5px;line-height:1.9;color:var(--muted);font-weight:600;margin:4px 0 12px">' + t('about_txt') + '</p>'));
    v.appendChild(about);
    const credit = el('div', 'end-note', 'EASY CODE • نُور v1.0');
    v.appendChild(credit);
  }

  /* ---------- service worker / install ---------- */
  function registerSW() {
    if ('serviceWorker' in navigator && navigator.serviceWorker && navigator.serviceWorker.register) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__bip = e; });

  /* top buttons */
  $('#searchBtn').addEventListener('click', () => go('#/search'));
  $('#themeBtn').addEventListener('click', () => {
    S.theme = S.theme === 'night' ? 'day' : S.theme === 'day' ? 'paper' : 'night';
    save(); applyUI(); toast(t(S.theme));
  });
  window.addEventListener('scroll', () => {
    $('#topbar').classList.toggle('scrolled', window.scrollY > 6);
  }, { passive: true });

  boot();
})();
