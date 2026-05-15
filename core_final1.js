(function () {
    'use strict';

    // ================================================================
    //  SHARED CONFIG & UTILITIES
    // ================================================================

    var MAX_ASINS_TRACKER = 50;
    var MAX_KWS_TRACKER   = 50;
    var MAX_ASINS_PDP     = 5000;
    var CONCURRENT_REQUESTS = 4; // slightly reduced for reliability

    var TIERS = {
        'Tier 1': [
            { city: 'Mumbai',    pin: '400001' },
            { city: 'Delhi',     pin: '110001' },
            { city: 'Bangalore', pin: '560001' },
            { city: 'Hyderabad', pin: '500001' },
            { city: 'Gurugram',  pin: '122001' },
            { city: 'Pune',      pin: '411001' },
            { city: 'Chennai',   pin: '600001' },
            { city: 'Kolkata',   pin: '700001' }
        ],
        'Tier 2': [
            { city: 'Jaipur',     pin: '302001' },
            { city: 'Lucknow',    pin: '226001' },
            { city: 'Ahmedabad',  pin: '380001' },
            { city: 'Chandigarh', pin: '160001' },
            { city: 'Kochi',      pin: '682001' },
            { city: 'Indore',     pin: '452001' },
            { city: 'Nagpur',     pin: '440001' },
            { city: 'Coimbatore', pin: '641001' }
        ],
        'Tier 3': [
            { city: 'Shimla',   pin: '171001' },
            { city: 'Ranchi',   pin: '834001' },
            { city: 'Bhopal',   pin: '462001' },
            { city: 'Patna',    pin: '800001' },
            { city: 'Guwahati', pin: '781001' },
            { city: 'Varanasi', pin: '221001' },
            { city: 'Dehradun', pin: '248001' },
            { city: 'Mysore',   pin: '570001' }
        ]
    };

    function wt(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function tdy() {
        return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function shk(el) {
        if (!el) return;
        el.style.borderColor = '#e53935';
        setTimeout(function () { el.style.borderColor = ''; }, 1500);
    }

    function pList(raw, max) {
        var out = [];
        raw.replace(/\n/g, ',').split(',').forEach(function (v) {
            v = v.trim();
            if (v && out.length < max) out.push(v);
        });
        return out;
    }

    function pAsins(raw, max) {
        var seen = {};
        var out  = [];
        raw.split(/[\s,\n]+/).filter(Boolean).forEach(function (v) {
            var u = v.trim().toUpperCase();
            if (u && !seen[u] && out.length < max) { seen[u] = true; out.push(u); }
        });
        return out;
    }

    function pKws(raw, max) {
        var out = [];
        pList(raw, max).forEach(function (v) {
            if (out.indexOf(v) === -1) out.push(v);
        });
        return out;
    }

    function downloadCSV(filename, rows) {
        var csv = rows.map(function (r) {
            return r.map(function (c) {
                var s = String(c == null ? '' : c);
                return '"' + s.replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\n');
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function waitWhilePaused(flagFn) {
        return new Promise(function (resolve) {
            (function check() {
                if (!flagFn()) resolve();
                else setTimeout(check, 300);
            })();
        });
    }

    function cleanText(s) {
        return (s || '').replace(/\s+/g, ' ').replace(/[\u200e\u200f\u00a0]/g, ' ').trim();
    }

    // Safe query — returns element or null, never throws
    function q(doc, sel) {
        try { return doc.querySelector(sel); } catch(e) { return null; }
    }
    function qa(doc, sel) {
        try { return Array.from(doc.querySelectorAll(sel)); } catch(e) { return []; }
    }

    // ================================================================
    //  CSS
    // ================================================================

    function injectCSS() {
        if (document.getElementById('maCSS')) return;
        var s = document.createElement('style');
        s.id = 'maCSS';
        s.textContent = `
/* ── FAB ── */
#maFAB{position:fixed;bottom:22px;right:22px;width:54px;height:54px;border-radius:50%;background:#1a1a2e;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.3);z-index:2147483647;transition:transform .15s;}
#maFAB:hover{transform:scale(1.08);}
#maFAB svg{width:26px;height:26px;fill:#fff;pointer-events:none;}
#maFAB .maFABLabel{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:9px;color:#fff;background:#1a1a2e;padding:1px 5px;border-radius:4px;white-space:nowrap;font-family:"Segoe UI",Arial,sans-serif;letter-spacing:.3px;}
/* ── MENU ── */
#maMenu{position:fixed;bottom:88px;right:22px;background:#fff;border-radius:12px;border:1px solid #e0e0e0;box-shadow:0 6px 28px rgba(0,0,0,.18);z-index:2147483646;display:none;overflow:hidden;font-family:"Segoe UI",Arial,sans-serif;min-width:210px;}
#maMenu.open{display:block;}
.maMenuHead{background:#1a1a2e;color:#fff;padding:10px 14px;font-size:12px;font-weight:600;letter-spacing:.3px;}
.maMenuItem{display:flex;align-items:center;gap:12px;padding:11px 14px;cursor:pointer;border-bottom:1px solid #f5f5f5;transition:background .12s;}
.maMenuItem:last-child{border-bottom:none;}
.maMenuItem:hover{background:#f8f9fa;}
.maMenuIcon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.maMenuIcon svg{width:18px;height:18px;fill:#fff;}
.maMenuText{display:flex;flex-direction:column;gap:1px;}
.maMenuTitle{font-size:13px;font-weight:600;color:#1a1a2e;}
.maMenuSub{font-size:10px;color:#888;}
/* ── PANELS ── */
.maPanel{position:fixed;bottom:88px;right:16px;width:96vw;max-width:1600px;max-height:88vh;background:#fff;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.22);border:1px solid #e0e0e0;display:none;flex-direction:column;overflow:hidden;font-family:"Segoe UI",Arial,sans-serif;z-index:2147483645;}
.maPanel.open{display:flex;}
.maPH{padding:12px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;color:#fff;}
.maPH h3{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;}
.maPH svg{width:18px;height:18px;fill:#fff;}
.maClose{background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.maClose:hover{background:rgba(255,255,255,.35);}
.maBack{background:rgba(255,255,255,.2);border:none;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;}
.maBack:hover{background:rgba(255,255,255,.35);}
.maBack svg{width:12px;height:12px;fill:#fff;}
.maPB{padding:16px;overflow-y:auto;flex:1;}
/* ── FORM ── */
.maRow{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;}
.maField{display:flex;flex-direction:column;gap:3px;}
.maField label{font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.4px;}
.maField textarea,.maField select,.maField input{padding:7px 11px;border:1.5px solid #ddd;border-radius:7px;font-size:13px;outline:none;resize:vertical;font-family:inherit;box-sizing:border-box;transition:border-color .2s;}
.maField textarea:focus,.maField select:focus,.maField input:focus{border-color:#0070c9;}
.maCnt{font-size:10px;color:#999;text-align:right;margin-top:1px;}
.maCntW{color:#e65100;}.maCntE{color:#c62828;}
/* ── BUTTONS ── */
.maBP{padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:opacity .15s;color:#fff;}
.maBP:disabled{opacity:.45;cursor:not-allowed;}
.maBS{padding:8px 14px;border:1.5px solid #ddd;border-radius:7px;background:#f5f5f5;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.maBS:hover{background:#eee;}
.bgB{background:#0070c9;}.bgB:hover:not(:disabled){opacity:.88;}
.bgO{background:#e65100;}.bgO:hover:not(:disabled){opacity:.88;}
.bgG{background:#2e7d32;}.bgG:hover:not(:disabled){opacity:.88;}
.maPauseBtn{padding:8px 14px;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:#fff;background:#f57f17;transition:background .15s;}
.maPauseBtn.paused{background:#2e7d32;}
.maPauseBtn:hover{opacity:.88;}
/* ── PROGRESS ── */
.maPg{display:none;margin-bottom:12px;}
.maPg.on{display:block;}
.maPgB{height:7px;background:#eee;border-radius:4px;overflow:hidden;}
.maPgF{height:100%;border-radius:4px;transition:width .3s;width:0%;}
.maPgT{font-size:11px;color:#777;margin-top:3px;}
/* ── STATUS SUMMARY BAR ── */
.maSumBar{display:none;gap:8px;flex-wrap:wrap;margin-bottom:10px;padding:8px 12px;background:#f8f9fa;border-radius:8px;border:1px solid #eee;}
.maSumBar.on{display:flex;}
.maSumChip{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
.scOk{background:#e8f5e9;color:#2e7d32;}
.scRd{background:#fff3e0;color:#e65100;}
.scNa{background:#ffebee;color:#b71c1c;}
.scEr{background:#fce4ec;color:#880e4f;}
.scTt{background:#e3f2fd;color:#1565c0;}
/* ── STATUS TAGS ── */
.maSt{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;margin-bottom:10px;}
.maStB{background:#fff3e0;color:#e65100;}
.maStD{background:#e8f5e9;color:#2e7d32;}
.maStP{background:#fff8e1;color:#f57f17;}
/* ── TABLE ── */
.maTW{overflow:auto;border-radius:7px;border:1px solid #e0e0e0;max-height:52vh;}
.maTbl{width:100%;border-collapse:collapse;font-size:11.5px;}
.maTbl thead th{background:#1a1a2e;color:#fff;padding:8px 8px;text-align:left;font-weight:600;border-bottom:2px solid #0d0d1a;white-space:nowrap;position:sticky;top:0;z-index:2;font-size:10.5px;}
.maTbl thead th:hover{background:#263238;cursor:default;}
.maTbl tbody td{padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#444;vertical-align:middle;}
.maTbl tbody tr:hover{background:#fafafa;}
.maTbl tbody tr.maErr{background:#fff8f8;}
.maTbl tbody tr.maRedir{background:#fffbf0;}
/* ── PIVOT ── */
.maPivotWrap{overflow:auto;border-radius:7px;border:1px solid #e0e0e0;max-height:45vh;}
.maPivotTbl{border-collapse:collapse;font-size:11px;}
.maPivotTbl th{background:#1a1a2e;color:#fff;padding:7px 10px;white-space:nowrap;font-weight:600;position:sticky;top:0;z-index:2;}
.maPivotTbl th.pRowH{background:#263238;min-width:90px;}
.maPivotTbl th.pKwH{background:#1a237e;color:#e8eaf6;}
.maPivotTbl td{padding:5px 10px;border:1px solid #f0f0f0;text-align:center;white-space:nowrap;}
.maPivotTbl td.pRowL{background:#f8f9fa;text-align:left;font-weight:600;color:#333;}
.maPivotTbl td.pRowL span{display:block;font-size:10px;color:#0070c9;font-weight:400;}
.pT{background:#e8f5e9;color:#1b5e20;font-weight:700;}
.pM{background:#fff9c4;color:#f57f17;font-weight:700;}
.pL{background:#fff3e0;color:#e65100;}
.pOt{background:#fafafa;color:#555;}
.pNF{background:#ffebee;color:#b71c1c;font-style:italic;}
/* ── VIEW TOGGLE ── */
.maViewToggle{display:flex;gap:6px;margin-bottom:10px;}
.maVBtn{padding:5px 14px;border-radius:6px;border:1.5px solid #ddd;font-size:12px;font-weight:600;cursor:pointer;background:#f5f5f5;color:#555;transition:all .15s;}
.maVBtn.active{background:#1a1a2e;color:#fff;border-color:#1a1a2e;}
/* ── BADGES ── */
.maB{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;display:inline-block;white-space:nowrap;}
.bFBA{background:#e3f2fd;color:#1565c0;}
.bMFN{background:#fce4ec;color:#c62828;}
.bOrg{background:#e8f5e9;color:#2e7d32;}
.bSpo{background:#fff3e0;color:#e65100;}
.bSP{background:#e3f2fd;color:#1565c0;}
.bSB{background:#f3e5f5;color:#7b1fa2;}
.bSD{background:#fce4ec;color:#c62828;}
.bNA{background:#f5f5f5;color:#999;}
.bDl{background:#b71c1c;color:#fff;}
.bNF{background:#ffebee;color:#b71c1c;}
.bIS{background:#e8f5e9;color:#2e7d32;}
.bOOS{background:#ffebee;color:#b71c1c;}
.bLim{background:#fff8e1;color:#f57f17;}
.bCpn{background:#f3e5f5;color:#6a1b9a;}
.bSNS{background:#e0f7fa;color:#00695c;}
.bAP{background:#e8eaf6;color:#283593;}
.bRet{background:#e8f5e9;color:#1b5e20;}
.bNRet{background:#ffebee;color:#b71c1c;}
.bYes{background:#e8f5e9;color:#2e7d32;}
.bNo{background:#f5f5f5;color:#999;}
.bAC{background:#232f3e;color:#ff9900;font-weight:800;}
.bPrime{background:#232f3e;color:#00a8e0;}
.bBB{background:#f0f2f2;color:#0f1111;border:1px solid #ccc;}
.bRedir{background:#fff3e0;color:#e65100;}
.bUnavail{background:#ffebee;color:#b71c1c;}
/* ── RANK COLORS ── */
.rT{color:#2e7d32;font-weight:700;}
.rM{color:#f57f17;font-weight:700;}
.rL{color:#e65100;font-weight:600;}
.rO{color:#555;font-weight:600;}
.rN{color:#b71c1c;font-style:italic;}
/* ── DELIVERY ── */
.dS{color:#2e7d32;font-weight:600;font-size:11px;}
.dF{color:#1565c0;font-weight:600;font-size:11px;}
/* ── MISC ── */
.maTB{background:#fafafa;border:1px solid #eee;border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#666;display:none;}
.maTB.on{display:block;}
.maTBChips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}
.maTBChip{background:#fff3e0;color:#e65100;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:500;}
.maLg{background:#1a1a2e;color:#00ff88;font-family:Consolas,monospace;font-size:10.5px;padding:8px 12px;border-radius:7px;max-height:72px;overflow-y:auto;margin-bottom:10px;line-height:1.55;display:none;}
.maLg.on{display:block;}
.lC{color:#00b4d8;}.lK{color:#ffd60a;}.lG{color:#00ff88;}.lR{color:#ff6b6b;}.lP{color:#c77dff;}.lA{color:#ff9e00;}
.maSm{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:7px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#555;display:none;}
.maSm.on{display:block;}
.maSm b{color:#333;}.maSmE{color:#e65100;font-weight:600;}
.maEm{text-align:center;padding:36px;color:#aaa;font-size:13px;}
.maAb{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;}
.maAb span{font-size:13px;color:#777;}
.maSp{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:maSpA .6s linear infinite;}
@keyframes maSpA{to{transform:rotate(360deg);}}
.maCell{font-size:11px;line-height:1.5;}
/* ── INFO BANNER ── */
.maInfoBanner{font-size:11px;color:#888;background:#fafafa;border:1px solid #eee;border-radius:7px;padding:8px 12px;margin-bottom:12px;line-height:1.6;}
.maInfoBanner b{color:#333;}
.maInfoBanner .hiOrange{color:#e65100;font-weight:600;}
        `;
        document.head.appendChild(s);
    }

    // ================================================================
    //  LAUNCHER + MENU
    // ================================================================

    var menuOpen = false;

    function buildLauncher() {
        if (document.getElementById('maFAB')) return;
        var fab = document.createElement('div');
        fab.id  = 'maFAB';
        fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg><span class="maFABLabel">Assistant</span>`;
        fab.onclick = toggleMenu;
        document.body.appendChild(fab);

        var menu = document.createElement('div');
        menu.id = 'maMenu';
        menu.innerHTML = `
          <div class="maMenuHead">&#9889; Select Tool</div>
          <div class="maMenuItem" id="maMenuT1">
            <div class="maMenuIcon" style="background:#0070c9;">
              <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </div>
            <div class="maMenuText"><span class="maMenuTitle">ASIN Rank Tracker</span><span class="maMenuSub">Keyword × City × Position + Pivot</span></div>
          </div>
          <div class="maMenuItem" id="maMenuT2">
            <div class="maMenuIcon" style="background:#e65100;">
              <svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 15.93.5 13.5.5c-1.32 0-2.5.54-3.36 1.4L9 3.06 7.86 1.9C7 1.04 5.82.5 4.5.5 2.07.5 0 2.51 0 4.64c0 .48.11.92.18 1.36H0v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
            </div>
            <div class="maMenuText"><span class="maMenuTitle">Bulk PDP Scraper</span><span class="maMenuSub">40+ fields · BSR · Offers · Buy Box · AC</span></div>
          </div>`;
        document.body.appendChild(menu);

        document.getElementById('maMenuT1').onclick = function () { openTool('tracker'); };
        document.getElementById('maMenuT2').onclick = function () { openTool('pdp'); };
        document.addEventListener('click', function (e) {
            if (!fab.contains(e.target) && !menu.contains(e.target)) closeMenu();
        });
    }

    function toggleMenu() { menuOpen = !menuOpen; document.getElementById('maMenu').classList.toggle('open', menuOpen); }
    function closeMenu()  { menuOpen = false; var m = document.getElementById('maMenu'); if (m) m.classList.remove('open'); }

    function openTool(which) {
        closeMenu();
        var t = document.getElementById('maTrackerPanel');
        var p = document.getElementById('maPDPPanel');
        if (which === 'tracker') { if (t) t.classList.toggle('open'); if (p) p.classList.remove('open'); }
        else                     { if (p) p.classList.toggle('open'); if (t) t.classList.remove('open'); }
    }

    // ================================================================
    //  TOOL 1 — ASIN KEYWORD RANK TRACKER  (unchanged logic)
    // ================================================================

    var tBusy = false, tPaused = false, tData = [], tView = 'table';

    function buildTrackerPanel() {
        if (document.getElementById('maTrackerPanel')) return;
        var d = document.createElement('div');
        d.id = 'maTrackerPanel'; d.className = 'maPanel';
        d.innerHTML = `
<div class="maPH" style="background:linear-gradient(135deg,#0070c9,#0091ea);">
  <h3><svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>ASIN Rank Tracker</h3>
  <div style="display:flex;align-items:center;gap:8px;">
    <button class="maBack" id="t1Back"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>Tools</button>
    <button class="maClose" id="t1Close">&#215;</button>
  </div>
</div>
<div class="maPB">
  <div class="maRow">
    <div class="maField" style="min-width:180px;">
      <label>ASINs (max ${MAX_ASINS_TRACKER})</label>
      <textarea id="t1A" rows="3" style="width:200px;min-height:58px;" placeholder="B0C12F21G0&#10;B07JPGWH5R"></textarea>
      <div class="maCnt" id="t1AC">0/${MAX_ASINS_TRACKER}</div>
    </div>
    <div class="maField" style="flex:1;min-width:240px;">
      <label>Keywords (max ${MAX_KWS_TRACKER})</label>
      <textarea id="t1K" rows="3" style="width:100%;min-height:58px;" placeholder="baby wipes, wet wipes"></textarea>
      <div class="maCnt" id="t1KC">0/${MAX_KWS_TRACKER}</div>
    </div>
    <div class="maField">
      <label>Tier</label>
      <select id="t1T" style="width:145px;"><option value="">-- Select --</option><option>Tier 1</option><option>Tier 2</option><option>Tier 3</option></select>
    </div>
    <div class="maField">
      <label>Max Pages</label>
      <input type="number" id="t1P" value="3" min="1" max="10" style="width:66px;">
    </div>
  </div>
  <div class="maRow">
    <button class="maBP bgB" id="t1Go">&#128269; Execute</button>
    <button class="maPauseBtn" id="t1Pause" style="display:none;">&#9646;&#9646; Pause</button>
    <button class="maBS" id="t1Cl">&#128465; Clear</button>
  </div>
  <div class="maSm" id="t1Sm"></div>
  <div class="maTB" id="t1TB"><strong id="t1TN"></strong> — Cities:<div class="maTBChips" id="t1TC"></div></div>
  <div class="maLg" id="t1Lg"></div>
  <div class="maPg" id="t1Pg"><div class="maPgB"><div class="maPgF" id="t1Fl" style="background:linear-gradient(90deg,#0070c9,#0091ea);"></div></div><div class="maPgT" id="t1PT">...</div></div>
  <div id="t1St"></div>
  <div class="maAb" id="t1Ab" style="display:none;">
    <div class="maViewToggle"><button class="maVBtn active" id="t1VT">&#9776; Table</button><button class="maVBtn" id="t1VP">&#9783; Pivot</button></div>
    <span id="t1Rc"></span>
    <button class="maBP bgG" id="t1Ex">&#128229; Export CSV</button>
  </div>
  <div id="t1Rs"><div class="maEm">Enter ASINs + Keywords + Tier to begin</div></div>
</div>`;
        document.body.appendChild(d);
        document.getElementById('t1Close').onclick = function () { document.getElementById('maTrackerPanel').classList.remove('open'); };
        document.getElementById('t1Back').onclick  = function () { document.getElementById('maTrackerPanel').classList.remove('open'); toggleMenu(); };
        document.getElementById('t1Pause').addEventListener('click', function () {
            tPaused = !tPaused;
            this.textContent = tPaused ? '▶ Resume' : '⏸ Pause';
            this.classList.toggle('paused', tPaused);
            document.getElementById('t1St').innerHTML = tPaused
                ? '<div class="maSt maStP">⏸ Paused</div>'
                : '<div class="maSt maStB">▶ Resumed…</div>';
        });
        document.getElementById('t1VT').addEventListener('click', function () { tView='table'; document.getElementById('t1VT').classList.add('active'); document.getElementById('t1VP').classList.remove('active'); renderTrackerView(); });
        document.getElementById('t1VP').addEventListener('click', function () { tView='pivot'; document.getElementById('t1VP').classList.add('active'); document.getElementById('t1VT').classList.remove('active'); renderTrackerView(); });
        document.getElementById('t1T').addEventListener('change', function () {
            var v=this.value; var bx=document.getElementById('t1TB'); var nm=document.getElementById('t1TN'); var ch=document.getElementById('t1TC');
            if (v && TIERS[v]) { nm.textContent=v; ch.innerHTML=TIERS[v].map(function(c){return '<span class="maTBChip">'+c.city+' ('+c.pin+')</span>';}).join(''); bx.classList.add('on'); }
            else bx.classList.remove('on');
            updateT1Summary();
        });
        ['t1A','t1K','t1P'].forEach(function(id){ document.getElementById(id).addEventListener('input', function(){
            if(id==='t1A'){var n=pAsins(this.value,MAX_ASINS_TRACKER).length;var c=document.getElementById('t1AC');c.textContent=n+'/'+MAX_ASINS_TRACKER;c.className='maCnt'+(n>=MAX_ASINS_TRACKER?' maCntE':n>=MAX_ASINS_TRACKER*.8?' maCntW':'');}
            if(id==='t1K'){var n2=pKws(this.value,MAX_KWS_TRACKER).length;var c2=document.getElementById('t1KC');c2.textContent=n2+'/'+MAX_KWS_TRACKER;c2.className='maCnt'+(n2>=MAX_KWS_TRACKER?' maCntE':n2>=MAX_KWS_TRACKER*.8?' maCntW':'');}
            updateT1Summary();
        });});
        document.getElementById('t1Go').addEventListener('click', runTracker);
        document.getElementById('t1Cl').addEventListener('click', clearTracker);
        document.getElementById('t1Ex').addEventListener('click', exportTrackerCSV);
    }

    function updateT1Summary() {
        var as=pAsins(document.getElementById('t1A').value||'',MAX_ASINS_TRACKER);
        var ks=pKws(document.getElementById('t1K').value||'',MAX_KWS_TRACKER);
        var tier=document.getElementById('t1T').value;
        var mp=parseInt(document.getElementById('t1P').value)||3;
        var ci=(tier&&TIERS[tier])?TIERS[tier].length:0;
        var sm=document.getElementById('t1Sm');
        if(!as.length&&!ks.length){sm.classList.remove('on');return;}
        var tot=ci*as.length*ks.length;
        var est=Math.ceil(((ci*1.2)+(ci*as.length*1.0)+(tot*mp*1.5))/60);
        sm.innerHTML='<b>'+as.length+'</b> ASIN &times; <b>'+ks.length+'</b> KW &times; <b>'+ci+'</b> cities = <b>'+tot+'</b> combos | Est: <span class="maSmE">~'+est+' min</span>';
        sm.classList.add('on');
    }

    function t1Log(h){var el=document.getElementById('t1Lg');if(!el)return;el.classList.add('on');el.innerHTML+=h+'<br>';el.scrollTop=el.scrollHeight;}

    function setPin(pin){
        return fetch('https://www.amazon.in/gp/delivery/ajax/address-change.html',{
            method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
            body:'locationType=LOCATION_INPUT&zipCode='+pin+'&storeContext=hpc&deviceType=web&pageType=Detail&actionSource=glow',
            credentials:'include'
        }).then(function(r){if(!r.ok)throw new Error('Pin fail '+r.status);});
    }

    function getSRHtml(kw,pg){
        return fetch('https://www.amazon.in/s?k='+encodeURIComponent(kw)+'&page='+pg,{credentials:'include'}).then(function(r){return r.text();});
    }

    function parseSR(html){
        var doc=new DOMParser().parseFromString(html,'text/html');
        var items=doc.querySelectorAll('[data-component-type="s-search-result"]');
        var out=[];
        items.forEach(function(it,i){
            var asin=(it.getAttribute('data-asin')||'').trim();
            if(!asin)return;
            var ih=(it.innerHTML||'').toLowerCase();
            var ix=(it.textContent||'').toLowerCase();
            var te=it.querySelector('h2 a span, h2 span.a-text-normal');
            var isSp=it.querySelector('[data-component-type="sp-sponsored-result"],.s-label-popover-default')!==null||ih.indexOf('adplacementid')!==-1||ix.indexOf('sponsored')!==-1;
            var adT='-';
            if(isSp){var cw=(it.getAttribute('cel_widget_id')||'').toLowerCase();adT=cw.indexOf('brand')!==-1?'SB':cw.indexOf('display')!==-1?'SD':'SP';}
            out.push({asin:asin,pos:i+1,spon:isSp,adT:adT,title:te?te.textContent.trim():''});
        });
        return out;
    }

    async function findInSearch(kw,target,maxPg){
        for(var pg=1;pg<=maxPg;pg++){
            t1Log('&nbsp;&nbsp;&nbsp;&nbsp;<span class="lP">Pg '+pg+'</span>');
            try{
                var res=parseSR(await getSRHtml(kw,pg));
                for(var i=0;i<res.length;i++){
                    if(res[i].asin.toUpperCase()===target){
                        var ov=(pg-1)*(res.length||16)+res[i].pos;
                        t1Log('&nbsp;&nbsp;&nbsp;&nbsp;<span class="lG">&#10003; #'+res[i].pos+' pg'+pg+' '+(res[i].spon?res[i].adT:'Organic')+'</span>');
                        return{pos:ov,pp:res[i].pos,page:pg,spon:res[i].spon,adT:res[i].adT,type:res[i].spon?'Sponsored':'Organic'};
                    }
                }
                await wt(700);
            }catch(e){await wt(500);}
        }
        t1Log('&nbsp;&nbsp;&nbsp;&nbsp;<span class="lR">Not found</span>');
        return{pos:'Not Found',pp:'-',page:'-',spon:false,adT:'-',type:'Not Found'};
    }

    function renderTrackerView(){if(!tData.length)return;if(tView==='pivot')renderPivot();else renderTable();}

    function renderTable(){
        var rs=document.getElementById('t1Rs');
        var tw=document.createElement('div');tw.className='maTW';
        tw.innerHTML=`<table class="maTbl"><thead><tr><th>#</th><th>ASIN</th><th>Keyword</th><th>City</th><th>Pincode</th><th>Position</th><th>Page</th><th>Type</th><th>Ad Type</th><th>Date</th></tr></thead><tbody></tbody></table>`;
        rs.innerHTML='';rs.appendChild(tw);
        var tbody=tw.querySelector('tbody');
        tData.forEach(function(row){
            var pos=row.pos;
            var pc=pos==='Not Found'||pos==='Error'?'rN':pos<=5?'rT':pos<=10?'rM':pos<=20?'rL':'rO';
            var lb=row.type==='Organic'?'bOrg':row.type==='Sponsored'?'bSpo':'bNF';
            var ab=row.adT==='SP'?'bSP':row.adT==='SB'?'bSB':row.adT==='SD'?'bSD':'bNA';
            var ie=row.type==='Not Found'||row.type==='Error';
            tbody.insertAdjacentHTML('beforeend',
                '<tr'+(ie?' class="maErr"':'')+'>'+
                '<td>'+row.i+'</td>'+
                '<td><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">'+row.asin+'</span></td>'+
                '<td><span style="background:#e8eaf6;color:#283593;padding:1px 6px;border-radius:8px;font-size:10px;">'+esc(row.kw)+'</span></td>'+
                '<td>'+row.city+'</td>'+
                '<td style="color:#777;">'+row.pin+'</td>'+
                '<td><span class="'+pc+'">'+pos+'</span></td>'+
                '<td>'+row.pg+'</td>'+
                '<td><span class="maB '+lb+'">'+row.type+'</span></td>'+
                '<td><span class="maB '+ab+'">'+row.adT+'</span></td>'+
                '<td>'+row.today+'</td>'+
                '</tr>');
        });
    }

    function renderPivot(){
        var asins=[],kws=[],cities=[];
        tData.forEach(function(r){if(asins.indexOf(r.asin)===-1)asins.push(r.asin);if(kws.indexOf(r.kw)===-1)kws.push(r.kw);if(cities.indexOf(r.city)===-1)cities.push(r.city);});
        var lookup={};
        tData.forEach(function(r){lookup[r.asin+'|'+r.kw+'|'+r.city]=r;});
        var html='<div class="maPivotWrap"><table class="maPivotTbl"><thead><tr><th class="pRowH">ASIN</th><th class="pRowH">Keyword</th>';
        cities.forEach(function(c){html+='<th class="pKwH">'+esc(c)+'</th>';});
        html+='</tr></thead><tbody>';
        asins.forEach(function(asin){kws.forEach(function(kw){
            html+='<tr><td class="pRowL"><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">'+asin+'</span></td><td class="pRowL"><span>'+esc(kw)+'</span></td>';
            cities.forEach(function(city){var r=lookup[asin+'|'+kw+'|'+city];var pos=r?r.pos:'—';var cls=!r||pos==='Not Found'||pos==='Error'?'pNF':pos<=5?'pT':pos<=10?'pM':pos<=20?'pL':'pOt';html+='<td class="'+cls+'">'+pos+'</td>';});
            html+='</tr>';
        });});
        html+='</tbody></table></div>';
        document.getElementById('t1Rs').innerHTML=html;
    }

    async function runTracker(){
        if(tBusy)return;
        var asins=pAsins(document.getElementById('t1A').value||'',MAX_ASINS_TRACKER);
        var kws=pKws(document.getElementById('t1K').value||'',MAX_KWS_TRACKER);
        var tier=document.getElementById('t1T').value;
        var maxPg=parseInt(document.getElementById('t1P').value)||3;
        if(!asins.length){shk(document.getElementById('t1A'));return;}
        if(!kws.length){shk(document.getElementById('t1K'));return;}
        if(!tier||!TIERS[tier]){shk(document.getElementById('t1T'));return;}
        tBusy=true;tPaused=false;tData=[];
        var cities=TIERS[tier];var total=cities.length*asins.length*kws.length;var done=0;var today=tdy();
        var goB=document.getElementById('t1Go');var pauseB=document.getElementById('t1Pause');
        goB.disabled=true;goB.innerHTML='<span class="maSp"></span> Fetching...';
        pauseB.style.display='inline-flex';pauseB.textContent='⏸ Pause';pauseB.classList.remove('paused');
        document.getElementById('t1Lg').innerHTML='';document.getElementById('t1Lg').classList.remove('on');
        document.getElementById('t1Pg').classList.add('on');document.getElementById('t1Fl').style.width='0%';
        document.getElementById('t1St').innerHTML='<div class="maSt maStB">⏳ '+total+' combos running...</div>';
        document.getElementById('t1Ab').style.display='none';document.getElementById('t1Rs').innerHTML='';
        var tw=document.createElement('div');tw.className='maTW';
        tw.innerHTML=`<table class="maTbl"><thead><tr><th>#</th><th>ASIN</th><th>Keyword</th><th>City</th><th>Pincode</th><th>Position</th><th>Page</th><th>Type</th><th>Ad Type</th><th>Date</th></tr></thead><tbody id="t1Tb"></tbody></table>`;
        document.getElementById('t1Rs').appendChild(tw);
        var tbody=document.getElementById('t1Tb');
        for(var c=0;c<cities.length;c++){
            var city=cities[c];
            t1Log('<span class="lC">🏙 '+city.city+' ('+city.pin+')</span>');
            try{await setPin(city.pin);await wt(1000);t1Log('&nbsp;&nbsp;<span class="lG">✓ Pin set</span>');}
            catch(e){t1Log('&nbsp;&nbsp;<span class="lR">Pin err</span>');}
            for(var a=0;a<asins.length;a++){
                var asin=asins[a];
                for(var k=0;k<kws.length;k++){
                    await waitWhilePaused(function(){return tPaused;});
                    var kw=kws[k];
                    t1Log('&nbsp;&nbsp;<span class="lA">'+asin+'</span> → <span class="lK">"'+esc(kw)+'"</span>');
                    var sr;
                    try{sr=await findInSearch(kw,asin,maxPg);await wt(500);}
                    catch(e){sr={pos:'Error',pp:'-',page:'-',spon:false,adT:'-',type:'Error'};}
                    done++;
                    var pct=Math.round((done/total)*100);
                    document.getElementById('t1Fl').style.width=pct+'%';
                    document.getElementById('t1PT').textContent=city.city+' | '+asin+' | '+kw+' — '+done+'/'+total+' ('+pct+'%)';
                    var row={i:done,asin:asin,kw:kw,city:city.city,pin:city.pin,pos:sr.pos,pp:sr.pp,pg:sr.page,type:sr.type,adT:sr.adT,today:today};
                    tData.push(row);
                    var pos=row.pos;var pc=pos==='Not Found'||pos==='Error'?'rN':pos<=5?'rT':pos<=10?'rM':pos<=20?'rL':'rO';
                    var lb=row.type==='Organic'?'bOrg':row.type==='Sponsored'?'bSpo':'bNF';
                    var ab=row.adT==='SP'?'bSP':row.adT==='SB'?'bSB':row.adT==='SD'?'bSD':'bNA';
                    var ie=row.type==='Not Found'||row.type==='Error';
                    tbody.insertAdjacentHTML('beforeend','<tr'+(ie?' class="maErr"':'')+'>'+
                        '<td>'+row.i+'</td>'+
                        '<td><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">'+row.asin+'</span></td>'+
                        '<td><span style="background:#e8eaf6;color:#283593;padding:1px 6px;border-radius:8px;font-size:10px;">'+esc(row.kw)+'</span></td>'+
                        '<td>'+row.city+'</td>'+'<td style="color:#777;">'+row.pin+'</td>'+
                        '<td><span class="'+pc+'">'+pos+'</span></td>'+
                        '<td>'+row.pg+'</td>'+
                        '<td><span class="maB '+lb+'">'+row.type+'</span></td>'+
                        '<td><span class="maB '+ab+'">'+row.adT+'</span></td>'+
                        '<td>'+row.today+'</td></tr>');
                }
            }
        }
        document.getElementById('t1Fl').style.width='100%';
        document.getElementById('t1PT').textContent='Done — '+total+' combos checked.';
        document.getElementById('t1St').innerHTML='<div class="maSt maStD">✓ '+tData.length+' results</div>';
        document.getElementById('t1Ab').style.display='flex';document.getElementById('t1Rc').textContent=tData.length+' rows';
        goB.disabled=false;goB.innerHTML='🔍 Execute';pauseB.style.display='none';
        tBusy=false;tPaused=false;
    }

    function clearTracker(){
        if(tBusy)return;
        ['t1A','t1K'].forEach(function(id){document.getElementById(id).value='';});
        document.getElementById('t1T').value='';document.getElementById('t1P').value='3';
        document.getElementById('t1AC').textContent='0/'+MAX_ASINS_TRACKER;document.getElementById('t1KC').textContent='0/'+MAX_KWS_TRACKER;
        document.getElementById('t1Sm').classList.remove('on');document.getElementById('t1TB').classList.remove('on');
        document.getElementById('t1Pg').classList.remove('on');document.getElementById('t1St').innerHTML='';
        document.getElementById('t1Ab').style.display='none';
        document.getElementById('t1Lg').innerHTML='';document.getElementById('t1Lg').classList.remove('on');
        document.getElementById('t1Rs').innerHTML='<div class="maEm">Enter ASINs + Keywords + Tier to begin</div>';
        document.getElementById('t1Pause').style.display='none';
        tData=[];tView='table';document.getElementById('t1VT').classList.add('active');document.getElementById('t1VP').classList.remove('active');
    }

    function exportTrackerCSV(){
        if(!tData.length)return;
        var rows=[['#','ASIN','Keyword','City','Pincode','Position','Page','Type','Ad Type','Date']];
        tData.forEach(function(r){rows.push([r.i,r.asin,r.kw,r.city,r.pin,r.pos,r.pg,r.type,r.adT,r.today]);});
        downloadCSV('ASIN_Tracker_'+new Date().toISOString().slice(0,10)+'.csv',rows);
    }

    // ================================================================
    //  TOOL 2 — BULK PDP SCRAPER  (FULLY FIXED v5)
    // ================================================================

    var pBusy = false, pPaused = false, pData = [];

    // ── Parallel engine with pause ──
    async function runPDPFast(asins, fetchFn, onProgress, pauseFlagFn) {
        var results = new Array(asins.length);
        var index = 0;
        async function worker() {
            while (true) {
                await waitWhilePaused(pauseFlagFn);
                if (index >= asins.length) break;
                var ci = index++;
                var asin = asins[ci];
                try { results[ci] = await fetchFn(asin); }
                catch (e) { results[ci] = { _error: true, _asin: asin, _errMsg: e.message }; }
                if (onProgress) onProgress(ci + 1, asins.length, asin);
                await wt(500 + Math.random() * 700);
            }
        }
        var workers = [];
        for (var i = 0; i < CONCURRENT_REQUESTS; i++) workers.push(worker());
        await Promise.all(workers);
        return results;
    }

    function txt(el) {
        return el ? cleanText(el.textContent) : '';
    }

    // ── Detect page ASIN (to catch redirects) ──
    function getPageAsin(doc) {
        // 1. Canonical URL
        var can = q(doc, 'link[rel="canonical"]');
        if (can) { var m = (can.getAttribute('href')||'').match(/\/dp\/([A-Z0-9]{10})/i); if (m) return m[1].toUpperCase(); }
        // 2. data-asin on main container
        var mainDiv = q(doc, '#dp, #ppd, #centerCol');
        if (mainDiv) { var da = mainDiv.getAttribute('data-asin'); if (da && da.length === 10) return da.toUpperCase(); }
        // 3. ATF form input
        var asinInp = q(doc, 'input[name="ASIN"], input[name="asin"]');
        if (asinInp && asinInp.value && asinInp.value.length === 10) return asinInp.value.toUpperCase();
        // 4. Script json
        var scripts = qa(doc, 'script');
        for (var i = 0; i < scripts.length; i++) {
            var sc = scripts[i].textContent || '';
            var sm = sc.match(/"ASIN"\s*:\s*"([A-Z0-9]{10})"/i);
            if (sm) return sm[1].toUpperCase();
        }
        return null;
    }

    // ── Main PDP Scraper — FULLY FIXED ──
    async function fetchPDP(asin) {
        var url = 'https://www.amazon.in/dp/' + asin + '?th=1&psc=1';
        var html = await fetch(url, { credentials: 'include' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        });
        var doc = new DOMParser().parseFromString(html, 'text/html');

        // ── Page validity ──
        var pageLoaded = !!(q(doc,'#dp') || q(doc,'#ppd') || q(doc,'#centerCol') || q(doc,'#productTitle'));
        if (!pageLoaded) throw new Error('Page not loaded');

        // ── Redirect check ──
        var pageAsin = getPageAsin(doc);
        if (pageAsin && pageAsin !== asin.toUpperCase()) {
            return { _redirected: true, _originalAsin: asin, _redirectedTo: pageAsin };
        }

        var bt = (doc.body || doc.documentElement).textContent || '';
        var bh = (doc.body || doc.documentElement).innerHTML || '';

        // ── Unavailable / Delisted ──
        var isUnavail = /currently unavailable|no longer available|not available for purchase/i.test(bt)
            && !q(doc, '#productTitle');
        if (isUnavail) return { _unavailable: true, _originalAsin: asin };

        // ════════════════════════════════════════════════════
        //  SECTION 1: BASIC INFO
        // ════════════════════════════════════════════════════

        // Title
        var titleEl = q(doc, '#productTitle');
        var title = titleEl ? cleanText(titleEl.textContent) : 'Not able to fetch';

        // Brand
        var brandEl = q(doc, '#bylineInfo, #brand, .po-brand .po-break-word, #bylineInfo_feature_div a');
        var brand = brandEl
            ? cleanText(brandEl.textContent)
                .replace(/^Visit the\s+/i,'').replace(/\s+Store$/i,'').replace(/^Brand:\s*/i,'')
            : 'NA';

        // Category breadcrumb
        var bcEl = q(doc, '#wayfinding-breadcrumbs_feature_div, #nav-subnav, .a-breadcrumb');
        var category = 'NA';
        if (bcEl) {
            var bcLinks = qa(bcEl, 'a, li');
            var bcParts = bcLinks.map(function(l){ return cleanText(l.textContent); }).filter(Boolean);
            if (bcParts.length) category = bcParts.join(' > ');
        }

        // ════════════════════════════════════════════════════
        //  SECTION 2: PRICING
        // ════════════════════════════════════════════════════

        // Current price (selling price)
        var priceEl = q(doc,
            '.priceToPay .a-offscreen,' +
            '#priceblock_dealprice,' +
            '#priceblock_ourprice,' +
            '.apexPriceToPay .a-offscreen,' +
            '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen,' +
            '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen'
        );
        // Fallback: first .a-price .a-offscreen not inside a strikethrough
        if (!priceEl) {
            var allP = qa(doc, '.a-price .a-offscreen');
            for (var pi = 0; pi < allP.length; pi++) {
                if (!allP[pi].closest('.a-text-price')) { priceEl = allP[pi]; break; }
            }
        }
        var price = priceEl ? cleanText(priceEl.textContent) : 'NA';

        // MRP (strikethrough — must differ from price)
        var mrpEl = null;
        var mrpCands = qa(doc, '.a-text-price .a-offscreen');
        for (var mi = 0; mi < mrpCands.length; mi++) {
            var mc = cleanText(mrpCands[mi].textContent);
            if (mc && mc !== price) { mrpEl = mrpCands[mi]; break; }
        }
        if (!mrpEl) {
            mrpEl = q(doc,
                '#corePriceDisplay_desktop_feature_div .a-text-price .a-offscreen,' +
                '#corePrice_feature_div .a-text-price .a-offscreen,' +
                '#listPrice'
            );
        }
        var mrp = mrpEl ? cleanText(mrpEl.textContent) : 'NA';

        // Discount %
        var discEl = q(doc,
            '.savingsPercentage,' +
            '#corePriceDisplay_desktop_feature_div .savingsPercentage,' +
            '#corePrice_feature_div .savingsPercentage,' +
            '.reinventPriceSavingsPercentageMargin'
        );
        var discount = 'NA';
        if (discEl) {
            discount = cleanText(discEl.textContent);
        } else if (price !== 'NA' && mrp !== 'NA') {
            var pNum = parseFloat(price.replace(/[^0-9.]/g,''));
            var mNum = parseFloat(mrp.replace(/[^0-9.]/g,''));
            if (pNum > 0 && mNum > pNum) discount = '-' + Math.round(((mNum-pNum)/mNum)*100) + '%';
        }

        // ════════════════════════════════════════════════════
        //  SECTION 3: DEALS & PROMOTIONS  — FIXED
        // ════════════════════════════════════════════════════

        // Deal tag (Lightning Deal / Deal of the Day / etc.)
        var deal = 'NA';
        var dealSelectors = [
            '#dealBadge',
            '#deal-badge',
            '.a-badge-supplementary-label',
            '#limited-deal-badge',
            '[data-feature-name="dealBadge"] span',
            '.dealBadge',
            '#dealEndTimer',
            '#deal-timer'
        ];
        for (var di = 0; di < dealSelectors.length; di++) {
            var de = q(doc, dealSelectors[di]);
            if (de) {
                var dt = cleanText(de.textContent);
                if (dt && !/subscribe/i.test(dt) && dt.length > 1) {
                    deal = dt.substring(0, 60);
                    break;
                }
            }
        }
        // Also check for "Limited time deal" text in page
        if (deal === 'NA' && /limited time deal/i.test(bt)) deal = 'Limited Time Deal';
        if (deal === 'NA' && /deal of the day/i.test(bt)) deal = 'Deal of the Day';

        // ── COUPON — FULLY REWRITTEN ──
        // Amazon IN coupon appears in multiple places. Try all systematically.
        var coupon = 'NA';
        var couponSelectors = [
            // Primary coupon badge
            '#couponBadgeRegularVPC',
            '#coupon-badge-id',
            '.couponBadge',
            // Coupon feature div
            '#coupon_feature_div .couponText',
            '#coupon_feature_div .a-color-success',
            '#coupon_feature_div label',
            '#coupon_feature_div',
            // promo area
            '#promoCouponContainer',
            '[data-feature-name="couponBadge"]',
            // vpcButton (virtual product coupon)
            '#vpcButton',
            // sns coupon
            '.coupon-title',
            // New format 2024
            '#couponsTitle',
            '#couponText',
            '.coupon-badge-label',
            '#base-product-coupons .a-color-success',
            '#base-product-coupons'
        ];
        for (var ci2 = 0; ci2 < couponSelectors.length; ci2++) {
            var ce = q(doc, couponSelectors[ci2]);
            if (ce) {
                var ct = cleanText(ce.textContent);
                // Must contain % or ₹ or "off" or "coupon" to be valid
                if (ct && ct.length > 2 && (/\d+\s*%|\₹\s*\d+|off|coupon/i.test(ct))) {
                    coupon = ct.substring(0, 80);
                    break;
                }
            }
        }
        // Text-level fallback: search body for coupon patterns
        if (coupon === 'NA') {
            var cpMatch = bt.match(/(?:Apply|Clip)\s+(?:this\s+)?(?:\d+%|\₹\s*\d+)\s*coupon/i)
                || bt.match(/Save\s+(?:extra\s+)?(\d+%|\₹\s*\d+)\s+(?:with\s+)?coupon/i);
            if (cpMatch) coupon = cleanText(cpMatch[0]).substring(0, 80);
        }

        // ── SUBSCRIBE & SAVE ──
        var snsEl = q(doc,
            '#snsAccordionRowMiddle, #sns-base-price, #subscribeAndSave,' +
            '[data-feature-name="snsBadge"], .snsBadge,' +
            '#snsDetailPageDynamicLeafElement, #sns-expanded'
        );
        var sns = 'NA';
        if (snsEl) {
            var snsTxt = cleanText(snsEl.textContent);
            var snsPct = snsTxt.match(/(\d+)\s*%/);
            sns = snsPct ? 'Yes (' + snsPct[1] + '% off)' : 'Yes';
        }

        // ── OFFERS — FULLY REWRITTEN ──
        // Amazon IN offers live in heroQuickPromo + sopp + itembox-InstantOrderUpdate
        var offersArr = [];
        var offerContainerSelectors = [
            '#heroQuickPromo_feature_div',
            '#sopp_feature_div',
            '#itembox-InstantOrderUpdate',
            '#itembox-Promotions',
            '#promotions_feature_div',
            '#promotions',
            '#promoPriceBlockMessage_feature_div',
            '#multipleOffersTextEl',
            '#buyboxRegion .a-section'
        ];
        var seenOffers = {};
        for (var oi = 0; oi < offerContainerSelectors.length; oi++) {
            var oEl = q(doc, offerContainerSelectors[oi]);
            if (!oEl) continue;
            // Try list items first
            var oItems = qa(oEl, 'li, .promotion-text, .promoPriceText, .a-list-item, p');
            if (oItems.length === 0) oItems = [oEl]; // use container itself
            oItems.forEach(function(it) {
                var ot = cleanText(it.textContent);
                if (ot && ot.length > 8 && ot.length < 250 && !seenOffers[ot]) {
                    seenOffers[ot] = true;
                    offersArr.push(ot);
                }
            });
        }
        var offers = offersArr.length > 0 ? offersArr.slice(0, 6).join(' || ') : 'NA';

        // ── BANK OFFERS — FULLY REWRITTEN ──
        var bankArr = [];
        var seenBank = {};
        var bankContainerSelectors = [
            '#heroQuickPromo_feature_div',   // Amazon IN primary location
            '#CreditCardInstillments_feature_div',
            '#CreditCardInstallments',
            '#instantCashback',
            '#bankPromotions',
            '#checkout-coupon-text',
            '#itembox-Promotions',
            '#buyboxRegion',
            '#buyNowSection'
        ];
        var bankKeywords = /bank|credit.?card|debit.?card|emi|cashback|instant.?discount|hdfc|sbi|icici|axis|kotak|upi|rupay|visa|mastercard|amex/i;
        for (var bi = 0; bi < bankContainerSelectors.length; bi++) {
            var bc = q(doc, bankContainerSelectors[bi]);
            if (!bc) continue;
            var bItems = qa(bc, 'li, span, p, div.a-row');
            bItems.forEach(function(it) {
                var bt2 = cleanText(it.textContent);
                if (bt2 && bt2.length > 10 && bt2.length < 200 && bankKeywords.test(bt2) && !seenBank[bt2]) {
                    seenBank[bt2] = true;
                    bankArr.push(bt2);
                }
            });
        }
        // Remove dupes (sometimes parent+child both match)
        bankArr = bankArr.filter(function(b, idx) {
            return !bankArr.some(function(other, oidx) { return oidx !== idx && other.length > b.length && other.includes(b); });
        });
        var bankOffers = bankArr.length > 0 ? bankArr.slice(0, 5).join(' || ') : 'NA';

        // ── BXGY (Buy X Get Y) ──
        var bxgy = 'NA';
        var bxgyEl = q(doc, '#itembox-BundleV2, #bxgy-native-display-slot, [data-feature-name="bxgy"], #bxgyBuySection');
        if (bxgyEl) {
            bxgy = cleanText(bxgyEl.textContent).substring(0, 200);
        } else {
            var bxgyM = bt.match(/buy\s+\d+\s+(?:get|and\s*get)\s+[^.]{5,100}/i);
            if (bxgyM) bxgy = cleanText(bxgyM[0]).substring(0, 150);
        }

        // ════════════════════════════════════════════════════
        //  SECTION 4: RATINGS & SOCIAL PROOF
        // ════════════════════════════════════════════════════

        // Rating
        var ratingEl = q(doc, '#acrPopover, #averageCustomerReviews .a-icon-alt, #averageCustomerReviews span.a-icon-alt');
        var rating = 'NA';
        if (ratingEl) {
            var rtTxt = ratingEl.getAttribute('title') || ratingEl.textContent;
            var rm = rtTxt.match(/(\d+\.?\d*)\s*out of/i);
            rating = rm ? rm[1] : cleanText(rtTxt).substring(0,5);
        }

        // Review count
        var revEl = q(doc,
            '#acrCustomerReviewText,' +
            '#ratings-count,' +
            '[data-hook="total-review-count"],' +
            '#averageCustomerReviews #acrCustomerReviewText'
        );
        var reviewCount = 'NA';
        if (revEl) {
            var rcTxt = cleanText(revEl.textContent);
            var rcM = rcTxt.match(/([\d,]+)/);
            reviewCount = rcM ? rcM[1] : rcTxt.substring(0, 15);
        }

        // Rating breakdown (histogram)
        var ratingBreakdown = 'NA';
        var histEl = q(doc, '#histogramTable, #cm_cr-product_info');
        if (histEl) {
            var histRows = qa(histEl, 'tr, li');
            var histParts = [];
            histRows.forEach(function(r) {
                var pctEl = r.querySelector('.a-text-right a, .a-nowrap a');
                var lblEl = r.querySelector('.a-text-left a, .a-nowrap:first-child');
                if (pctEl && lblEl) {
                    var pct = cleanText(pctEl.textContent);
                    var lbl = cleanText(lblEl.textContent);
                    if (pct && lbl) histParts.push(lbl + ':' + pct);
                }
            });
            if (histParts.length) ratingBreakdown = histParts.join(', ');
        }

        // Past bought (social proof)
        var pbEl = q(doc,
            '#social-proofing-faceout-title-tk_bought,' +
            '#socialProofingAsinFaceout_feature_div,' +
            '.social-proofing-faceout-title,' +
            '[data-feature-name="socialProofingAsinFaceout"]'
        );
        var pastBought = 'NA';
        if (pbEl) {
            var pbTxt = cleanText(pbEl.textContent).replace(/\{[^{}]*\}/g,'');
            if (/\d/.test(pbTxt)) pastBought = pbTxt.substring(0, 80);
        }

        // ── Amazon's Choice / Prime Tag ──
        var amazonChoice = 'No';
        var acEl = q(doc,
            '#acBadge_feature_div, .ac-badge-wrapper, [data-feature-name="acBadge"],' +
            '.amazons-choice-badge, #amazonsChoice'
        );
        if (acEl) {
            amazonChoice = 'Yes';
        } else if (/amazon'?s?\s+choice/i.test(bt)) {
            amazonChoice = 'Yes';
        }

        // Prime tag
        var primeTag = 'No';
        var primeEl = q(doc, '#primeExclusiveBadging, .prime-logo, [data-feature-name="primeExclusiveBadging"], #primeBadge_feature_div');
        if (primeEl) {
            primeTag = 'Yes';
        } else if (q(doc, 'i.a-icon-prime, .prime-exclusive')) {
            primeTag = 'Yes';
        }

        // ════════════════════════════════════════════════════
        //  SECTION 5: BUY BOX & SELLER INFO  — FULLY FIXED
        // ════════════════════════════════════════════════════

        // ── SOLD BY — FULLY REWRITTEN ──
        // Amazon IN buy box seller is in tabular-buybox or the merchant block
        var soldBy = 'NA';

        // Strategy 1: tabular buybox (most accurate for Amazon IN)
        var tabularBB = q(doc, '#tabular-buybox-container, #tabular-buybox');
        if (tabularBB) {
            var tbRows = qa(tabularBB, '.tabular-buybox-text');
            tbRows.forEach(function(row) {
                var label = cleanText(row.previousElementSibling ? row.previousElementSibling.textContent : '');
                var value = cleanText(row.textContent);
                if (/sold by/i.test(label) && value && value.length < 100) {
                    soldBy = value.replace(/^Sold by\s*/i,'');
                }
            });
        }

        // Strategy 2: merchant info feature div
        if (soldBy === 'NA') {
            var merchantEl = q(doc, '#merchantInfoFeature_feature_div, #merchant-info');
            if (merchantEl) {
                var merchantLink = q(merchantEl, 'a');
                soldBy = merchantLink
                    ? cleanText(merchantLink.textContent)
                    : cleanText(merchantEl.textContent).replace(/^Sold by\s*/i,'').split(/\n/)[0];
                if (soldBy) soldBy = soldBy.substring(0, 80);
            }
        }

        // Strategy 3: sellerProfileTriggerId
        if (soldBy === 'NA') {
            var spEl = q(doc, '#sellerProfileTriggerId');
            if (spEl) soldBy = cleanText(spEl.textContent).substring(0, 80);
        }

        // Strategy 4: Look for "Sold by" text near buybox
        if (soldBy === 'NA') {
            var bbSection = q(doc, '#buyboxRegion, #newAccordionRow, #ppd');
            if (bbSection) {
                var bbText = cleanText(bbSection.innerHTML)
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g,' ');
                var sbMatch = bbText.match(/Sold\s+by\s+([A-Za-z0-9][^.]{2,60}?)(?:\s*\||<|\n|Fulfilled|Ships)/i);
                if (sbMatch) soldBy = sbMatch[1].trim();
            }
        }

        // ── FULFILLED BY ──
        var fulfilledBy = 'NA';
        var fbEl = q(doc, '#fulfilledBy, .mbcMerchantName, #tabular-buybox-container .tabular-buybox-text');
        // Check tabular buybox for fulfilment
        if (tabularBB) {
            var ftbRows = qa(tabularBB, '.tabular-buybox-text');
            ftbRows.forEach(function(row) {
                var label = cleanText(row.previousElementSibling ? row.previousElementSibling.textContent : '');
                var value = cleanText(row.textContent);
                if (/ships from|fulfilled by/i.test(label) && value) {
                    fulfilledBy = value;
                }
            });
        }
        if (fulfilledBy === 'NA') {
            if (/Fulfilled\s+by\s+Amazon/i.test(bh) || /Ships\s+from\s+Amazon/i.test(bh)) {
                fulfilledBy = 'Amazon';
            }
        }

        // ── FBA / MFN ──
        var channel = 'NA';
        if (/Fulfilled\s+by\s+Amazon|Ships\s+from\s+Amazon/i.test(bh)) channel = 'FBA';
        else if (/Ships\s+from\s+and\s+sold\s+by\s+Amazon/i.test(bh)) channel = 'FBA';
        else if (soldBy && /amazon/i.test(soldBy)) channel = 'FBA';
        else if (soldBy && soldBy !== 'NA') channel = 'MFN';

        // ── BUY BOX WINNER ──
        // Is it Amazon retail itself?
        var buyBoxWinner = 'NA';
        if (soldBy !== 'NA') {
            buyBoxWinner = soldBy;
            if (/amazon/i.test(soldBy)) buyBoxWinner = 'Amazon (Retail)';
        }

        // ── BUY BOX STATUS (has buy box / suppressed) ──
        var buyBoxStatus = 'Active';
        if (!q(doc, '#add-to-cart-button, #buy-now-button, #submit.add-to-cart')) {
            if (/currently unavailable|out of stock/i.test(bt)) buyBoxStatus = 'Suppressed';
        }
        if (q(doc, '#outOfStock')) buyBoxStatus = 'Suppressed';

        // ── OTHER SELLERS ──
        var otherSellers = 'NA';
        var oselEl = q(doc,
            '#olpLinkWidget_feature_div .olpLinkSection,' +
            '#moreBuyingChoices_feature_div,' +
            '#buybox-see-all-buying-choices,' +
            '#all-offers-display,' +
            '#mbc-sold-by-aplus'
        );
        if (oselEl) {
            var osM = cleanText(oselEl.textContent).match(/(\d+)\s*(?:new|used|other|seller)/i);
            otherSellers = osM ? osM[1] + ' sellers' : 'Multiple';
        }

        // ════════════════════════════════════════════════════
        //  SECTION 6: STOCK & AVAILABILITY
        // ════════════════════════════════════════════════════

        var stockEl = q(doc, '#availability, #outOfStock, #availability_feature_div');
        var stock = 'NA';
        if (stockEl) {
            var st = cleanText(stockEl.textContent).toLowerCase();
            if (/out of stock|currently unavailable/.test(st)) stock = 'Out of Stock';
            else if (/only (\d+) left|limited stock/.test(st)) {
                var onlyM = cleanText(stockEl.textContent).match(/only (\d+) left/i);
                stock = onlyM ? 'Low Stock (' + onlyM[1] + ' left)' : 'Limited Stock';
            } else if (/in stock/.test(st)) stock = 'In Stock';
            else stock = cleanText(stockEl.textContent).substring(0,40);
        } else {
            stock = 'Not able to fetch';
        }

        // ════════════════════════════════════════════════════
        //  SECTION 7: BSR — NEW (was missing)
        // ════════════════════════════════════════════════════

        var bsr = 'NA';
        var bsrCategory = 'NA';
        // BSR lives in product details section
        var detailEls = qa(doc,
            '#productDetails_detailBullets_sections1 li,' +
            '#detailBullets_feature_div li,' +
            '#productDetails_techSpec_section_1 tr,' +
            '#productDetails_feature_div tr'
        );
        for (var dli = 0; dli < detailEls.length; dli++) {
            var dEl = detailEls[dli];
            var dTxt = cleanText(dEl.textContent);
            if (/best.?seller/i.test(dTxt) || /bsr/i.test(dTxt) || /amazon best seller rank/i.test(dTxt)) {
                // Extract rank number and category
                var bsrM = dTxt.match(/#([\d,]+)\s+in\s+([^\(]+)/);
                if (bsrM) {
                    bsr = '#' + bsrM[1].replace(/,/g,'');
                    bsrCategory = cleanText(bsrM[2]);
                } else {
                    // fallback: grab just the number
                    var bsrNumM = dTxt.match(/#([\d,]+)/);
                    if (bsrNumM) bsr = '#' + bsrNumM[1];
                }
                break;
            }
        }
        // Also check the #SalesRank area
        if (bsr === 'NA') {
            var salesRankEl = q(doc, '#SalesRank, #salesrank, .po-best_sellers_rank .po-break-word');
            if (salesRankEl) {
                var srTxt = cleanText(salesRankEl.textContent);
                var srM = srTxt.match(/#([\d,]+)\s+in\s+([^(]+)/);
                if (srM) {
                    bsr = '#' + srM[1].replace(/,/g,'');
                    bsrCategory = cleanText(srM[2]);
                }
            }
        }
        // Consolidate
        var bsrFull = bsr === 'NA' ? 'NA' : bsr + (bsrCategory !== 'NA' ? ' in ' + bsrCategory : '');

        // ════════════════════════════════════════════════════
        //  SECTION 8: CONTENT & IMAGES
        // ════════════════════════════════════════════════════

        // Image count
        var imgItems = qa(doc, '#altImages li.item:not(.a-hidden), #imageBlock_feature_div .imageThumbnail');
        var imageCount = imgItems.length > 0 ? imgItems.length
            : q(doc, '#imageBlock, #altImages') ? 'NA'
            : 'Not able to fetch';

        // A+ content
        var aplusEl = q(doc, '#aplus, #aplus3pContentBody_feature_div, #aplusBody, #aplusBrandStory_feature_div');
        var aplus = pageLoaded ? (aplusEl ? 'Yes' : 'NA') : 'Not able to fetch';

        // Brand story
        var brandStoryEl = q(doc, '#aplusBrandStory_feature_div, #brand-story-ftf-section, [data-feature-name="aplusBrandStory"]');
        var brandStory = pageLoaded ? (brandStoryEl ? 'Yes' : 'NA') : 'Not able to fetch';

        // Video count
        var videoEls = qa(doc, '.videoBlock, #dp-container .video-thumbnail, #video-dp-container video, .vs-image-overlay-icon-play-button');
        var videoCount = videoEls.length > 0 ? videoEls.length : 'NA';

        // ════════════════════════════════════════════════════
        //  SECTION 9: RETURN POLICY & DELIVERY
        // ════════════════════════════════════════════════════

        // Return policy
        var returnPolicy = 'NA';
        var returnEl = q(doc,
            '#returns-policy-message, #returnPolicyDetailsDiv,' +
            '.return-policy-row, #productDetails_feature_div [class*="return"]'
        );
        if (returnEl) {
            var rtxt = cleanText(returnEl.textContent);
            if (/non.?returnable|not returnable|no return/i.test(rtxt)) returnPolicy = 'Non-Returnable';
            else if (/returnable|return within|days.?return/i.test(rtxt)) {
                var dM = rtxt.match(/(\d+)\s*days?/i);
                returnPolicy = dM ? 'Returnable (' + dM[1] + ' days)' : 'Returnable';
            } else returnPolicy = rtxt.substring(0, 80);
        } else {
            // Check tech spec rows
            var techRows = qa(doc, '#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');
            techRows.forEach(function(r) {
                var th = txt(r.querySelector('th'));
                if (/return/i.test(th)) {
                    var td = txt(r.querySelector('td'));
                    if (td) returnPolicy = td.substring(0,80);
                }
            });
            // Body text fallback
            if (returnPolicy === 'NA') {
                if (/non.?returnable/i.test(bt)) returnPolicy = 'Non-Returnable';
                else {
                    var dM2 = bt.match(/(\d+)\s*days?\s*return|return within (\d+) days/i);
                    if (dM2) returnPolicy = 'Returnable (' + (dM2[1]||dM2[2]) + ' days)';
                }
            }
        }

        // Delivery
        var dbEl = q(doc,
            '#mir-layout-DELIVERY_BLOCK-block, #deliveryBlockMessage,' +
            '#ddmDeliveryMessage, #delivery-message, #dynamicDeliveryMessage,' +
            '#deliveryMessage_feature_div'
        );
        var dbTx = dbEl ? cleanText(dbEl.textContent) : bt;
        var stdDelivery = 'NA', fastDelivery = 'NA';

        if (dbEl) {
            // Standard delivery
            var stdPats = [
                /(?:FREE\s+delivery|Delivery\s+by)[^:]*?:\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /(?:FREE\s+delivery|Delivery\s+by)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /(?:FREE\s+delivery|Delivery\s+by)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /delivery\s+in\s+(\d+[\-\d]*\s*days?)/i
            ];
            for (var si2 = 0; si2 < stdPats.length; si2++) {
                var sm4 = dbTx.match(stdPats[si2]);
                if (sm4) { stdDelivery = sm4[1].trim(); break; }
            }
            // Fastest delivery
            var fastPats = [
                /fastest\s+delivery\s+(Today[^.]*?)(?:\.|Order|$)/i,
                /fastest\s+delivery\s+(Tomorrow[^.]*?)(?:\.|Order|$)/i,
                /fastest\s+delivery[^:]*:\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /fastest\s+delivery\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /fastest\s+delivery\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i
            ];
            for (var fi2 = 0; fi2 < fastPats.length; fi2++) {
                var fm2 = dbTx.match(fastPats[fi2]);
                if (fm2) { fastDelivery = fm2[1].trim().replace(/Order\s+within.*/i,'').trim(); break; }
            }
        } else {
            stdDelivery = 'Not able to fetch';
            fastDelivery = 'Not able to fetch';
        }

        // ════════════════════════════════════════════════════
        //  SECTION 10: PRODUCT DETAILS / TECH SPECS
        // ════════════════════════════════════════════════════

        var productDetails = {};
        // Method A: Tech spec table rows
        var specRows = qa(doc,
            '#productDetails_techSpec_section_1 tr,' +
            '#productDetails_detailBullets_sections1 tr,' +
            '#productDetails_feature_div tr'
        );
        specRows.forEach(function(r) {
            var thEl = r.querySelector('th');
            var tdEl = r.querySelector('td');
            if (thEl && tdEl) {
                var k = cleanText(thEl.textContent);
                var v = cleanText(tdEl.textContent);
                if (k && v && k.length < 80 && !/best.?seller/i.test(k)) productDetails[k] = v;
            }
        });
        // Method B: Detail bullets
        var bulletItems2 = qa(doc, '#detailBullets_feature_div .a-list-item, #detail-bullets .a-list-item');
        bulletItems2.forEach(function(li) {
            var spans = qa(li, 'span');
            if (spans.length >= 2) {
                var k = cleanText(spans[0].textContent).replace(/[:\s]+$/,'');
                var v = cleanText(spans[1].textContent);
                if (k && v && k.length < 80 && !/best.?seller/i.test(k)) productDetails[k] = v;
            }
        });
        // Method C: .po-attributes (product overview table)
        var poRows = qa(doc, '.po-attributes-list tr, .po-attributes-list-item');
        poRows.forEach(function(r) {
            var k = txt(r.querySelector('.po-text-bold, th, .a-span3'));
            var v = txt(r.querySelector('.po-break-word, td, .a-span9'));
            if (k && v && k.length < 80) productDetails[k] = v;
        });
        var productDetailsStr = Object.keys(productDetails).length > 0
            ? Object.entries(productDetails).slice(0, 12).map(function(e){ return e[0]+': '+e[1]; }).join(' | ')
            : 'NA';

        return {
            // Basic
            title, brand, category,
            // Pricing
            price, mrp, discount,
            // Promos
            deal, coupon, sns,
            // Social proof
            rating, reviewCount, ratingBreakdown, pastBought,
            // Tags
            amazonChoice, primeTag,
            // Seller / Buy Box
            soldBy, fulfilledBy, channel,
            buyBoxWinner, buyBoxStatus,
            otherSellers,
            // BSR — NEW
            bsrFull,
            // Stock
            stock,
            // Content
            imageCount, videoCount, aplus, brandStory,
            // Policy & delivery
            returnPolicy, stdDelivery, fastDelivery,
            // Offers
            offers, bankOffers, bxgy,
            // Specs
            productDetails: productDetailsStr
        };
    }

    // ================================================================
    //  PDP PANEL BUILD — UPDATED
    // ================================================================

    function buildPDPPanel() {
        if (document.getElementById('maPDPPanel')) return;
        var d = document.createElement('div');
        d.id = 'maPDPPanel'; d.className = 'maPanel';
        d.innerHTML = `
<div class="maPH" style="background:linear-gradient(135deg,#e65100,#ff6f00);">
  <h3>
    <svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 15.93.5 13.5.5c-1.32 0-2.5.54-3.36 1.4L9 3.06 7.86 1.9C7 1.04 5.82.5 4.5.5 2.07.5 0 2.51 0 4.64c0 .48.11.92.18 1.36H0v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
    Bulk PDP Scraper v5
  </h3>
  <div style="display:flex;align-items:center;gap:8px;">
    <button class="maBack" id="t2Back"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>Tools</button>
    <button class="maClose" id="t2Close">&#215;</button>
  </div>
</div>
<div class="maPB">
  <div class="maRow">
    <div class="maField" style="min-width:200px;">
      <label>ASINs (max ${MAX_ASINS_PDP})</label>
      <textarea id="t2A" rows="4" style="width:240px;min-height:72px;" placeholder="B0C12F21G0&#10;B07JPGWH5R&#10;B09XYZ1234"></textarea>
      <div class="maCnt" id="t2AC">0/${MAX_ASINS_PDP}</div>
    </div>
    <div class="maField">
      <label>Pincode (optional)</label>
      <input type="text" id="t2Pin" placeholder="400001" style="width:110px;" maxlength="6">
      <small style="font-size:10px;color:#999;margin-top:2px;">Blank = current location</small>
    </div>
    <div class="maField" style="justify-content:flex-end;">
      <label>&nbsp;</label>
      <button class="maBP bgO" id="t2Go">&#128230; Scrape PDPs</button>
    </div>
    <div class="maField" style="justify-content:flex-end;">
      <label>&nbsp;</label>
      <button class="maPauseBtn" id="t2Pause" style="display:none;">&#9646;&#9646; Pause</button>
    </div>
    <div class="maField" style="justify-content:flex-end;">
      <label>&nbsp;</label>
      <button class="maBS" id="t2Cl">&#128465; Clear</button>
    </div>
  </div>

  <div class="maInfoBanner">
    <b>40+ fields:</b> ASIN &middot; Title &middot; Brand &middot; Category &middot; Price &middot; MRP &middot; Discount &middot; Deal &middot; Coupon &middot; Subscribe&Save &middot;
    Rating &middot; Reviews &middot; Rating Breakdown &middot; Past Bought &middot; <b>Amazon Choice</b> &middot; <b>Prime Tag</b> &middot;
    Sold By &middot; Fulfilled By &middot; Channel &middot; <b>Buy Box Winner</b> &middot; <b>Buy Box Status</b> &middot; Other Sellers &middot;
    <b>BSR + BSR Category</b> &middot; Stock &middot; Images &middot; Videos &middot; A+ &middot; Brand Story &middot;
    Return Policy &middot; Std Delivery &middot; Fast Delivery &middot; Offers &middot; Bank Offers &middot; BXGY &middot; Product Details
    <br><span class="hiOrange">✓ Redirect detection &middot; Unavailable detection &middot; Status summary &middot; Pause/Resume</span>
  </div>

  <div class="maLg" id="t2Lg"></div>
  <div class="maPg" id="t2Pg">
    <div class="maPgB"><div class="maPgF" id="t2Fl" style="background:linear-gradient(90deg,#e65100,#ff6f00);"></div></div>
    <div class="maPgT" id="t2PT">...</div>
  </div>
  <div id="t2St"></div>

  <!-- STATUS SUMMARY BAR (new) -->
  <div class="maSumBar" id="t2SumBar">
    <span class="maSumChip scTt" id="t2SumTotal">Total: 0</span>
    <span class="maSumChip scOk" id="t2SumOk">✓ Scraped: 0</span>
    <span class="maSumChip scRd" id="t2SumRedir">↪ Redirected: 0</span>
    <span class="maSumChip scNa" id="t2SumNa">✗ Unavailable: 0</span>
    <span class="maSumChip scEr" id="t2SumErr">⚠ Errors: 0</span>
  </div>

  <div class="maAb" id="t2Ab" style="display:none;">
    <span id="t2Rc" style="font-size:12px;color:#555;"></span>
    <button class="maBP bgG" id="t2Ex">&#128229; Export CSV</button>
  </div>
  <div id="t2Rs"><div class="maEm">Paste ASINs above and click Scrape PDPs</div></div>
</div>`;
        document.body.appendChild(d);

        document.getElementById('t2Close').onclick = function () { document.getElementById('maPDPPanel').classList.remove('open'); };
        document.getElementById('t2Back').onclick  = function () { document.getElementById('maPDPPanel').classList.remove('open'); toggleMenu(); };

        document.getElementById('t2Pause').addEventListener('click', function () {
            pPaused = !pPaused;
            this.textContent = pPaused ? '▶ Resume' : '⏸ Pause';
            this.classList.toggle('paused', pPaused);
            document.getElementById('t2St').innerHTML = pPaused
                ? '<div class="maSt maStP">⏸ Paused</div>'
                : '<div class="maSt maStB">▶ Resumed…</div>';
        });

        document.getElementById('t2A').addEventListener('input', function () {
            var n = pAsins(this.value, MAX_ASINS_PDP).length;
            var c = document.getElementById('t2AC');
            c.textContent = n + '/' + MAX_ASINS_PDP;
            c.className = 'maCnt' + (n >= MAX_ASINS_PDP ? ' maCntE' : n >= MAX_ASINS_PDP * .8 ? ' maCntW' : '');
        });

        document.getElementById('t2Go').addEventListener('click', runPDP);
        document.getElementById('t2Cl').addEventListener('click', clearPDP);
        document.getElementById('t2Ex').addEventListener('click', exportPDPCSV);
    }

    function t2Log(h) {
        var el = document.getElementById('t2Lg');
        if (!el) return;
        el.classList.add('on'); el.innerHTML += h + '<br>'; el.scrollTop = el.scrollHeight;
    }

    function updateSummaryBar(counts) {
        var bar = document.getElementById('t2SumBar');
        if (!bar) return;
        bar.classList.add('on');
        document.getElementById('t2SumTotal').textContent  = 'Total: '        + (counts.total  || 0);
        document.getElementById('t2SumOk').textContent     = '✓ Scraped: '    + (counts.ok     || 0);
        document.getElementById('t2SumRedir').textContent  = '↪ Redirected: ' + (counts.redir  || 0);
        document.getElementById('t2SumNa').textContent     = '✗ Not Available: '+ (counts.na   || 0);
        document.getElementById('t2SumErr').textContent    = '⚠ Errors: '     + (counts.err    || 0);
    }

    async function runPDP() {
        if (pBusy) return;
        var asins = pAsins(document.getElementById('t2A').value || '', MAX_ASINS_PDP);
        var pin   = (document.getElementById('t2Pin').value || '').trim();
        if (!asins.length) { shk(document.getElementById('t2A')); return; }

        pBusy = true; pPaused = false; pData = [];
        var total = asins.length;
        var today = tdy();
        var counts = { total: total, ok: 0, redir: 0, na: 0, err: 0 };

        var goB    = document.getElementById('t2Go');
        var pauseB = document.getElementById('t2Pause');
        goB.disabled = true; goB.innerHTML = '<span class="maSp"></span> Scraping...';
        pauseB.style.display = 'inline-flex'; pauseB.textContent = '⏸ Pause'; pauseB.classList.remove('paused');

        document.getElementById('t2Lg').innerHTML = ''; document.getElementById('t2Lg').classList.remove('on');
        document.getElementById('t2Pg').classList.add('on');
        document.getElementById('t2Fl').style.width = '0%';
        document.getElementById('t2St').innerHTML = '<div class="maSt maStB">⏳ Scraping ' + total + ' ASINs...</div>';
        document.getElementById('t2Ab').style.display = 'none';
        document.getElementById('t2Rs').innerHTML = '';
        document.getElementById('t2SumBar').classList.remove('on');
        updateSummaryBar(counts);

        // Build table with ALL columns
        var tw = document.createElement('div'); tw.className = 'maTW';
        tw.innerHTML = `<table class="maTbl" id="t2Tbl"><thead><tr>
          <th>#</th>
          <th>ASIN</th>
          <th>Status</th>
          <th>Title</th>
          <th>Brand</th>
          <th>Category</th>
          <th>Price</th>
          <th>MRP</th>
          <th>Discount</th>
          <th>Deal</th>
          <th>Coupon</th>
          <th>Sub&amp;Save</th>
          <th>Rating</th>
          <th>Reviews</th>
          <th>Rating Breakdown</th>
          <th>Past Bought</th>
          <th>AC / Prime</th>
          <th>Sold By</th>
          <th>Fulfilled By</th>
          <th>Channel</th>
          <th>Buy Box</th>
          <th>BB Status</th>
          <th>Other Sellers</th>
          <th>BSR</th>
          <th>Stock</th>
          <th>Images</th>
          <th>Videos</th>
          <th>A+</th>
          <th>Brand Story</th>
          <th>Return Policy</th>
          <th>Offers</th>
          <th>Bank Offers</th>
          <th>BXGY</th>
          <th>Std Delivery</th>
          <th>Fast Delivery</th>
          <th>Product Details</th>
          <th>Date</th>
        </tr></thead><tbody id="t2Tb"></tbody></table>`;
        document.getElementById('t2Rs').appendChild(tw);
        var tbody = document.getElementById('t2Tb');

        if (pin && /^\d{6}$/.test(pin)) {
            t2Log('<span class="lC">📍 Setting pin: ' + pin + '</span>');
            try { await setPin(pin); await wt(1200); t2Log('<span class="lG">✓ Pin set</span>'); }
            catch (e) { t2Log('<span class="lR">⚠ Pin fail — continuing</span>'); }
        }

        var data = await runPDPFast(
            asins,
            async function (asin) {
                try {
                    var d = await fetchPDP(asin);
                    if (d._redirected) {
                        counts.redir++;
                        t2Log('<span style="color:#ff9e00;">↪ '+asin+' → redirected to '+d._redirectedTo+'</span>');
                    } else if (d._unavailable) {
                        counts.na++;
                        t2Log('<span class="lR">✗ '+asin+' — Not Available</span>');
                    } else {
                        counts.ok++;
                        t2Log('<span class="lA">📦 '+asin+'</span> <span class="lG">✓ '+(d.title||'').substring(0,40)+'</span>');
                    }
                    updateSummaryBar(counts);
                    return d;
                } catch (e) {
                    counts.err++;
                    t2Log('<span class="lR">⚠ '+asin+' Error: '+e.message+'</span>');
                    updateSummaryBar(counts);
                    return { _error: true, _asin: asin, _errMsg: e.message };
                }
            },
            function (done, tot, asin) {
                var pct = Math.round((done / tot) * 100);
                document.getElementById('t2Fl').style.width = pct + '%';
                document.getElementById('t2PT').textContent = '(' + done + '/' + tot + ') ' + asin + ' — ' + pct + '%';
            },
            function () { return pPaused; }
        );

        // Render all rows
        for (var a = 0; a < data.length; a++) {
            var d = data[a];
            var origAsin = asins[a];

            var statusType = 'ok';
            var statusBadge = '<span class="maB bIS">OK</span>';
            if (!d || d._error) {
                statusType = 'err';
                statusBadge = '<span class="maB bOOS">Error</span>';
            } else if (d._redirected) {
                statusType = 'redir';
                statusBadge = '<span class="maB bRedir">Redirected → ' + esc(d._redirectedTo) + '</span>';
            } else if (d._unavailable) {
                statusType = 'na';
                statusBadge = '<span class="maB bUnavail">Not Available</span>';
            }

            var isOK = statusType === 'ok';
            var row = {
                i: a + 1, asin: origAsin, statusType: statusType, statusBadge: statusBadge,
                title:          isOK ? (d.title || 'NA')           : 'NA',
                brand:          isOK ? (d.brand || 'NA')           : 'NA',
                category:       isOK ? (d.category || 'NA')        : 'NA',
                price:          isOK ? (d.price || 'NA')           : 'NA',
                mrp:            isOK ? (d.mrp || 'NA')             : 'NA',
                discount:       isOK ? (d.discount || 'NA')        : 'NA',
                deal:           isOK ? (d.deal || 'NA')            : 'NA',
                coupon:         isOK ? (d.coupon || 'NA')          : 'NA',
                sns:            isOK ? (d.sns || 'NA')             : 'NA',
                rating:         isOK ? (d.rating || 'NA')          : 'NA',
                reviewCount:    isOK ? (d.reviewCount || 'NA')     : 'NA',
                ratingBD:       isOK ? (d.ratingBreakdown || 'NA') : 'NA',
                pastBought:     isOK ? (d.pastBought || 'NA')      : 'NA',
                amazonChoice:   isOK ? (d.amazonChoice || 'No')    : 'NA',
                primeTag:       isOK ? (d.primeTag || 'No')        : 'NA',
                soldBy:         isOK ? (d.soldBy || 'NA')          : 'NA',
                fulfilledBy:    isOK ? (d.fulfilledBy || 'NA')     : 'NA',
                channel:        isOK ? (d.channel || 'NA')         : 'NA',
                buyBoxWinner:   isOK ? (d.buyBoxWinner || 'NA')    : 'NA',
                buyBoxStatus:   isOK ? (d.buyBoxStatus || 'NA')    : 'NA',
                otherSellers:   isOK ? (d.otherSellers || 'NA')    : 'NA',
                bsr:            isOK ? (d.bsrFull || 'NA')         : 'NA',
                stock:          isOK ? (d.stock || 'NA')           : 'NA',
                imageCount:     isOK ? (d.imageCount)              : 'NA',
                videoCount:     isOK ? (d.videoCount)              : 'NA',
                aplus:          isOK ? (d.aplus || 'NA')           : 'NA',
                brandStory:     isOK ? (d.brandStory || 'NA')      : 'NA',
                returnPolicy:   isOK ? (d.returnPolicy || 'NA')    : 'NA',
                offers:         isOK ? (d.offers || 'NA')          : 'NA',
                bankOffers:     isOK ? (d.bankOffers || 'NA')      : 'NA',
                bxgy:           isOK ? (d.bxgy || 'NA')            : 'NA',
                stdDelivery:    isOK ? (d.stdDelivery || 'NA')     : 'NA',
                fastDelivery:   isOK ? (d.fastDelivery || 'NA')    : 'NA',
                productDetails: isOK ? (d.productDetails || 'NA')  : 'NA',
                today: today
            };
            pData.push(row);

            // Badges
            var chBadge = row.channel==='FBA'?'bFBA':row.channel==='MFN'?'bMFN':'bNA';
            var stBadge = row.stock==='In Stock'?'bIS':row.stock==='Out of Stock'?'bOOS':row.stock.indexOf&&row.stock.indexOf('Low')!==-1?'bLim':'bNA';
            var apBadge = row.aplus==='Yes'?'bAP':'bNo';
            var bsBadge = row.brandStory==='Yes'?'bAP':'bNo';
            var snsBadge= row.sns!=='NA'&&row.sns!=='N/A'&&row.sns.indexOf('Yes')!==-1?'bSNS':'bNA';
            var retBadge= /non.?return/i.test(row.returnPolicy)?'bNRet':/return/i.test(row.returnPolicy)?'bRet':'bNA';
            var acBadge = row.amazonChoice==='Yes'?'bAC':'bNo';
            var primeBdg= row.primeTag==='Yes'?'bPrime':'bNo';
            var bbStBdg = row.buyBoxStatus==='Active'?'bIS':row.buyBoxStatus==='Suppressed'?'bOOS':'bNA';

            var tSh = (row.title||'').length > 45 ? esc((row.title||'').substring(0,45)) + '…' : esc(row.title||'');
            var trClass = statusType==='err'?'maErr':statusType==='redir'?'maRedir':statusType==='na'?'maErr':'';

            // AC+Prime combined cell
            var acPrimeHtml = '';
            acPrimeHtml += '<span class="maB '+acBadge+'">'+(row.amazonChoice==='Yes'?'AC':'AC:No')+'</span> ';
            acPrimeHtml += '<span class="maB '+primeBdg+'">'+(row.primeTag==='Yes'?'Prime':'Prime:No')+'</span>';

            tbody.insertAdjacentHTML('beforeend',
                '<tr class="'+trClass+'">'+
                '<td style="font-size:10px;color:#999;">'+row.i+'</td>'+
                '<td><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">'+row.asin+'</span></td>'+
                '<td>'+statusBadge+'</td>'+
                '<td title="'+esc(row.title)+'" class="maCell">'+tSh+'</td>'+
                '<td>'+esc(row.brand)+'</td>'+
                '<td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(row.category)+'">'+esc(row.category)+'</td>'+
                '<td style="font-weight:700;color:#c62828;">'+esc(row.price)+'</td>'+
                '<td style="color:#999;text-decoration:line-through;">'+esc(row.mrp)+'</td>'+
                '<td style="color:#2e7d32;font-weight:600;">'+esc(row.discount)+'</td>'+
                '<td>'+(row.deal!=='NA'?'<span class="maB bDl">'+esc(row.deal)+'</span>':'—')+'</td>'+
                '<td>'+(row.coupon!=='NA'&&row.coupon!=='N/A'?'<span class="maB bCpn">'+esc(row.coupon.substring(0,50))+'</span>':'—')+'</td>'+
                '<td><span class="maB '+snsBadge+'">'+esc(row.sns)+'</span></td>'+
                '<td style="font-weight:700;text-align:center;">'+esc(row.rating)+'</td>'+
                '<td style="text-align:center;">'+esc(row.reviewCount)+'</td>'+
                '<td style="font-size:10px;color:#777;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(row.ratingBD)+'">'+esc(row.ratingBD)+'</td>'+
                '<td>'+esc(row.pastBought)+'</td>'+
                '<td>'+acPrimeHtml+'</td>'+
                '<td><b>'+esc(row.soldBy)+'</b></td>'+
                '<td>'+esc(row.fulfilledBy)+'</td>'+
                '<td><span class="maB '+chBadge+'">'+esc(row.channel)+'</span></td>'+
                '<td><span class="maB bBB">'+esc(row.buyBoxWinner.substring(0,30))+'</span></td>'+
                '<td><span class="maB '+bbStBdg+'">'+esc(row.buyBoxStatus)+'</span></td>'+
                '<td>'+esc(row.otherSellers)+'</td>'+
                '<td style="font-size:10px;font-weight:600;color:#1565c0;white-space:nowrap;">'+esc(row.bsr)+'</td>'+
                '<td><span class="maB '+stBadge+'">'+esc(row.stock)+'</span></td>'+
                '<td style="text-align:center;">'+esc(String(row.imageCount))+'</td>'+
                '<td style="text-align:center;">'+esc(String(row.videoCount))+'</td>'+
                '<td><span class="maB '+apBadge+'">'+esc(row.aplus)+'</span></td>'+
                '<td><span class="maB '+bsBadge+'">'+esc(row.brandStory)+'</span></td>'+
                '<td><span class="maB '+retBadge+'" title="'+esc(row.returnPolicy)+'">'+esc(row.returnPolicy.substring(0,25))+'</span></td>'+
                '<td style="font-size:10px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(row.offers)+'">'+esc(row.offers.substring(0,80))+'</td>'+
                '<td style="font-size:10px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(row.bankOffers)+'">'+esc(row.bankOffers.substring(0,80))+'</td>'+
                '<td style="font-size:10px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(row.bxgy)+'">'+esc(row.bxgy.substring(0,60))+'</td>'+
                '<td class="dS">'+esc(row.stdDelivery)+'</td>'+
                '<td class="dF">'+esc(row.fastDelivery)+'</td>'+
                '<td style="font-size:10px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(row.productDetails)+'">'+esc(row.productDetails.substring(0,80))+'</td>'+
                '<td style="white-space:nowrap;color:#999;font-size:10px;">'+row.today+'</td>'+
                '</tr>'
            );
        }

        document.getElementById('t2Fl').style.width = '100%';
        document.getElementById('t2PT').textContent = 'Done — ' + total + ' ASINs processed.';
        document.getElementById('t2St').innerHTML = '<div class="maSt maStD">✓ Done: ' + counts.ok + ' scraped · ' + counts.redir + ' redirected · ' + counts.na + ' unavailable · ' + counts.err + ' errors</div>';
        document.getElementById('t2Ab').style.display = 'flex';
        document.getElementById('t2Rc').textContent = pData.length + ' rows | ' + counts.ok + ' OK · ' + counts.redir + ' redirected · ' + counts.na + ' NA · ' + counts.err + ' errors';
        updateSummaryBar(counts);
        goB.disabled = false; goB.innerHTML = '📦 Scrape PDPs';
        pauseB.style.display = 'none';
        pBusy = false; pPaused = false;
    }

    function clearPDP() {
        if (pBusy) return;
        document.getElementById('t2A').value = ''; document.getElementById('t2Pin').value = '';
        document.getElementById('t2AC').textContent = '0/' + MAX_ASINS_PDP;
        document.getElementById('t2Pg').classList.remove('on');
        document.getElementById('t2St').innerHTML = '';
        document.getElementById('t2Ab').style.display = 'none';
        document.getElementById('t2Lg').innerHTML = ''; document.getElementById('t2Lg').classList.remove('on');
        document.getElementById('t2Rs').innerHTML = '<div class="maEm">Paste ASINs above and click Scrape PDPs</div>';
        document.getElementById('t2Pause').style.display = 'none';
        document.getElementById('t2SumBar').classList.remove('on');
        pData = [];
    }

    function exportPDPCSV() {
        if (!pData.length) return;
        var rows = [[
            '#','ASIN','Status','Title','Brand','Category',
            'Price','MRP','Discount',
            'Deal','Coupon','Subscribe & Save',
            'Rating','Reviews','Rating Breakdown','Past Bought',
            "Amazon's Choice",'Prime Tag',
            'Sold By','Fulfilled By','Channel',
            'Buy Box Winner','Buy Box Status','Other Sellers',
            'BSR',
            'Stock Status','Image Count','Video Count','A+ Content','Brand Story',
            'Return Policy',
            'Offers','Bank Offers','BXGY',
            'Std Delivery','Fast Delivery',
            'Product Details','Date'
        ]];
        pData.forEach(function (r) {
            rows.push([
                r.i, r.asin, r.statusType, r.title, r.brand, r.category,
                r.price, r.mrp, r.discount,
                r.deal, r.coupon, r.sns,
                r.rating, r.reviewCount, r.ratingBD, r.pastBought,
                r.amazonChoice, r.primeTag,
                r.soldBy, r.fulfilledBy, r.channel,
                r.buyBoxWinner, r.buyBoxStatus, r.otherSellers,
                r.bsr,
                r.stock, r.imageCount, r.videoCount, r.aplus, r.brandStory,
                r.returnPolicy,
                r.offers, r.bankOffers, r.bxgy,
                r.stdDelivery, r.fastDelivery,
                r.productDetails, r.today
            ]);
        });
        downloadCSV('PDP_Scraper_v5_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    }

    // ================================================================
    //  INIT
    // ================================================================

    function init() {
        injectCSS();
        buildTrackerPanel();
        buildPDPPanel();
        buildLauncher();
        console.log('[MarketingAssistant v5.0] Ready — BSR, Coupon, Offers, BuyBox, AC, Prime all fixed');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
