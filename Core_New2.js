(function () {
    'use strict';

    // ================================================================
    //  SHARED CONFIG & UTILITIES
    // ================================================================

    var MAX_ASINS_TRACKER = 50;
    var MAX_KWS_TRACKER   = 50;
    var MAX_ASINS_PDP     = 5000;

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
        // deduplicate ASINs (fix: original had no dedup)
        var seen = {};
        var out  = [];
        raw.split(/[\s,]+/).filter(Boolean).forEach(function (v) {
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

    // ================================================================
    //  CSS
    // ================================================================

    function injectCSS() {
        if (document.getElementById('maCSS')) return;
        var s = document.createElement('style');
        s.id = 'maCSS';
        s.textContent = `
#maFAB {
  position:fixed;bottom:22px;right:22px;width:54px;height:54px;border-radius:50%;
  background:#1a1a2e;border:none;cursor:pointer;display:flex;align-items:center;
  justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.3);z-index:2147483647;transition:transform .15s;
}
#maFAB:hover{transform:scale(1.08);}
#maFAB svg{width:26px;height:26px;fill:#fff;pointer-events:none;}
#maFAB .maFABLabel{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:9px;color:#fff;background:#1a1a2e;padding:1px 5px;border-radius:4px;white-space:nowrap;font-family:"Segoe UI",Arial,sans-serif;letter-spacing:.3px;}
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
.maPanel{position:fixed;bottom:88px;right:16px;width:96vw;max-width:1500px;max-height:85vh;background:#fff;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.22);border:1px solid #e0e0e0;display:none;flex-direction:column;overflow:hidden;font-family:"Segoe UI",Arial,sans-serif;z-index:2147483645;}
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
.maRow{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;}
.maField{display:flex;flex-direction:column;gap:3px;}
.maField label{font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.4px;}
.maField textarea,.maField select,.maField input{padding:7px 11px;border:1.5px solid #ddd;border-radius:7px;font-size:13px;outline:none;resize:vertical;font-family:inherit;box-sizing:border-box;transition:border-color .2s;}
.maField textarea:focus,.maField select:focus,.maField input:focus{border-color:#0070c9;}
.maCnt{font-size:10px;color:#999;text-align:right;margin-top:1px;}
.maCntW{color:#e65100;}.maCntE{color:#c62828;}
.maBP{padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:opacity .15s;color:#fff;}
.maBP:disabled{opacity:.45;cursor:not-allowed;}
.maBS{padding:8px 14px;border:1.5px solid #ddd;border-radius:7px;background:#f5f5f5;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.maBS:hover{background:#eee;}
.bgB{background:#0070c9;}.bgB:hover{opacity:.88;}
.bgO{background:#e65100;}.bgO:hover{opacity:.88;}
.bgG{background:#2e7d32;}.bgG:hover{opacity:.88;}
.bgY{background:#f57f17;color:#fff;}.bgY:hover{opacity:.88;}
.maPauseBtn{padding:8px 14px;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:#fff;background:#f57f17;transition:background .15s;}
.maPauseBtn.paused{background:#2e7d32;}
.maPauseBtn:hover{opacity:.88;}
.maPg{display:none;margin-bottom:12px;}
.maPg.on{display:block;}
.maPgB{height:7px;background:#eee;border-radius:4px;overflow:hidden;}
.maPgF{height:100%;border-radius:4px;transition:width .3s;width:0%;}
.maPgT{font-size:11px;color:#777;margin-top:3px;}
.maSt{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;margin-bottom:10px;}
.maStB{background:#fff3e0;color:#e65100;}
.maStD{background:#e8f5e9;color:#2e7d32;}
.maStP{background:#fff8e1;color:#f57f17;}
.maTW{overflow:auto;border-radius:7px;border:1px solid #e0e0e0;max-height:45vh;}
.maTbl{width:100%;border-collapse:collapse;font-size:11.5px;}
.maTbl thead th{background:#f8f8f8;padding:8px 8px;text-align:left;font-weight:600;color:#333;border-bottom:2px solid #e0e0e0;white-space:nowrap;position:sticky;top:0;z-index:2;}
.maTbl tbody td{padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#444;vertical-align:top;}
.maTbl tbody tr:hover{background:#fafafa;}
.maTbl tbody tr.maErr{background:#fff5f5;}
.maPivotWrap{overflow:auto;border-radius:7px;border:1px solid #e0e0e0;max-height:40vh;}
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
.maViewToggle{display:flex;gap:6px;margin-bottom:10px;}
.maVBtn{padding:5px 14px;border-radius:6px;border:1.5px solid #ddd;font-size:12px;font-weight:600;cursor:pointer;background:#f5f5f5;color:#555;transition:all .15s;}
.maVBtn.active{background:#1a1a2e;color:#fff;border-color:#1a1a2e;}
.maB{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;display:inline-block;}
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
.bOff{background:#fff3e0;color:#e65100;}
.rT{color:#2e7d32;font-weight:700;}
.rM{color:#f57f17;font-weight:700;}
.rL{color:#e65100;font-weight:600;}
.rO{color:#555;font-weight:600;}
.rN{color:#b71c1c;font-style:italic;}
.dS{color:#2e7d32;font-weight:600;font-size:11px;}
.dF{color:#1565c0;font-weight:600;font-size:11px;}
.dN{color:#999;font-style:italic;}
.maTB{background:#fafafa;border:1px solid #eee;border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#666;display:none;}
.maTB.on{display:block;}
.maTBChips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}
.maTBChip{background:#fff3e0;color:#e65100;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:500;}
.maLg{background:#1a1a2e;color:#00ff88;font-family:Consolas,monospace;font-size:10.5px;padding:8px 12px;border-radius:7px;max-height:72px;overflow-y:auto;margin-bottom:10px;line-height:1.55;display:none;}
.maLg.on{display:block;}
.lC{color:#00b4d8;}.lK{color:#ffd60a;}.lG{color:#00ff88;}
.lR{color:#ff6b6b;}.lP{color:#c77dff;}.lD{color:#48bfe3;}.lA{color:#ff9e00;}
.maSm{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:7px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#555;display:none;}
.maSm.on{display:block;}
.maSm b{color:#333;}.maSmE{color:#e65100;font-weight:600;}
.maEm{text-align:center;padding:36px;color:#aaa;font-size:13px;}
.maAb{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;}
.maAb span{font-size:13px;color:#777;}
.maSp{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:maSpA .6s linear infinite;}
@keyframes maSpA{to{transform:rotate(360deg);}}
.maCell{font-size:11px;line-height:1.5;}
.maCell .sub{color:#888;font-size:10px;display:block;}
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
            <div class="maMenuText"><span class="maMenuTitle">Bulk PDP Scraper</span><span class="maMenuSub">30+ fields · Sellers · Offers · Return · A+</span></div>
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
    //  TOOL 1 — ASIN KEYWORD RANK TRACKER
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
    //  TOOL 2 — BULK PDP SCRAPER (FULLY FIXED)
    // ================================================================

    var CONCURRENT_REQUESTS = 5;

    var pBusy = false, pPaused = false, pData = [];

    // ── Pause-aware parallel engine ──
    async function runPDPFast(asins, fetchFn, onProgress, pauseFlagFn) {
        var results = new Array(asins.length);
        var index = 0;
        async function worker() {
            while (true) {
                // Pause check inside the worker loop
                await waitWhilePaused(pauseFlagFn);
                if (index >= asins.length) break;
                var currentIndex = index++;
                var asin = asins[currentIndex];
                try { results[currentIndex] = await fetchFn(asin); }
                catch (e) { results[currentIndex] = { _error: true, _asin: asin }; }
                if (onProgress) onProgress(currentIndex + 1, asins.length, asin);
                await wt(400 + Math.random() * 600);
            }
        }
        var workers = [];
        for (var i = 0; i < CONCURRENT_REQUESTS; i++) workers.push(worker());
        await Promise.all(workers);
        return results;
    }

    // ── Safe text extract ──
    function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

    // ── Three-state value resolver ──
    // selectorFound=undefined → 'Not able to fetch'
    // selectorFound=true, empty → 'NA'
    // selectorFound=true, value → value
    function cv(val, selectorFound) {
        if (selectorFound === undefined || selectorFound === null || selectorFound === false) return 'Not able to fetch';
        var v = (val || '').toString().replace(/\s+/g, ' ').trim();
        return v === '' ? 'NA' : v;
    }

    // ── Strip JSON blobs from text ──
    function stripJSON(s) {
        return (s || '').replace(/\{[^{}]*\}/g, '').replace(/\s+/g, ' ').trim();
    }

    // ── Check if this page is a redirect / different ASIN ──
    function getPageAsin(doc) {
        // Method 1: canonical URL
        var canonical = doc.querySelector('link[rel="canonical"]');
        if (canonical) {
            var href = canonical.getAttribute('href') || '';
            var m = href.match(/\/dp\/([A-Z0-9]{10})/i);
            if (m) return m[1].toUpperCase();
        }
        // Method 2: add-to-cart form
        var addToCart = doc.querySelector('#add-to-cart-button, #buyNow');
        if (addToCart) {
            var form = addToCart.closest('form');
            if (form) {
                var asinInput = form.querySelector('input[name="ASIN"], input[name="asin"]');
                if (asinInput) return (asinInput.value || '').toUpperCase();
            }
        }
        // Method 3: data-asin on main product div
        var mainDiv = doc.querySelector('#dp, #ppd, #centerCol');
        if (mainDiv) {
            var da = mainDiv.getAttribute('data-asin') || '';
            if (da) return da.toUpperCase();
        }
        // Method 4: look in scripts for "ASIN":"XXXXXXXXXX"
        var scripts = doc.querySelectorAll('script');
        for (var i = 0; i < scripts.length; i++) {
            var sc = scripts[i].textContent || '';
            var sm = sc.match(/"ASIN"\s*:\s*"([A-Z0-9]{10})"/i);
            if (sm) return sm[1].toUpperCase();
        }
        return null;
    }

    // ── Main PDP Fetch Function ──
    async function fetchPDP(asin) {
        var url = 'https://www.amazon.in/dp/' + asin + '?th=1&psc=1';
        var html = await fetch(url, { credentials: 'include' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        });
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var body = doc.body || doc.documentElement;
        var bt = body.textContent || '';
        var bh = body.innerHTML || '';

        // ── PAGE VALIDITY CHECK ──
        var pageLoaded = !!(doc.querySelector('#dp') || doc.querySelector('#ppd') || doc.querySelector('#centerCol'));
        if (!pageLoaded) throw new Error('Page did not load properly');

        // ── REDIRECT / DIFFERENT ASIN CHECK ──
        var pageAsin = getPageAsin(doc);
        if (pageAsin && pageAsin !== asin.toUpperCase()) {
            return {
                _redirected: true,
                _originalAsin: asin,
                _redirectedTo: pageAsin
            };
        }

        // ── UNAVAILABLE / DELISTED CHECK ──
        var unavailMsg = doc.querySelector('#title .a-color-price, #outOfStock');
        var isUnavailable = /currently unavailable|not available|no longer available|this item is unavailable/i.test(bt);
        if (isUnavailable && !doc.querySelector('#productTitle')) {
            return { _unavailable: true, _originalAsin: asin };
        }

        // ── TITLE ──
        var titleEl = doc.querySelector('#productTitle');
        var title = cv(titleEl ? titleEl.textContent.trim() : '', !!titleEl);

        // ── BRAND ──
        var brandEl = doc.querySelector('#bylineInfo, #brand, .po-brand .po-break-word');
        var brandRaw = brandEl
            ? brandEl.textContent.trim()
                .replace(/^Visit the\s+/i, '')
                .replace(/\s+Store$/i, '')
                .replace(/^Brand:\s*/i, '')
                .trim()
            : '';
        var brand = cv(brandRaw, !!brandEl);

        // ── CATEGORY / BROWSE NODE ──
        var bcEl = doc.querySelector('#wayfinding-breadcrumbs_feature_div, #nav-subnav');
        var catRaw = '';
        if (bcEl) {
            var links = bcEl.querySelectorAll('a');
            var parts = [];
            links.forEach(function (l) { var t = l.textContent.trim(); if (t) parts.push(t); });
            catRaw = parts.join(' > ');
        }
        var category = cv(catRaw, !!bcEl);

        // ── PRICE (current selling price) ──
        // Priority order: deal price → our price → price to pay
        var priceEl = doc.querySelector(
            '.priceToPay .a-offscreen,' +
            '#priceblock_dealprice,' +
            '#priceblock_ourprice,' +
            '.apexPriceToPay .a-offscreen,' +
            '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen,' +
            '.a-price.priceToPay .a-offscreen'
        );
        // Fallback: find all .a-price .a-offscreen and take the first non-MRP one
        if (!priceEl) {
            var allPrices = doc.querySelectorAll('.a-price .a-offscreen');
            // Find the first one that is NOT inside a .a-text-price (strikethrough = MRP)
            for (var pi = 0; pi < allPrices.length; pi++) {
                if (!allPrices[pi].closest('.a-text-price')) {
                    priceEl = allPrices[pi];
                    break;
                }
            }
        }
        var price = cv(priceEl ? priceEl.textContent.trim() : '', !!priceEl);

        // ── MRP (strikethrough price — the original price before discount) ──
        // The MRP is always inside .a-text-price (has strikethrough class)
        // Must be DIFFERENT from the selling price
        var mrpEl = null;
        var mrpCandidates = doc.querySelectorAll('.a-text-price .a-offscreen');
        for (var mi = 0; mi < mrpCandidates.length; mi++) {
            var mrpCandidate = mrpCandidates[mi].textContent.trim();
            // Only count if it's actually different from selling price (it IS the original higher price)
            if (mrpCandidate && mrpCandidate !== price) {
                mrpEl = mrpCandidates[mi];
                break;
            }
        }
        // Also try the corePriceBlock's basis price
        if (!mrpEl) {
            mrpEl = doc.querySelector(
                '#corePriceDisplay_desktop_feature_div .a-text-price .a-offscreen,' +
                '#corePrice_feature_div .a-text-price .a-offscreen,' +
                '#listPrice'
            );
        }
        var mrp = cv(mrpEl ? mrpEl.textContent.trim() : '', !!mrpEl);

        // ── DISCOUNT % ──
        var discountEl = doc.querySelector(
            '.savingsPercentage, .savingBasisPrice .a-color-price, ' +
            '#corePriceDisplay_desktop_feature_div .savingsPercentage,' +
            '#corePrice_feature_div .savingsPercentage'
        );
        var discount = 'NA';
        if (discountEl) {
            discount = discountEl.textContent.trim().replace(/\s+/g,' ');
        } else if (price && mrp) {
            // Calculate from prices if not explicitly shown
            var pNum = parseFloat((price+'').replace(/[^0-9.]/g,''));
            var mNum = parseFloat((mrp+'').replace(/[^0-9.]/g,''));
            if (pNum > 0 && mNum > pNum) {
                discount = '-' + Math.round(((mNum-pNum)/mNum)*100) + '%';
            }
        }
        if (discount === 'NA' && pageLoaded) discount = 'NA';

        // ── DEAL TAG ──
        var dealEl = doc.querySelector(
            '#dealBadge, .dealBadge, #deal-badge, ' +
            '.a-badge-supplementary-label, #limited-deal-badge,' +
            '[data-feature-name="dealBadge"] .a-badge-label,' +
            '#sns-base-price' // sometimes deal shown here
        );
        var deal = 'NA';
        if (dealEl) {
            var dealTxt = dealEl.textContent.trim().replace(/\s+/g,' ');
            if (dealTxt && !/subscribe/i.test(dealTxt)) deal = dealTxt.substring(0,50);
        }
        // Check for lightning deal separately
        var ldEl = doc.querySelector('#dealEndTimer, #deal-timer, .dealEndTimer');
        if (ldEl && deal === 'NA') deal = 'Lightning Deal';

        // ── COUPON ──
        // Coupons on Amazon IN are shown as a checkbox or text near add-to-cart
        var couponEl = doc.querySelector(
            '#couponBadgeRegularVPC, .couponBadge, #vpcButton, ' +
            '#coupon-badge-id, .coupon-title, #promoCouponContainer,' +
            '[data-feature-name="couponBadge"]'
        );
        var coupon = 'NA';
        if (couponEl) {
            var cpTxt = couponEl.textContent.trim().replace(/\s+/g,' ');
            if (cpTxt) coupon = cpTxt.substring(0,60);
        } else {
            // Try text search in page
            var cpMatch = bt.match(/(?:clip|apply)\s+(?:this\s+)?coupon[^.]{0,50}([\d]+%|₹[\d]+)/i);
            if (cpMatch) coupon = 'Coupon: ' + cpMatch[1];
        }

        // ── SUBSCRIBE & SAVE ──
        var snsEl = doc.querySelector(
            '#snsAccordionRowMiddle, #sns-base-price, #subscribeAndSave,' +
            '[data-feature-name="snsBadge"], .snsBadge,' +
            '#snsDetailPageDynamicLeafElement'
        );
        var sns = 'NA';
        if (snsEl) {
            var snsTxt = snsEl.textContent.trim();
            var snsPct = snsTxt.match(/(\d+)\s*%/);
            sns = snsPct ? 'Yes (' + snsPct[1] + '% off)' : 'Yes';
        }

        // ── RATING ──
        var ratingEl = doc.querySelector('#acrPopover, #averageCustomerReviews .a-icon-alt, .a-icon-star span.a-icon-alt');
        var rating = 'NA';
        if (ratingEl) {
            var rtTxt = ratingEl.getAttribute('title') || ratingEl.textContent;
            var rm = rtTxt.match(/(\d+\.?\d*)\s*out of/i);
            rating = rm ? rm[1] : rtTxt.trim().substring(0,5);
        } else if (!doc.querySelector('#averageCustomerReviews, #reviewsMedley')) {
            rating = 'Not able to fetch';
        }

        // ── REVIEW COUNT ──
        // Fix: use the ratings count element which is more reliable than review text
        var revCountEl = doc.querySelector(
            '#acrCustomerReviewText,' +
            '#ratings-count,' +
            '[data-hook="total-review-count"],' +
            '#averageCustomerReviews #acrCustomerReviewText'
        );
        var reviewCount = 'NA';
        if (revCountEl) {
            var rcTxt = revCountEl.textContent.trim();
            var rcM = rcTxt.match(/([\d,]+)/);
            reviewCount = rcM ? rcM[1] : rcTxt.substring(0,15);
        } else if (!doc.querySelector('#averageCustomerReviews')) {
            reviewCount = 'Not able to fetch';
        }

        // ── GLOBAL RATING BREAKDOWN ──
        // 5-star, 4-star etc. — from the histogram
        var ratingBreakdown = 'NA';
        var histEl = doc.querySelector('#histogramTable, #cm_cr-product_info');
        if (histEl) {
            var rows5 = histEl.querySelectorAll('tr, li');
            var parts5 = [];
            rows5.forEach(function(r) {
                var pctEl = r.querySelector('.a-text-right a, .a-nowrap a');
                var lblEl = r.querySelector('.a-text-left a, .a-nowrap:first-child');
                if (pctEl && lblEl) parts5.push(lblEl.textContent.trim() + ':' + pctEl.textContent.trim());
            });
            if (parts5.length) ratingBreakdown = parts5.join(', ');
        }

        // ── PAST BOUGHT ──
        var pbEl = doc.querySelector(
            '#social-proofing-faceout-title-tk_bought,' +
            '#socialProofingAsinFaceout_feature_div,' +
            '.social-proofing-faceout-title'
        );
        var pastBought = 'NA';
        if (pbEl) {
            var pbClean = stripJSON(pbEl.textContent);
            if (/\d/.test(pbClean)) pastBought = pbClean.substring(0, 60);
        } else if (!pageLoaded) {
            pastBought = 'Not able to fetch';
        }

        // ── SOLD BY (BUY BOX WINNER) ──
        // Find the actual seller name — not just "by Amazon" text
        var soldBy = 'NA';
        var soldByEl = doc.querySelector(
            '#sellerProfileTriggerId,' +
            '#merchant-info a,' +
            '#tabular-buybox-truncate-1,' +
            '.tabular-buybox-text a,' +
            '#buybox .a-row a[href*="seller"]'
        );
        if (soldByEl) {
            soldBy = soldByEl.textContent.trim().replace(/\s+/g,' ');
        } else {
            // Try regex on innerHTML
            var sbMatch = bh.match(/Sold by\s*<[^>]*>\s*<[^>]*>([^<]{2,60})</i);
            if (sbMatch) soldBy = sbMatch[1].trim();
        }

        // ── FULFILLED BY ──
        var fulfilledBy = 'NA';
        var fbEl = doc.querySelector('#fulfilledBy, .mbcMerchantName');
        if (fbEl) {
            fulfilledBy = fbEl.textContent.trim().replace(/\s+/g,' ');
        } else if (/Fulfilled\s+by\s+Amazon/i.test(bh)) {
            fulfilledBy = 'Amazon';
        }

        // ── CHANNEL FBA / MFN ──
        var ch = 'NA';
        if (/Fulfilled\s+by\s+Amazon/i.test(bh)) ch = 'FBA';
        else if (/Ships\s+from\s+and\s+sold\s+by\s+Amazon/i.test(bh)) ch = 'FBA';
        else if (soldBy && /amazon/i.test(soldBy)) ch = 'FBA';
        else if (soldBy && soldBy !== 'NA') ch = 'MFN';

        // ── OTHER SELLERS / ALL SELLERS ──
        var otherSellers = 'NA';
        var sellerCountEl = doc.querySelector(
            '#olpLinkWidget_feature_div .olpLinkSection,' +
            '#moreBuyingChoices_feature_div,' +
            '#buybox-see-all-buying-choices,' +
            '#all-offers-display'
        );
        if (sellerCountEl) {
            var osM = sellerCountEl.textContent.match(/(\d+)\s*(?:new|used|other|seller)/i);
            otherSellers = osM ? osM[1] + ' sellers' : 'Multiple';
        }

        // ── SELLER DETAILS TABLE ──
        // Scrape the "Other sellers on Amazon" section if visible
        var sellerDetails = [];
        var sellerRows = doc.querySelectorAll('#moreBuyingChoices_feature_div .mbcMerchantRow, .olpOffer, #aod-offer');
        sellerRows.forEach(function(sr) {
            var sName = txt(sr.querySelector('.a-profile-name, .mbcMerchantName, .olpSellerName, a[href*="seller"]'));
            var sPrice = txt(sr.querySelector('.mbcPrice, .olpOfferPrice, .aod-price .a-offscreen, .a-price .a-offscreen'));
            var sShip = txt(sr.querySelector('.mbcShipping, .olpShippingInfo, .aod-ship-message'));
            var sCond = txt(sr.querySelector('.mbcItemCondition, .olpCondition, .aod-offer-condition'));
            var sRating = txt(sr.querySelector('.a-icon-alt'));
            if (sName || sPrice) {
                sellerDetails.push({
                    name: sName || 'NA',
                    price: sPrice || 'NA',
                    shipping: sShip || 'NA',
                    condition: sCond || 'New',
                    rating: sRating || 'NA'
                });
            }
        });
        var sellerDetailsStr = sellerDetails.length > 0
            ? sellerDetails.map(function(s){ return s.name+' @ '+s.price+(s.shipping?' ('+s.shipping+')':''); }).join(' | ')
            : 'NA';

        // ── STOCK STATUS ──
        var stockEl = doc.querySelector('#availability, #outOfStock, #availability_feature_div');
        var stock = 'NA';
        if (stockEl) {
            var st = stockEl.textContent.trim().toLowerCase();
            if (/out of stock|currently unavailable/.test(st)) stock = 'Out of Stock';
            else if (/only (\d+) left|limited stock/.test(st)) {
                var onlyM = stockEl.textContent.match(/only (\d+) left/i);
                stock = onlyM ? 'Low Stock (' + onlyM[1] + ' left)' : 'Limited Stock';
            }
            else if (/in stock/.test(st)) stock = 'In Stock';
            else stock = stockEl.textContent.trim().replace(/\s+/g,' ').substring(0,30);
        } else if (!pageLoaded) {
            stock = 'Not able to fetch';
        }

        // ── IMAGE COUNT ──
        var imgItems = doc.querySelectorAll('#altImages li.item:not(.a-hidden), #imageBlock_feature_div .imageThumbnail');
        var imageCount = imgItems.length > 0 ? imgItems.length
            : doc.querySelector('#imageBlock, #altImages') ? 'NA'
            : 'Not able to fetch';

        // ── A+ CONTENT (Brand Story + A+ both checked separately) ──
        var aplusEl = doc.querySelector('#aplus, #aplus3pContentBody_feature_div, #aplusBody');
        var brandStoryEl = doc.querySelector('#aplusBrandStory_feature_div, #brand-story-ftf-section');
        var aplus = pageLoaded
            ? (aplusEl ? 'Yes' : 'NA')
            : 'Not able to fetch';
        var brandStory = pageLoaded
            ? (brandStoryEl ? 'Yes' : 'NA')
            : 'Not able to fetch';

        // ── RETURN POLICY ──
        var returnEl = doc.querySelector(
            '#returns-policy-message, #returnPolicyDetailsDiv,' +
            '#productDetails_feature_div [class*="return"],' +
            '.return-policy-row,' +
            '#sellersDetails [class*="return"]'
        );
        var returnPolicy = 'NA';
        if (returnEl) {
            var rtxt = returnEl.textContent.trim().replace(/\s+/g,' ');
            if (/non.?returnable|not returnable|no return/i.test(rtxt)) returnPolicy = 'Non-Returnable';
            else if (/returnable|return\s+within|days\s+return|return\s+policy/i.test(rtxt)) {
                var daysM = rtxt.match(/(\d+)\s*days?\s*(?:return|of\s*receipt)/i);
                returnPolicy = daysM ? 'Returnable (' + daysM[1] + ' days)' : 'Returnable';
            } else returnPolicy = rtxt.substring(0, 60);
        } else {
            // Check technical details table
            var techRows = doc.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');
            techRows.forEach(function(r) {
                var th = txt(r.querySelector('th'));
                var td = txt(r.querySelector('td'));
                if (/return/i.test(th)) returnPolicy = td.substring(0, 60);
            });
        }
        // If still NA, check body text
        if (returnPolicy === 'NA') {
            if (/non.?returnable/i.test(bt)) returnPolicy = 'Non-Returnable';
            else if (/\d+\s*days?\s*return/i.test(bt)) {
                var dm2 = bt.match(/(\d+)\s*days?\s*return/i);
                if (dm2) returnPolicy = 'Returnable (' + dm2[1] + ' days)';
            }
        }

        // ── OFFERS SECTION ──
        var offersEl = doc.querySelector(
            '#itembox-InstantOrderUpdate, #promotions, #promotions_feature_div,' +
            '#itembox-Promotions, #heroQuickPromo,' +
            '#promoPriceBlockMessage_feature_div'
        );
        var offers = [];
        if (offersEl) {
            var offerItems = offersEl.querySelectorAll('li, .promoPriceText, .promotion-text, .a-list-item');
            offerItems.forEach(function(oi) {
                var ot = oi.textContent.trim().replace(/\s+/g,' ');
                if (ot && ot.length > 5 && ot.length < 200) offers.push(ot);
            });
        }
        // Also look in the "offers" expandable section
        var moreOffersEl = doc.querySelector('#sopp_feature_div, #multipleOffersTextEl');
        if (moreOffersEl) {
            var mot = moreOffersEl.textContent.trim().replace(/\s+/g,' ');
            if (mot && !offers.includes(mot)) offers.push(mot.substring(0,100));
        }
        var offersStr = offers.length > 0 ? offers.slice(0,5).join(' || ') : 'NA';

        // ── BANK OFFERS ──
        var bankOffers = [];
        var bankOfferEls = doc.querySelectorAll(
            '#CreditCardInstallments li, #instantCashback li,' +
            '#bankPromotions li, .bank-offer-text,' +
            '#checkout-coupon-text li, #itembox-Promotions li'
        );
        bankOfferEls.forEach(function(b) {
            var bt2 = b.textContent.trim().replace(/\s+/g,' ');
            if (bt2 && /bank|card|emi|cashback|credit|debit|hdfc|sbi|icici|axis|kotak|upi/i.test(bt2)) {
                bankOffers.push(bt2.substring(0,120));
            }
        });
        // Also try text search
        if (bankOffers.length === 0) {
            var bankMatch = bh.match(/(?:bank|credit card|debit card)[^<]{5,150}(?:off|cashback|discount)/gi);
            if (bankMatch) {
                bankMatch.slice(0,5).forEach(function(b) {
                    var cleanB = b.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
                    if (cleanB.length > 10) bankOffers.push(cleanB.substring(0,120));
                });
            }
        }
        var bankOffersStr = bankOffers.length > 0 ? bankOffers.slice(0,5).join(' || ') : 'NA';

        // ── BXGY (Buy X Get Y) ──
        var bxgy = 'NA';
        var bxgyEl = doc.querySelector('#itembox-BundleV2, #bxgy-native-display-slot, [data-feature-name="bxgy"]');
        if (bxgyEl) {
            var bxgyTxt = bxgyEl.textContent.trim().replace(/\s+/g,' ');
            if (bxgyTxt) bxgy = bxgyTxt.substring(0,150);
        } else {
            // Text search for Buy X Get Y patterns
            var bxgyM = bt.match(/buy\s+\d+\s+(?:get|and get)\s+[^.]{5,80}/i);
            if (bxgyM) bxgy = bxgyM[0].trim();
        }

        // ── DELIVERY (Standard + Fastest) ──
        var db = doc.querySelector(
            '#mir-layout-DELIVERY_BLOCK-block, #deliveryBlockMessage,' +
            '#ddmDeliveryMessage, #delivery-message, #dynamicDeliveryMessage'
        );
        var dbTx = db ? db.textContent : bt;
        var std = 'NA', fast = 'NA';

        if (db) {
            // Standard delivery
            var stdPatterns = [
                /(?:FREE\s+delivery|Delivery\s+by)[^:]*?:\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /(?:FREE\s+delivery|Delivery\s+by)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /(?:FREE\s+delivery|Delivery\s+by)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /delivery\s+in\s+(\d+[\-\d]*\s+days?)/i
            ];
            for (var si = 0; si < stdPatterns.length; si++) {
                var sm3 = dbTx.match(stdPatterns[si]);
                if (sm3) { std = sm3[1].trim(); break; }
            }
            // Fallback: bold dates not labelled "fastest"
            if (std === 'NA') {
                var bolds = db.querySelectorAll('.a-text-bold, b, strong');
                for (var bi = 0; bi < bolds.length; bi++) {
                    var parentTxt = (bolds[bi].parentElement || {}).textContent || '';
                    if (/fastest/i.test(parentTxt)) continue;
                    var dm3 = bolds[bi].textContent.trim().match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]*\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i);
                    if (dm3) { std = dm3[1].trim(); break; }
                }
            }

            // Fastest delivery
            var fastPatterns = [
                /fastest\s+delivery\s+(Today[^.]*?)(?:\.|Order|$)/i,
                /fastest\s+delivery\s+(Tomorrow[^.]*?)(?:\.|Order|$)/i,
                /fastest\s+delivery[^:]*:\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /fastest\s+delivery\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
                /fastest\s+delivery\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i
            ];
            for (var fi = 0; fi < fastPatterns.length; fi++) {
                var fm = dbTx.match(fastPatterns[fi]);
                if (fm) { fast = fm[1].trim().replace(/Order\s+within.*/i,'').trim(); break; }
            }
        } else {
            std = 'Not able to fetch';
            fast = 'Not able to fetch';
        }

        // ── PRODUCT DETAILS / TECH SPECS ──
        var productDetails = {};
        var specRows = doc.querySelectorAll(
            '#productDetails_techSpec_section_1 tr,' +
            '#productDetails_detailBullets_sections1 tr,' +
            '.a-expander-content .a-list-item,' +
            '#detailBullets_feature_div li'
        );
        specRows.forEach(function(r) {
            var thEl = r.querySelector('th, .a-text-bold');
            var tdEl = r.querySelector('td, .a-list-item');
            if (thEl && tdEl) {
                var k = thEl.textContent.trim().replace(/\s+/g,' ');
                var v = tdEl.textContent.trim().replace(/\s+/g,' ')
                    .replace(/^[\u200e\u200f]+/, '').trim(); // remove LTR/RTL marks
                if (k && v && k.length < 60) productDetails[k] = v;
            }
        });
        // Also grab bullet details
        var bulletItems = doc.querySelectorAll('#detailBullets_feature_div .a-list-item, #detail-bullets .a-list-item');
        bulletItems.forEach(function(li) {
            var spans = li.querySelectorAll('span');
            if (spans.length >= 2) {
                var k = spans[0].textContent.trim().replace(/[:\s]+$/,'');
                var v = spans[1].textContent.trim();
                if (k && v && k.length < 60) productDetails[k] = v;
            }
        });
        var productDetailsStr = Object.keys(productDetails).length > 0
            ? Object.entries(productDetails).slice(0,10).map(function(e){ return e[0]+': '+e[1]; }).join(' | ')
            : 'NA';

        // ── ASIN FROM PAGE (verified) ──
        var verifiedAsin = pageAsin || asin;

        return {
            verifiedAsin, title, brand, category,
            price, mrp, discount,
            deal, coupon, sns,
            rating, reviewCount, ratingBreakdown, pastBought,
            soldBy, fulfilledBy, ch,
            otherSellers, sellerDetailsStr,
            stock,
            imageCount, aplus, brandStory,
            returnPolicy,
            offers: offersStr,
            bankOffers: bankOffersStr,
            bxgy,
            std, fast,
            productDetails: productDetailsStr
        };
    }

    // ================================================================
    //  PDP PANEL BUILD
    // ================================================================

    function buildPDPPanel() {
        if (document.getElementById('maPDPPanel')) return;
        var d = document.createElement('div');
        d.id = 'maPDPPanel'; d.className = 'maPanel';
        d.innerHTML = `
<div class="maPH" style="background:linear-gradient(135deg,#e65100,#ff6f00);">
  <h3>
    <svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 15.93.5 13.5.5c-1.32 0-2.5.54-3.36 1.4L9 3.06 7.86 1.9C7 1.04 5.82.5 4.5.5 2.07.5 0 2.51 0 4.64c0 .48.11.92.18 1.36H0v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
    Bulk PDP Scraper
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

  <div style="font-size:11px;color:#888;background:#fafafa;border:1px solid #eee;border-radius:7px;padding:8px 12px;margin-bottom:12px;">
    Scrapes <b>30+ fields</b>: ASIN &middot; Title &middot; Brand &middot; Category &middot; Price &middot; MRP &middot; Discount &middot; Deal &middot; Coupon &middot; Subscribe&amp;Save &middot;
    Rating &middot; Reviews &middot; Rating Breakdown &middot; Past Bought &middot; Sold By &middot; Fulfilled By &middot; Other Sellers &middot; Seller Details &middot;
    Stock Status &middot; Channel (FBA/MFN) &middot; Image Count &middot; A+ Content &middot; Brand Story &middot;
    Return Policy &middot; Offers &middot; Bank Offers &middot; BXGY &middot; Std Delivery &middot; Fastest Delivery &middot; Product Details
    <br><span style="color:#e65100;font-weight:600;">✓ Redirect detection &middot; Unavailable ASIN detection &middot; Pause/Resume supported</span>
  </div>

  <div class="maLg" id="t2Lg"></div>

  <div class="maPg" id="t2Pg">
    <div class="maPgB"><div class="maPgF" id="t2Fl" style="background:linear-gradient(90deg,#e65100,#ff6f00);"></div></div>
    <div class="maPgT" id="t2PT">...</div>
  </div>

  <div id="t2St"></div>

  <div class="maAb" id="t2Ab" style="display:none;">
    <span id="t2Rc"></span>
    <button class="maBP bgG" id="t2Ex">&#128229; Export CSV</button>
  </div>

  <div id="t2Rs"><div class="maEm">Paste ASINs above and click Scrape PDPs</div></div>
</div>`;
        document.body.appendChild(d);

        document.getElementById('t2Close').onclick = function () { document.getElementById('maPDPPanel').classList.remove('open'); };
        document.getElementById('t2Back').onclick  = function () { document.getElementById('maPDPPanel').classList.remove('open'); toggleMenu(); };

        // Pause/Resume
        document.getElementById('t2Pause').addEventListener('click', function () {
            pPaused = !pPaused;
            this.textContent = pPaused ? '▶ Resume' : '⏸ Pause';
            this.classList.toggle('paused', pPaused);
            document.getElementById('t2St').innerHTML = pPaused
                ? '<div class="maSt maStP">⏸ Paused — click Resume to continue</div>'
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

    async function runPDP() {
        if (pBusy) return;
        var asins = pAsins(document.getElementById('t2A').value || '', MAX_ASINS_PDP);
        var pin   = (document.getElementById('t2Pin').value || '').trim();
        if (!asins.length) { shk(document.getElementById('t2A')); return; }

        pBusy = true; pPaused = false; pData = [];
        var total = asins.length;
        var today = tdy();

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

        // Build full table with ALL columns
        var tw = document.createElement('div'); tw.className = 'maTW';
        tw.innerHTML = `<table class="maTbl"><thead><tr>
          <th>#</th><th>ASIN</th><th>Status</th><th>Title</th><th>Brand</th><th>Category</th>
          <th>Price (₹)</th><th>MRP (₹)</th><th>Discount</th>
          <th>Deal</th><th>Coupon</th><th>Sub&amp;Save</th>
          <th>Rating</th><th>Reviews</th><th>Rating Breakdown</th><th>Past Bought</th>
          <th>Sold By</th><th>Fulfilled By</th><th>Channel</th>
          <th>Other Sellers</th><th>Seller Details</th>
          <th>Stock</th><th>Images</th><th>A+</th><th>Brand Story</th>
          <th>Return Policy</th>
          <th>Offers</th><th>Bank Offers</th><th>BXGY</th>
          <th>Std Delivery</th><th>Fast Delivery</th>
          <th>Product Details</th><th>Date</th>
        </tr></thead><tbody id="t2Tb"></tbody></table>`;
        document.getElementById('t2Rs').appendChild(tw);
        var tbody = document.getElementById('t2Tb');

        if (pin && /^\d{6}$/.test(pin)) {
            t2Log('<span class="lC">Setting pin: ' + pin + '</span>');
            try { await setPin(pin); await wt(1200); t2Log('<span class="lG">✓ Pin set</span>'); }
            catch (e) { t2Log('<span class="lR">Pin fail</span>'); }
        }

        var data = await runPDPFast(
            asins,
            async function (asin) {
                try {
                    var d = await fetchPDP(asin);
                    if (d._redirected) {
                        t2Log('<span class="lR">↪ ' + asin + ' → redirected to ' + d._redirectedTo + ' (SKIPPED)</span>');
                    } else if (d._unavailable) {
                        t2Log('<span class="lR">✗ ' + asin + ' — Not Available / Delisted</span>');
                    } else {
                        t2Log('<span class="lA">📦 ' + asin + '</span>');
                        t2Log('&nbsp;&nbsp;<span class="lG">✓ ' + esc((d.title||'').substring(0, 45)) + '</span>');
                    }
                    return d;
                } catch (e) {
                    t2Log('&nbsp;&nbsp;<span class="lR">✗ ' + e.message + '</span>');
                    return { _error: true, _asin: asin, _errMsg: e.message };
                }
            },
            function (done, tot, asin) {
                var pct = Math.round((done / tot) * 100);
                document.getElementById('t2Fl').style.width = pct + '%';
                document.getElementById('t2PT').textContent = asin + ' — ' + done + '/' + tot + ' (' + pct + '%)';
            },
            function () { return pPaused; }
        );

        // Build table rows with ALL data
        for (var a = 0; a < data.length; a++) {
            var d = data[a];
            var origAsin = asins[a];

            // Determine status
            var status = 'OK';
            var statusBadge = '<span class="maB bIS">OK</span>';
            if (!d) { status = 'Error'; statusBadge = '<span class="maB bOOS">Error</span>'; }
            else if (d._error) { status = 'Error: ' + (d._errMsg||''); statusBadge = '<span class="maB bOOS">Error</span>'; }
            else if (d._redirected) { status = 'Redirected→' + d._redirectedTo; statusBadge = '<span class="maB bLim">Redirected</span>'; }
            else if (d._unavailable) { status = 'Not Available'; statusBadge = '<span class="maB bOOS">Not Available</span>'; }

            var isOK = status === 'OK';

            var row = {
                i: a + 1, asin: origAsin, status: status,
                title:       isOK ? d.title           : 'NA',
                brand:       isOK ? d.brand           : 'NA',
                category:    isOK ? d.category        : 'NA',
                price:       isOK ? d.price           : 'NA',
                mrp:         isOK ? d.mrp             : 'NA',
                discount:    isOK ? d.discount        : 'NA',
                deal:        isOK ? d.deal            : 'NA',
                coupon:      isOK ? d.coupon          : 'NA',
                sns:         isOK ? d.sns             : 'NA',
                rating:      isOK ? d.rating          : 'NA',
                reviewCount: isOK ? d.reviewCount     : 'NA',
                ratingBD:    isOK ? d.ratingBreakdown : 'NA',
                pastBought:  isOK ? d.pastBought      : 'NA',
                soldBy:      isOK ? d.soldBy          : 'NA',
                fulfilledBy: isOK ? d.fulfilledBy     : 'NA',
                ch:          isOK ? d.ch              : 'NA',
                otherSellers:   isOK ? d.otherSellers    : 'NA',
                sellerDetails:  isOK ? d.sellerDetailsStr: 'NA',
                stock:       isOK ? d.stock           : 'NA',
                imageCount:  isOK ? d.imageCount      : 'NA',
                aplus:       isOK ? d.aplus           : 'NA',
                brandStory:  isOK ? d.brandStory      : 'NA',
                returnPolicy: isOK ? d.returnPolicy   : 'NA',
                offers:      isOK ? d.offers          : 'NA',
                bankOffers:  isOK ? d.bankOffers      : 'NA',
                bxgy:        isOK ? d.bxgy            : 'NA',
                std:         isOK ? d.std             : 'NA',
                fast:        isOK ? d.fast            : 'NA',
                productDetails: isOK ? d.productDetails: 'NA',
                today: today
            };
            pData.push(row);

            // Badges
            var cb   = row.ch === 'FBA' ? 'bFBA' : row.ch === 'MFN' ? 'bMFN' : 'bNA';
            var stB  = row.stock === 'In Stock' ? 'bIS' : row.stock === 'Out of Stock' ? 'bOOS' : row.stock.indexOf('Low') !== -1 ? 'bLim' : 'bNA';
            var apB  = row.aplus === 'Yes' ? 'bAP' : 'bNo';
            var bsB  = row.brandStory === 'Yes' ? 'bAP' : 'bNo';
            var snsB = (row.sns && row.sns !== 'NA' && row.sns !== 'N/A') ? 'bSNS' : 'bNA';
            var retB = /non.?return/i.test(row.returnPolicy) ? 'bNRet' : /return/i.test(row.returnPolicy) ? 'bRet' : 'bNA';
            var tSh  = row.title.length > 40 ? esc(row.title.substring(0, 40)) + '…' : esc(row.title);

            tbody.insertAdjacentHTML('beforeend',
                '<tr class="' + (!isOK ? 'maErr' : '') + '">' +
                '<td>' + row.i + '</td>' +
                '<td><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">' + row.asin + '</span></td>' +
                '<td>' + statusBadge + '</td>' +
                '<td title="' + esc(row.title) + '" class="maCell">' + tSh + '</td>' +
                '<td>' + esc(row.brand) + '</td>' +
                '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.category) + '">' + esc(row.category) + '</td>' +
                '<td style="font-weight:700;color:#c62828;">' + esc(row.price) + '</td>' +
                '<td style="color:#777;text-decoration:line-through;">' + esc(row.mrp) + '</td>' +
                '<td style="color:#2e7d32;font-weight:600;">' + esc(row.discount) + '</td>' +
                '<td>' + (row.deal !== 'NA' ? '<span class="maB bDl">' + esc(row.deal) + '</span>' : '—') + '</td>' +
                '<td>' + (row.coupon !== 'NA' ? '<span class="maB bCpn">' + esc(row.coupon) + '</span>' : '—') + '</td>' +
                '<td><span class="maB ' + snsB + '">' + esc(row.sns) + '</span></td>' +
                '<td style="font-weight:700;">' + esc(row.rating) + '</td>' +
                '<td>' + esc(row.reviewCount) + '</td>' +
                '<td style="font-size:10px;color:#777;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.ratingBD) + '">' + esc(row.ratingBD) + '</td>' +
                '<td>' + esc(row.pastBought) + '</td>' +
                '<td>' + esc(row.soldBy) + '</td>' +
                '<td>' + esc(row.fulfilledBy) + '</td>' +
                '<td><span class="maB ' + cb + '">' + esc(row.ch) + '</span></td>' +
                '<td>' + esc(row.otherSellers) + '</td>' +
                '<td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.sellerDetails) + '">' + esc(row.sellerDetails) + '</td>' +
                '<td><span class="maB ' + stB + '">' + esc(row.stock) + '</span></td>' +
                '<td style="text-align:center;">' + esc(String(row.imageCount)) + '</td>' +
                '<td><span class="maB ' + apB + '">' + esc(row.aplus) + '</span></td>' +
                '<td><span class="maB ' + bsB + '">' + esc(row.brandStory) + '</span></td>' +
                '<td><span class="maB ' + retB + '">' + esc(row.returnPolicy) + '</span></td>' +
                '<td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.offers) + '">' + esc(row.offers) + '</td>' +
                '<td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.bankOffers) + '">' + esc(row.bankOffers) + '</td>' +
                '<td style="font-size:10px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.bxgy) + '">' + esc(row.bxgy) + '</td>' +
                '<td class="dS">' + esc(row.std) + '</td>' +
                '<td class="dF">' + esc(row.fast) + '</td>' +
                '<td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.productDetails) + '">' + esc(row.productDetails) + '</td>' +
                '<td>' + row.today + '</td>' +
                '</tr>'
            );
        }

        document.getElementById('t2Fl').style.width = '100%';
        document.getElementById('t2PT').textContent = 'Done — ' + total + ' ASINs scraped.';
        document.getElementById('t2St').innerHTML = '<div class="maSt maStD">✓ ' + pData.length + ' ASINs scraped</div>';
        document.getElementById('t2Ab').style.display = 'flex';
        document.getElementById('t2Rc').textContent = pData.length + ' rows';
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
        pData = [];
    }

    function exportPDPCSV() {
        if (!pData.length) return;
        var rows = [[
            '#','ASIN','Status','Title','Brand','Category',
            'Price','MRP','Discount',
            'Deal','Coupon','Subscribe & Save',
            'Rating','Reviews','Rating Breakdown','Past Bought',
            'Sold By','Fulfilled By','Channel',
            'Other Sellers','Seller Details',
            'Stock Status','Image Count','A+ Content','Brand Story',
            'Return Policy',
            'Offers','Bank Offers','BXGY',
            'Std Delivery','Fast Delivery',
            'Product Details','Date'
        ]];
        pData.forEach(function (r) {
            rows.push([
                r.i, r.asin, r.status, r.title, r.brand, r.category,
                r.price, r.mrp, r.discount,
                r.deal, r.coupon, r.sns,
                r.rating, r.reviewCount, r.ratingBD, r.pastBought,
                r.soldBy, r.fulfilledBy, r.ch,
                r.otherSellers, r.sellerDetails,
                r.stock, r.imageCount, r.aplus, r.brandStory,
                r.returnPolicy,
                r.offers, r.bankOffers, r.bxgy,
                r.std, r.fast,
                r.productDetails, r.today
            ]);
        });
        downloadCSV('PDP_Scraper_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    }

    // ================================================================
    //  INIT
    // ================================================================

    function init() {
        injectCSS();
        buildTrackerPanel();
        buildPDPPanel();
        buildLauncher();
        console.log('[MyAssistant v4.0] Ready — All fixes applied');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
