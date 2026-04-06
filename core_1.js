(function () {
    'use strict';

    /*
    ================================================================
      SHARED CONFIG & UTILITIES
    ================================================================
    */

    var MAX_ASINS_TRACKER = 50;
    var MAX_KWS_TRACKER   = 50;
    var MAX_ASINS_PDP   = 5000;

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
    var arr = raw.split(/[\s,]+/).filter(Boolean);

    if (arr.length > max) {
        arr = arr.slice(0, max);
    }

    return arr;
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

    /* ── Pause helper: waits in a loop while paused flag is true ── */
    function waitWhilePaused(flagFn) {
        return new Promise(function (resolve) {
            (function check() {
                if (!flagFn()) resolve();
                else setTimeout(check, 300);
            })();
        });
    }

    /*
    ================================================================
      CSS
    ================================================================
    */

    function injectCSS() {
        if (document.getElementById('maCSS')) return;
        var s = document.createElement('style');
        s.id = 'maCSS';
        s.textContent = `
/* ── SINGLE LAUNCHER ── */
#maFAB {
  position: fixed; bottom: 22px; right: 22px;
  width: 54px; height: 54px; border-radius: 50%;
  background: #1a1a2e; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,.3);
  z-index: 2147483647; transition: transform .15s;
}
#maFAB:hover { transform: scale(1.08); }
#maFAB svg  { width: 26px; height: 26px; fill: #fff; pointer-events: none; }
#maFAB .maFABLabel {
  position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%);
  font-size: 9px; color: #fff; background: #1a1a2e;
  padding: 1px 5px; border-radius: 4px; white-space: nowrap;
  font-family: "Segoe UI", Arial, sans-serif; letter-spacing: .3px;
}

/* ── TOOL SELECTOR MENU ── */
#maMenu {
  position: fixed; bottom: 88px; right: 22px;
  background: #fff; border-radius: 12px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 6px 28px rgba(0,0,0,.18);
  z-index: 2147483646; display: none; overflow: hidden;
  font-family: "Segoe UI", Arial, sans-serif; min-width: 210px;
}
#maMenu.open { display: block; }
.maMenuHead {
  background: #1a1a2e; color: #fff;
  padding: 10px 14px; font-size: 12px; font-weight: 600;
  letter-spacing: .3px;
}
.maMenuItem {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px; cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: background .12s;
}
.maMenuItem:last-child { border-bottom: none; }
.maMenuItem:hover { background: #f8f9fa; }
.maMenuIcon {
  width: 34px; height: 34px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.maMenuIcon svg { width: 18px; height: 18px; fill: #fff; }
.maMenuText { display: flex; flex-direction: column; gap: 1px; }
.maMenuTitle { font-size: 13px; font-weight: 600; color: #1a1a2e; }
.maMenuSub   { font-size: 10px; color: #888; }

/* ── PANEL SHARED ── */
.maPanel {
  position: fixed; bottom: 88px; right: 16px;
  width: 96vw; max-width: 1400px; max-height: 82vh;
  background: #fff; border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,.22);
  border: 1px solid #e0e0e0;
  display: none; flex-direction: column; overflow: hidden;
  font-family: "Segoe UI", Arial, sans-serif;
  z-index: 2147483645;
}
.maPanel.open { display: flex; }

/* ── PANEL HEADER ── */
.maPH {
  padding: 12px 18px; display: flex; align-items: center;
  justify-content: space-between; flex-shrink: 0; color: #fff;
}
.maPH h3 { margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.maPH svg { width: 18px; height: 18px; fill: #fff; }
.maClose {
  background: rgba(255,255,255,.2); border: none; color: #fff;
  width: 28px; height: 28px; border-radius: 50%; font-size: 17px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.maClose:hover { background: rgba(255,255,255,.35); }

/* ── BACK BUTTON ── */
.maBack {
  background: rgba(255,255,255,.2); border: none; color: #fff;
  padding: 4px 10px; border-radius: 6px; font-size: 11px;
  cursor: pointer; display: flex; align-items: center; gap: 4px;
}
.maBack:hover { background: rgba(255,255,255,.35); }
.maBack svg { width: 12px; height: 12px; fill: #fff; }

/* ── PANEL BODY ── */
.maPB { padding: 16px; overflow-y: auto; flex: 1; }

/* ── FORM ── */
.maRow   { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 12px; }
.maField { display: flex; flex-direction: column; gap: 3px; }
.maField label {
  font-size: 11px; font-weight: 600; color: #555;
  text-transform: uppercase; letter-spacing: .4px;
}
.maField textarea, .maField select, .maField input {
  padding: 7px 11px; border: 1.5px solid #ddd; border-radius: 7px;
  font-size: 13px; outline: none; resize: vertical;
  font-family: inherit; box-sizing: border-box; transition: border-color .2s;
}
.maField textarea:focus, .maField select:focus, .maField input:focus { border-color: #0070c9; }
.maCnt  { font-size: 10px; color: #999; text-align: right; margin-top: 1px; }
.maCntW { color: #e65100; } .maCntE { color: #c62828; }

/* ── BUTTONS ── */
.maBP {
  padding: 8px 18px; border: none; border-radius: 7px; font-size: 13px;
  font-weight: 600; cursor: pointer; display: inline-flex; align-items: center;
  gap: 6px; white-space: nowrap; transition: opacity .15s; color: #fff;
}
.maBP:disabled { opacity: .45; cursor: not-allowed; }
.maBS {
  padding: 8px 14px; border: 1.5px solid #ddd; border-radius: 7px;
  background: #f5f5f5; font-size: 13px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.maBS:hover { background: #eee; }
.bgB { background: #0070c9; } .bgB:hover { opacity: .88; }
.bgO { background: #e65100; } .bgO:hover { opacity: .88; }
.bgG { background: #2e7d32; } .bgG:hover { opacity: .88; }
.bgY { background: #f57f17; color: #fff; }
.bgY:hover { opacity: .88; }

/* ── PAUSE BUTTON ── */
.maPauseBtn {
  padding: 8px 14px; border: none; border-radius: 7px; font-size: 13px;
  font-weight: 600; cursor: pointer; display: inline-flex; align-items: center;
  gap: 6px; white-space: nowrap; color: #fff;
  background: #f57f17; transition: background .15s;
}
.maPauseBtn.paused { background: #2e7d32; }
.maPauseBtn:hover { opacity: .88; }

/* ── PROGRESS ── */
.maPg { display: none; margin-bottom: 12px; }
.maPg.on { display: block; }
.maPgB { height: 7px; background: #eee; border-radius: 4px; overflow: hidden; }
.maPgF { height: 100%; border-radius: 4px; transition: width .3s; width: 0%; }
.maPgT { font-size: 11px; color: #777; margin-top: 3px; }

/* ── STATUS ── */
.maSt { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; margin-bottom: 10px; }
.maStB { background: #fff3e0; color: #e65100; }
.maStD { background: #e8f5e9; color: #2e7d32; }
.maStP { background: #fff8e1; color: #f57f17; }

/* ── TABLE ── */
.maTW  { overflow: auto; border-radius: 7px; border: 1px solid #e0e0e0; max-height: 40vh; }
.maTbl { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.maTbl thead th {
  background: #f8f8f8; padding: 8px 8px; text-align: left; font-weight: 600;
  color: #333; border-bottom: 2px solid #e0e0e0; white-space: nowrap;
  position: sticky; top: 0; z-index: 2;
}
.maTbl tbody td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; color: #444; }
.maTbl tbody tr:hover { background: #fafafa; }
.maTbl tbody tr.maErr { background: #fff5f5; }

/* ── PIVOT TABLE ── */
.maPivotWrap { overflow: auto; border-radius: 7px; border: 1px solid #e0e0e0; max-height: 40vh; }
.maPivotTbl  { border-collapse: collapse; font-size: 11px; }
.maPivotTbl th {
  background: #1a1a2e; color: #fff; padding: 7px 10px;
  white-space: nowrap; font-weight: 600; position: sticky; top: 0; z-index: 2;
}
.maPivotTbl th.pRowH { background: #263238; min-width: 90px; }
.maPivotTbl th.pKwH  { background: #1a237e; color: #e8eaf6; }
.maPivotTbl td { padding: 5px 10px; border: 1px solid #f0f0f0; text-align: center; white-space: nowrap; }
.maPivotTbl td.pRowL { background: #f8f9fa; text-align: left; font-weight: 600; color: #333; }
.maPivotTbl td.pRowL span { display: block; font-size: 10px; color: #0070c9; font-weight: 400; }
.pT  { background: #e8f5e9; color: #1b5e20; font-weight: 700; }
.pM  { background: #fff9c4; color: #f57f17; font-weight: 700; }
.pL  { background: #fff3e0; color: #e65100; }
.pOt { background: #fafafa; color: #555; }
.pNF { background: #ffebee; color: #b71c1c; font-style: italic; }

/* ── VIEW TOGGLE ── */
.maViewToggle { display: flex; gap: 6px; margin-bottom: 10px; }
.maVBtn {
  padding: 5px 14px; border-radius: 6px; border: 1.5px solid #ddd;
  font-size: 12px; font-weight: 600; cursor: pointer; background: #f5f5f5;
  color: #555; transition: all .15s;
}
.maVBtn.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }

/* ── BADGES ── */
.maB  { padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; }
.bFBA { background: #e3f2fd; color: #1565c0; }
.bMFN { background: #fce4ec; color: #c62828; }
.bOrg { background: #e8f5e9; color: #2e7d32; }
.bSpo { background: #fff3e0; color: #e65100; }
.bSP  { background: #e3f2fd; color: #1565c0; }
.bSB  { background: #f3e5f5; color: #7b1fa2; }
.bSD  { background: #fce4ec; color: #c62828; }
.bNA  { background: #f5f5f5; color: #999; }
.bDl  { background: #b71c1c; color: #fff; }
.bNF  { background: #ffebee; color: #b71c1c; }
.bIS  { background: #e8f5e9; color: #2e7d32; }
.bOOS { background: #ffebee; color: #b71c1c; }
.bLim { background: #fff8e1; color: #f57f17; }
.bCpn { background: #f3e5f5; color: #6a1b9a; }
.bSNS { background: #e0f7fa; color: #00695c; }
.bAP  { background: #e8eaf6; color: #283593; }

/* ── RANK COLORS ── */
.rT { color: #2e7d32; font-weight: 700; }
.rM { color: #f57f17; font-weight: 700; }
.rL { color: #e65100; font-weight: 600; }
.rO { color: #555;    font-weight: 600; }
.rN { color: #b71c1c; font-style: italic; }

/* ── DELIVERY ── */
.dS { color: #2e7d32; font-weight: 600; font-size: 11px; }
.dF { color: #1565c0; font-weight: 600; font-size: 11px; }
.dN { color: #999; font-style: italic; }

/* ── TIER CHIP BOX ── */
.maTB { background: #fafafa; border: 1px solid #eee; border-radius: 7px; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: #666; display: none; }
.maTB.on { display: block; }
.maTBChips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.maTBChip { background: #fff3e0; color: #e65100; padding: 2px 9px; border-radius: 10px; font-size: 11px; font-weight: 500; }

/* ── LOG ── */
.maLg {
  background: #1a1a2e; color: #00ff88; font-family: Consolas, monospace;
  font-size: 10.5px; padding: 8px 12px; border-radius: 7px;
  max-height: 72px; overflow-y: auto; margin-bottom: 10px;
  line-height: 1.55; display: none;
}
.maLg.on { display: block; }
.lC { color: #00b4d8; } .lK { color: #ffd60a; } .lG { color: #00ff88; }
.lR { color: #ff6b6b; } .lP { color: #c77dff; } .lD { color: #48bfe3; } .lA { color: #ff9e00; }

/* ── SUMMARY ── */
.maSm { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 7px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; color: #555; display: none; }
.maSm.on { display: block; }
.maSm b { color: #333; } .maSmE { color: #e65100; font-weight: 600; }

/* ── EMPTY ── */
.maEm { text-align: center; padding: 36px; color: #aaa; font-size: 13px; }

/* ── ACT BAR ── */
.maAb { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
.maAb span { font-size: 13px; color: #777; }

/* ── SPINNER ── */
.maSp {
  display: inline-block; width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
  border-radius: 50%; animation: maSpA .6s linear infinite;
}
@keyframes maSpA { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(s);
    }

    /*
    ================================================================
      LAUNCHER + MENU
    ================================================================
    */

    var menuOpen = false;

    function buildLauncher() {
        if (document.getElementById('maFAB')) return;

        var fab = document.createElement('div');
        fab.id  = 'maFAB';
        fab.title = 'My Assistant';
        fab.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          </svg>
          <span class="maFABLabel">Assistant</span>`;
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
            <div class="maMenuText">
              <span class="maMenuTitle">ASIN Rank Tracker</span>
              <span class="maMenuSub">Keyword &times; City &times; Position + Pivot</span>
            </div>
          </div>
          <div class="maMenuItem" id="maMenuT2">
            <div class="maMenuIcon" style="background:#e65100;">
              <svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 15.93.5 13.5.5c-1.32 0-2.5.54-3.36 1.4L9 3.06 7.86 1.9C7 1.04 5.82.5 4.5.5 2.07.5 0 2.51 0 4.64c0 .48.11.92.18 1.36H0v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
            </div>
            <div class="maMenuText">
              <span class="maMenuTitle">Bulk PDP Scraper</span>
              <span class="maMenuSub">25+ fields · Brand · Stock · A+ · Coupons</span>
            </div>
          </div>`;
        document.body.appendChild(menu);

        document.getElementById('maMenuT1').onclick = function () { openTool('tracker'); };
        document.getElementById('maMenuT2').onclick = function () { openTool('pdp'); };

        document.addEventListener('click', function (e) {
            if (!fab.contains(e.target) && !menu.contains(e.target)) closeMenu();
        });
    }

    function toggleMenu() {
        menuOpen = !menuOpen;
        document.getElementById('maMenu').classList.toggle('open', menuOpen);
    }

    function closeMenu() {
        menuOpen = false;
        var m = document.getElementById('maMenu');
        if (m) m.classList.remove('open');
    }

    function openTool(which) {
        closeMenu();
        var t = document.getElementById('maTrackerPanel');
        var p = document.getElementById('maPDPPanel');
        if (which === 'tracker') {
            if (t) t.classList.toggle('open');
            if (p) p.classList.remove('open');
        } else {
            if (p) p.classList.toggle('open');
            if (t) t.classList.remove('open');
        }
    }

    /*
    ================================================================
      TOOL 1 — ASIN KEYWORD RANK TRACKER
      NEW: Pause/Resume · Pivot View
    ================================================================
    */

    var tBusy   = false;
    var tPaused = false;
    var tData   = [];
    var tView   = 'table'; // 'table' | 'pivot'

    function buildTrackerPanel() {
        if (document.getElementById('maTrackerPanel')) return;
        var d = document.createElement('div');
        d.id        = 'maTrackerPanel';
        d.className = 'maPanel';
        d.innerHTML = `
<div class="maPH" style="background:linear-gradient(135deg,#0070c9,#0091ea);">
  <h3>
    <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
    ASIN Rank Tracker
  </h3>
  <div style="display:flex;align-items:center;gap:8px;">
    <button class="maBack" id="t1Back">
      <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      Tools
    </button>
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
      <select id="t1T" style="width:145px;">
        <option value="">-- Select --</option>
        <option>Tier 1</option><option>Tier 2</option><option>Tier 3</option>
      </select>
    </div>
    <div class="maField">
      <label>Max Pages</label>
      <input type="number" id="t1P" value="3" min="1" max="10" style="width:66px;">
    </div>
  </div>

  <div class="maRow">
    <button class="maBP bgB" id="t1Go">&#128269; Execute</button>
    <button class="maPauseBtn" id="t1Pause" style="display:none;">&#9646;&#9646; Pause</button>
    <button class="maBS"       id="t1Cl">&#128465; Clear</button>
  </div>

  <div class="maSm" id="t1Sm"></div>
  <div class="maTB" id="t1TB"><strong id="t1TN"></strong> — Cities:<div class="maTBChips" id="t1TC"></div></div>
  <div class="maLg" id="t1Lg"></div>

  <div class="maPg" id="t1Pg">
    <div class="maPgB"><div class="maPgF" id="t1Fl" style="background:linear-gradient(90deg,#0070c9,#0091ea);"></div></div>
    <div class="maPgT" id="t1PT">...</div>
  </div>

  <div id="t1St"></div>

  <div class="maAb" id="t1Ab" style="display:none;">
    <div class="maViewToggle">
      <button class="maVBtn active" id="t1VT">&#9776; Table</button>
      <button class="maVBtn"        id="t1VP">&#9783; Pivot</button>
    </div>
    <span id="t1Rc"></span>
    <button class="maBP bgG" id="t1Ex">&#128229; Export CSV</button>
  </div>

  <div id="t1Rs"><div class="maEm">Enter ASINs + Keywords + Tier to begin</div></div>
</div>`;
        document.body.appendChild(d);

        document.getElementById('t1Close').onclick = function () { document.getElementById('maTrackerPanel').classList.remove('open'); };
        document.getElementById('t1Back').onclick  = function () { document.getElementById('maTrackerPanel').classList.remove('open'); toggleMenu(); };

        /* Pause/Resume */
        document.getElementById('t1Pause').addEventListener('click', function () {
            tPaused = !tPaused;
            this.textContent = tPaused ? '▶ Resume' : '⏸ Pause';
            this.classList.toggle('paused', tPaused);
            document.getElementById('t1St').innerHTML = tPaused
                ? '<div class="maSt maStP">&#9646;&#9646; Paused — click Resume to continue</div>'
                : '<div class="maSt maStB">&#9654; Resumed…</div>';
        });

        /* View toggle */
        document.getElementById('t1VT').addEventListener('click', function () {
            tView = 'table';
            document.getElementById('t1VT').classList.add('active');
            document.getElementById('t1VP').classList.remove('active');
            renderTrackerView();
        });
        document.getElementById('t1VP').addEventListener('click', function () {
            tView = 'pivot';
            document.getElementById('t1VP').classList.add('active');
            document.getElementById('t1VT').classList.remove('active');
            renderTrackerView();
        });

        document.getElementById('t1T').addEventListener('change', function () {
            var v = this.value;
            var bx = document.getElementById('t1TB');
            var nm = document.getElementById('t1TN');
            var ch = document.getElementById('t1TC');
            if (v && TIERS[v]) {
                nm.textContent = v;
                ch.innerHTML   = TIERS[v].map(function (c) { return '<span class="maTBChip">' + c.city + ' (' + c.pin + ')</span>'; }).join('');
                bx.classList.add('on');
            } else { bx.classList.remove('on'); }
            updateT1Summary();
        });

        ['t1A','t1K','t1P'].forEach(function (id) {
            document.getElementById(id).addEventListener('input', function () {
                if (id === 't1A') {
                    var n = pAsins(this.value, MAX_ASINS_TRACKER).length;
                    var c = document.getElementById('t1AC');
                    c.textContent = n + '/' + MAX_ASINS_TRACKER;
                    c.className = 'maCnt' + (n >= MAX_ASINS_TRACKER ? ' maCntE' : n >= MAX_ASINS_TRACKER * .8 ? ' maCntW' : '');
                }
                if (id === 't1K') {
                    var n2 = pKws(this.value, MAX_KWS_TRACKER).length;
                    var c2 = document.getElementById('t1KC');
                    c2.textContent = n2 + '/' + MAX_KWS_TRACKER;
                    c2.className = 'maCnt' + (n2 >= MAX_KWS_TRACKER ? ' maCntE' : n2 >= MAX_KWS_TRACKER * .8 ? ' maCntW' : '');
                }
                updateT1Summary();
            });
        });

        document.getElementById('t1Go').addEventListener('click', runTracker);
        document.getElementById('t1Cl').addEventListener('click', clearTracker);
        document.getElementById('t1Ex').addEventListener('click', exportTrackerCSV);
    }

    function updateT1Summary() {
        var as   = pAsins(document.getElementById('t1A').value || '', MAX_ASINS_TRACKER);
        var ks   = pKws(document.getElementById('t1K').value || '', MAX_KWS_TRACKER);
        var tier = document.getElementById('t1T').value;
        var mp   = parseInt(document.getElementById('t1P').value) || 3;
        var ci   = (tier && TIERS[tier]) ? TIERS[tier].length : 0;
        var sm   = document.getElementById('t1Sm');
        if (!as.length && !ks.length) { sm.classList.remove('on'); return; }
        var tot = ci * as.length * ks.length;
        var est = Math.ceil(((ci * 1.2) + (ci * as.length * 1.0) + (tot * mp * 1.5)) / 60);
        sm.innerHTML = '<b>' + as.length + '</b> ASIN &times; <b>' + ks.length + '</b> KW &times; <b>' + ci + '</b> cities = <b>' + tot + '</b> combos | Est: <span class="maSmE">~' + est + ' min</span>';
        sm.classList.add('on');
    }

    function t1Log(h) {
        var el = document.getElementById('t1Lg');
        if (!el) return;
        el.classList.add('on'); el.innerHTML += h + '<br>'; el.scrollTop = el.scrollHeight;
    }

    function setPin(pin) {
        return fetch('https://www.amazon.in/gp/delivery/ajax/address-change.html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'locationType=LOCATION_INPUT&zipCode=' + pin + '&storeContext=hpc&deviceType=web&pageType=Detail&actionSource=glow',
            credentials: 'include'
        }).then(function (r) { if (!r.ok) throw new Error('Pin fail ' + r.status); });
    }

    function getSRHtml(kw, pg) {
        return fetch('https://www.amazon.in/s?k=' + encodeURIComponent(kw) + '&page=' + pg, { credentials: 'include' })
            .then(function (r) { return r.text(); });
    }

    function parseSR(html) {
        var doc   = new DOMParser().parseFromString(html, 'text/html');
        var items = doc.querySelectorAll('[data-component-type="s-search-result"]');
        var out   = [];
        items.forEach(function (it, i) {
            var asin = (it.getAttribute('data-asin') || '').trim();
            if (!asin) return;
            var ih   = (it.innerHTML || '').toLowerCase();
            var ix   = (it.textContent || '').toLowerCase();
            var te   = it.querySelector('h2 a span, h2 span.a-text-normal');
            var isSp = it.querySelector('[data-component-type="sp-sponsored-result"],.s-label-popover-default') !== null
                       || ih.indexOf('adplacementid') !== -1 || ix.indexOf('sponsored') !== -1;
            var adT  = '-';
            if (isSp) {
                var cw = (it.getAttribute('cel_widget_id') || '').toLowerCase();
                adT = cw.indexOf('brand') !== -1 ? 'SB' : cw.indexOf('display') !== -1 ? 'SD' : 'SP';
            }
            out.push({ asin: asin, pos: i + 1, spon: isSp, adT: adT, title: te ? te.textContent.trim() : '' });
        });
        return out;
    }

    async function findInSearch(kw, target, maxPg) {
        for (var pg = 1; pg <= maxPg; pg++) {
            t1Log('&nbsp;&nbsp;&nbsp;&nbsp;<span class="lP">Pg ' + pg + '</span>');
            try {
                var res = parseSR(await getSRHtml(kw, pg));
                for (var i = 0; i < res.length; i++) {
                    if (res[i].asin.toUpperCase() === target) {
                        var ov = (pg - 1) * (res.length || 16) + res[i].pos;
                        t1Log('&nbsp;&nbsp;&nbsp;&nbsp;<span class="lG">&#10003; #' + res[i].pos + ' pg' + pg + ' ' + (res[i].spon ? res[i].adT : 'Organic') + '</span>');
                        return { pos: ov, pp: res[i].pos, page: pg, spon: res[i].spon, adT: res[i].adT, type: res[i].spon ? 'Sponsored' : 'Organic' };
                    }
                }
                await wt(700);
            } catch (e) { await wt(500); }
        }
        t1Log('&nbsp;&nbsp;&nbsp;&nbsp;<span class="lR">Not found</span>');
        return { pos: 'Not Found', pp: '-', page: '-', spon: false, adT: '-', type: 'Not Found' };
    }

    /* ── Render whichever view is active ── */
    function renderTrackerView() {
        if (!tData.length) return;
        if (tView === 'pivot') renderPivot();
        else renderTable();
    }

    function renderTable() {
        var rs = document.getElementById('t1Rs');
        var tw = document.createElement('div'); tw.className = 'maTW';
        tw.innerHTML = `<table class="maTbl"><thead><tr>
          <th>#</th><th>ASIN</th><th>Keyword</th><th>City</th><th>Pincode</th>
          <th>Position</th><th>Page</th><th>Type</th><th>Ad Type</th><th>Date</th>
        </tr></thead><tbody></tbody></table>`;
        rs.innerHTML = '';
        rs.appendChild(tw);
        var tbody = tw.querySelector('tbody');
        tData.forEach(function (row) {
            var pos = row.pos;
            var pc  = pos === 'Not Found' || pos === 'Error' ? 'rN' : pos <= 5 ? 'rT' : pos <= 10 ? 'rM' : pos <= 20 ? 'rL' : 'rO';
            var lb  = row.type === 'Organic' ? 'bOrg' : row.type === 'Sponsored' ? 'bSpo' : 'bNF';
            var ab  = row.adT === 'SP' ? 'bSP' : row.adT === 'SB' ? 'bSB' : row.adT === 'SD' ? 'bSD' : 'bNA';
            var ie  = row.type === 'Not Found' || row.type === 'Error';
            tbody.insertAdjacentHTML('beforeend',
                '<tr' + (ie ? ' class="maErr"' : '') + '>' +
                '<td>' + row.i + '</td>' +
                '<td><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">' + row.asin + '</span></td>' +
                '<td><span style="background:#e8eaf6;color:#283593;padding:1px 6px;border-radius:8px;font-size:10px;">' + esc(row.kw) + '</span></td>' +
                '<td>' + row.city + '</td>' +
                '<td style="color:#777;">' + row.pin + '</td>' +
                '<td><span class="' + pc + '">' + pos + '</span></td>' +
                '<td>' + row.pg + '</td>' +
                '<td><span class="maB ' + lb + '">' + row.type + '</span></td>' +
                '<td><span class="maB ' + ab + '">' + row.adT + '</span></td>' +
                '<td>' + row.today + '</td>' +
                '</tr>'
            );
        });
    }

    /*
     * PIVOT: rows = ASIN × Keyword  |  cols = Cities
     * Cell value = position (color-coded)
     */
    function renderPivot() {
        /* collect unique keys */
        var asins  = [];
        var kws    = [];
        var cities = [];
        tData.forEach(function (r) {
            if (asins.indexOf(r.asin) === -1) asins.push(r.asin);
            if (kws.indexOf(r.kw)     === -1) kws.push(r.kw);
            if (cities.indexOf(r.city)=== -1) cities.push(r.city);
        });

        /* build lookup: asin|kw|city → row */
        var lookup = {};
        tData.forEach(function (r) { lookup[r.asin + '|' + r.kw + '|' + r.city] = r; });

        /* build HTML */
        var html = '<div class="maPivotWrap"><table class="maPivotTbl"><thead><tr>' +
                   '<th class="pRowH">ASIN</th><th class="pRowH">Keyword</th>';
        cities.forEach(function (c) { html += '<th class="pKwH">' + esc(c) + '</th>'; });
        html += '</tr></thead><tbody>';

        asins.forEach(function (asin) {
            kws.forEach(function (kw) {
                html += '<tr><td class="pRowL"><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">' + asin + '</span></td>' +
                        '<td class="pRowL"><span>' + esc(kw) + '</span></td>';
                cities.forEach(function (city) {
                    var r   = lookup[asin + '|' + kw + '|' + city];
                    var pos = r ? r.pos : '—';
                    var cls = !r || pos === 'Not Found' || pos === 'Error' ? 'pNF'
                            : pos <= 5 ? 'pT' : pos <= 10 ? 'pM' : pos <= 20 ? 'pL' : 'pOt';
                    html += '<td class="' + cls + '">' + pos + '</td>';
                });
                html += '</tr>';
            });
        });

        html += '</tbody></table></div>';
        document.getElementById('t1Rs').innerHTML = html;
    }

    async function runTracker() {
        if (tBusy) return;
        var asins = pAsins(document.getElementById('t1A').value || '', MAX_ASINS_TRACKER);
        var kws   = pKws(document.getElementById('t1K').value || '', MAX_KWS_TRACKER);
        var tier  = document.getElementById('t1T').value;
        var maxPg = parseInt(document.getElementById('t1P').value) || 3;

        if (!asins.length)         { shk(document.getElementById('t1A')); return; }
        if (!kws.length)           { shk(document.getElementById('t1K')); return; }
        if (!tier || !TIERS[tier]) { shk(document.getElementById('t1T')); return; }

        tBusy = true; tPaused = false; tData = [];
        var cities = TIERS[tier];
        var total  = cities.length * asins.length * kws.length;
        var done   = 0;
        var today  = tdy();

        var goB    = document.getElementById('t1Go');
        var pauseB = document.getElementById('t1Pause');
        goB.disabled = true; goB.innerHTML = '<span class="maSp"></span> Fetching...';
        pauseB.style.display = 'inline-flex'; pauseB.textContent = '⏸ Pause'; pauseB.classList.remove('paused');

        document.getElementById('t1Lg').innerHTML = ''; document.getElementById('t1Lg').classList.remove('on');
        document.getElementById('t1Pg').classList.add('on');
        document.getElementById('t1Fl').style.width = '0%';
        document.getElementById('t1St').innerHTML = '<div class="maSt maStB">&#8987; ' + total + ' combos running...</div>';
        document.getElementById('t1Ab').style.display = 'none';
        document.getElementById('t1Rs').innerHTML = '';

        /* Pre-build table for live streaming */
        var tw = document.createElement('div'); tw.className = 'maTW';
        tw.innerHTML = `<table class="maTbl"><thead><tr>
          <th>#</th><th>ASIN</th><th>Keyword</th><th>City</th><th>Pincode</th>
          <th>Position</th><th>Page</th><th>Type</th><th>Ad Type</th><th>Date</th>
        </tr></thead><tbody id="t1Tb"></tbody></table>`;
        document.getElementById('t1Rs').appendChild(tw);
        var tbody = document.getElementById('t1Tb');

        for (var c = 0; c < cities.length; c++) {
            var city = cities[c];
            t1Log('<span class="lC">&#127961; ' + city.city + ' (' + city.pin + ')</span>');
            try { await setPin(city.pin); await wt(1000); t1Log('&nbsp;&nbsp;<span class="lG">&#10003; Pin set</span>'); }
            catch (e) { t1Log('&nbsp;&nbsp;<span class="lR">Pin err</span>'); }

            for (var a = 0; a < asins.length; a++) {
                var asin = asins[a];
                for (var k = 0; k < kws.length; k++) {
                    /* ── PAUSE CHECK ── */
                    await waitWhilePaused(function () { return tPaused; });

                    var kw = kws[k];
                    t1Log('&nbsp;&nbsp;<span class="lA">' + asin + '</span> &rarr; <span class="lK">"' + esc(kw) + '"</span>');

                    var sr;
                    try   { sr = await findInSearch(kw, asin, maxPg); await wt(500); }
                    catch (e) { sr = { pos: 'Error', pp: '-', page: '-', spon: false, adT: '-', type: 'Error' }; }

                    done++;
                    var pct = Math.round((done / total) * 100);
                    document.getElementById('t1Fl').style.width = pct + '%';
                    document.getElementById('t1PT').textContent = city.city + ' | ' + asin + ' | ' + kw + ' — ' + done + '/' + total + ' (' + pct + '%)';

                    var row = { i: done, asin: asin, kw: kw, city: city.city, pin: city.pin, pos: sr.pos, pp: sr.pp, pg: sr.page, type: sr.type, adT: sr.adT, today: today };
                    tData.push(row);

                    var pos = row.pos;
                    var pc  = pos === 'Not Found' || pos === 'Error' ? 'rN' : pos <= 5 ? 'rT' : pos <= 10 ? 'rM' : pos <= 20 ? 'rL' : 'rO';
                    var lb  = row.type === 'Organic' ? 'bOrg' : row.type === 'Sponsored' ? 'bSpo' : 'bNF';
                    var ab  = row.adT === 'SP' ? 'bSP' : row.adT === 'SB' ? 'bSB' : row.adT === 'SD' ? 'bSD' : 'bNA';
                    var ie  = row.type === 'Not Found' || row.type === 'Error';

                    tbody.insertAdjacentHTML('beforeend',
                        '<tr' + (ie ? ' class="maErr"' : '') + '>' +
                        '<td>' + row.i + '</td>' +
                        '<td><span style="background:#e0f2f1;color:#00695c;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">' + row.asin + '</span></td>' +
                        '<td><span style="background:#e8eaf6;color:#283593;padding:1px 6px;border-radius:8px;font-size:10px;">' + esc(row.kw) + '</span></td>' +
                        '<td>' + row.city + '</td>' +
                        '<td style="color:#777;">' + row.pin + '</td>' +
                        '<td><span class="' + pc + '">' + pos + '</span></td>' +
                        '<td>' + row.pg + '</td>' +
                        '<td><span class="maB ' + lb + '">' + row.type + '</span></td>' +
                        '<td><span class="maB ' + ab + '">' + row.adT + '</span></td>' +
                        '<td>' + row.today + '</td>' +
                        '</tr>'
                    );
                }
            }
        }

        document.getElementById('t1Fl').style.width = '100%';
        document.getElementById('t1PT').textContent = 'Done — ' + total + ' combos checked.';
        document.getElementById('t1St').innerHTML = '<div class="maSt maStD">&#10003; ' + tData.length + ' results</div>';
        document.getElementById('t1Ab').style.display = 'flex';
        document.getElementById('t1Rc').textContent = tData.length + ' rows';
        goB.disabled = false; goB.innerHTML = '&#128269; Execute';
        pauseB.style.display = 'none';
        tBusy = false; tPaused = false;
    }

    function clearTracker() {
        if (tBusy) return;
        ['t1A','t1K'].forEach(function (id) { document.getElementById(id).value = ''; });
        document.getElementById('t1T').value = ''; document.getElementById('t1P').value = '3';
        document.getElementById('t1AC').textContent = '0/' + MAX_ASINS_TRACKER;
        document.getElementById('t1KC').textContent = '0/' + MAX_KWS_TRACKER;
        document.getElementById('t1Sm').classList.remove('on');
        document.getElementById('t1TB').classList.remove('on');
        document.getElementById('t1Pg').classList.remove('on');
        document.getElementById('t1St').innerHTML = '';
        document.getElementById('t1Ab').style.display = 'none';
        document.getElementById('t1Lg').innerHTML = ''; document.getElementById('t1Lg').classList.remove('on');
        document.getElementById('t1Rs').innerHTML = '<div class="maEm">Enter ASINs + Keywords + Tier to begin</div>';
        document.getElementById('t1Pause').style.display = 'none';
        tData = []; tView = 'table';
        document.getElementById('t1VT').classList.add('active');
        document.getElementById('t1VP').classList.remove('active');
    }

    function exportTrackerCSV() {
        if (!tData.length) return;
        var rows = [['#','ASIN','Keyword','City','Pincode','Position','Page','Type','Ad Type','Date']];
        tData.forEach(function (r) { rows.push([r.i, r.asin, r.kw, r.city, r.pin, r.pos, r.pg, r.type, r.adT, r.today]); });
        downloadCSV('ASIN_Tracker_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    }

    /*
    ================================================================
      TOOL 2 — BULK PDP SCRAPER
      NEW FIELDS: Brand · Stock · Images · A+ · Coupon · SNS ·
                  Past Bought · Buy Box · Other Sellers · Browse Node
      NEW: Pause / Resume
    ================================================================
    */

/* ================= FAST PARALLEL PDP ENGINE ================= */

var CONCURRENT_REQUESTS = 8;   // 6–10 best
var REQUEST_DELAY_MIN = 300;
var REQUEST_DELAY_MAX = 900;

async function runPDPFast(asins, fetchFn, onProgress) {
    let results = new Array(asins.length);
    let index = 0;
    let completed = 0;

    async function worker() {
        while (true) {
            let currentIndex;

            // thread-safe index pick
            if (index >= asins.length) break;
            currentIndex = index++;
            let asin = asins[currentIndex];

            try {
                let data = await fetchFn(asin);
                results[currentIndex] = data;
            } catch (e) {
                results[currentIndex] = {
                    asin: asin,
                    error: true
                };
            }

            completed++;

            // progress callback
            if (onProgress) onProgress(completed, asins.length, asin);

            // random delay (anti-block)
            await wt(REQUEST_DELAY_MIN + Math.random() * (REQUEST_DELAY_MAX - REQUEST_DELAY_MIN));
        }
    }

    let workers = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        workers.push(worker());
    }

    await Promise.all(workers);

    return results;
}


/* ================= FAST PARALLEL PDP ENGINE Ended ================= */

    var pBusy   = false;
    var pPaused = false;
    var pData   = [];

    function buildPDPPanel() {
        if (document.getElementById('maPDPPanel')) return;
        var d = document.createElement('div');
        d.id        = 'maPDPPanel';
        d.className = 'maPanel';
        d.innerHTML = `
<div class="maPH" style="background:linear-gradient(135deg,#e65100,#ff6f00);">
  <h3>
    <svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 15.93.5 13.5.5c-1.32 0-2.5.54-3.36 1.4L9 3.06 7.86 1.9C7 1.04 5.82.5 4.5.5 2.07.5 0 2.51 0 4.64c0 .48.11.92.18 1.36H0v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
    Bulk PDP Scraper
  </h3>
  <div style="display:flex;align-items:center;gap:8px;">
    <button class="maBack" id="t2Back">
      <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      Tools
    </button>
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
    Scrapes: ASIN &middot; Title &middot; Brand &middot; Category &middot; Price &middot; MRP &middot; Deal &middot; Coupon &middot; Subscribe&amp;Save &middot;
    Rating &middot; Reviews &middot; Past Bought &middot; Buy Box &middot; Other Sellers &middot; Stock Status &middot;
    Channel (FBA/MFN) &middot; Image Count &middot; A+ Content &middot; Std Delivery &middot; Fastest Delivery
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

        /* Pause/Resume */
        document.getElementById('t2Pause').addEventListener('click', function () {
            pPaused = !pPaused;
            this.textContent = pPaused ? '▶ Resume' : '⏸ Pause';
            this.classList.toggle('paused', pPaused);
            document.getElementById('t2St').innerHTML = pPaused
                ? '<div class="maSt maStP">&#9646;&#9646; Paused — click Resume to continue</div>'
                : '<div class="maSt maStB">&#9654; Resumed…</div>';
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

    /* ── HELPER: clean display values ── */
    /*
       Rules:
       - f(val, selectorFound)
         • selectorFound=false  → 'Not able to fetch'   (tried, selector missing/broke)
         • selectorFound=true, val empty/blank → 'NA'   (selector found but genuinely no content)
         • selectorFound=true, val present     → val    (good data)
    */
    function cv(val, selectorFound) {
        if (!selectorFound) return 'Not able to fetch';
        var v = (val || '').toString().trim();
        return v === '' ? 'NA' : v;
    }

    /* Strip JSON blobs like {"isInternal":false,...} from text */
    function stripJSON(s) {
        return (s || '').replace(/\{[^}]{0,300}\}/g, '').replace(/\s+/g, ' ').trim();
    }

    /* ── ENHANCED fetchPDP: clean display rules throughout ── */
    async function fetchPDP(asin) {
        var html = await fetch('https://www.amazon.in/dp/' + asin, { credentials: 'include' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status); return r.text();
        });
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var bt  = doc.body ? doc.body.textContent : '';
        var bh  = doc.body ? doc.body.innerHTML   : '';

        /* ── Title ── */
        var titleEl = doc.querySelector('#productTitle');
        var title   = cv(titleEl ? titleEl.textContent.trim() : '', !!titleEl);

        /* ── Brand ── */
        var brandEl = doc.querySelector('#bylineInfo, #brand, .po-brand .po-break-word');
        var brandRaw = brandEl
            ? brandEl.textContent.trim().replace(/^Visit the\s+/i,'').replace(/\s+Store$/i,'').trim()
            : '';
        var brand = cv(brandRaw, !!brandEl);

        /* ── Category / Browse Node ── */
        var bcEl     = doc.querySelector('#wayfinding-breadcrumbs_feature_div, #nav-subnav');
        var catRaw   = '';
        if (bcEl) {
            var links = bcEl.querySelectorAll('a, span.a-list-item');
            var parts = [];
            links.forEach(function (l) { var t = l.textContent.trim(); if (t) parts.push(t); });
            catRaw = parts.join(' > ');
        }
        var category = cv(catRaw, !!bcEl);

        /* ── Price ── */
        var priceEl = doc.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .priceToPay .a-offscreen');
        var price   = cv(priceEl ? priceEl.textContent.trim() : '', !!priceEl);

        /* ── MRP ── */
        var mrpEl = doc.querySelector('.a-text-price .a-offscreen');
        var mrp   = cv(mrpEl ? mrpEl.textContent.trim() : '', !!mrpEl);

        /* ── Deal tag ── */
        /*  Selector exists but no deal badge on page → 'NA'
            Selector missing entirely                 → 'Not able to fetch'
            Badge found                               → badge text            */
        var dealEl  = doc.querySelector('#dealBadge, .dealBadge, .a-badge-label');
        var deal;
        if (!doc.querySelector('#dp, #ppd')) {
            // page didn't load properly — can't determine
            deal = 'Not able to fetch';
        } else {
            deal = dealEl ? dealEl.textContent.trim().substring(0, 40) : 'NA';
        }

        /* ── Coupon ── */
        var cpnEl  = doc.querySelector('#couponBadgeRegularVPC, .couponBadge, #vpcButton');
        var coupon;
        if (!doc.querySelector('#dp, #ppd')) {
            coupon = 'Not able to fetch';
        } else {
            coupon = cpnEl ? cpnEl.textContent.trim().replace(/\s+/g,' ').substring(0,50) : 'NA';
        }

        /* ── Subscribe & Save ── */
        var snsEl = doc.querySelector('#snsAccordionRowMiddle, #sns-base-price, #subscribeAndSave');
        var sns;
        if (!doc.querySelector('#dp, #ppd')) {
            sns = 'Not able to fetch';
        } else if (snsEl) {
            var snsPct = snsEl.textContent.match(/(\d+)%/);
            sns = snsPct ? 'Yes (' + snsPct[1] + '% off)' : 'Yes';
        } else {
            sns = 'NA';
        }

        /* ── Rating ── */
        var ratingEl = doc.querySelector('#acrPopover, #averageCustomerReviews .a-icon-alt');
        var rating   = 'Not able to fetch';
        if (ratingEl) {
            var rm = ratingEl.textContent.match(/(\d+\.?\d*)\s*out of/i);
            var rawR = rm ? rm[1] : (ratingEl.getAttribute('title') || ratingEl.textContent.trim().substring(0, 6));
            rating = cv(rawR, true);
        } else if (doc.querySelector('#averageCustomerReviews, #reviewsMedley')) {
            // review section exists but rating not parseable
            rating = 'NA';
        }

        /* ── Reviews ── */
        var revEl   = doc.querySelector('#acrCustomerReviewText, #ratings-count');
        var revRaw  = revEl ? revEl.textContent.trim().replace(/[^0-9,]/g, '') : '';
        var reviews = cv(revRaw, !!revEl);

        /* ── Past Bought ── */
        /*  Strip JSON garbage, keep only human-readable text like "400+ bought in past month" */
        var pbEl = doc.querySelector('#social-proofing-faceout-title-tk_bought, #socialProofingAsinFaceout_feature_div');
        var pastBought;
        if (pbEl) {
            var pbClean = stripJSON(pbEl.textContent);
            // must contain digits to be meaningful (e.g. "400+")
            pastBought = /\d/.test(pbClean) ? pbClean.substring(0, 50) : 'NA';
        } else if (doc.querySelector('#dp, #ppd')) {
            // page loaded fine — product just has no past-bought signal
            pastBought = 'NA';
        } else {
            pastBought = 'Not able to fetch';
        }

        /* ── Buy Box / Sold By ── */
        var bbEl   = doc.querySelector('#merchant-info, #tabular-buybox-truncate-1, #sellerProfileTriggerId');
        var soldby = cv(bbEl ? bbEl.textContent.trim().replace(/\s+/g, ' ').substring(0, 60) : '', !!bbEl);

        /* ── Other Sellers Count ── */
        var osEl = doc.querySelector('#olpLinkWidget_feature_div, #moreBuyingChoices_feature_div, #buybox-see-all-buying-choices');
        var otherSellers;
        if (osEl) {
            var osM = osEl.textContent.match(/(\d+)\s+(?:new|used|other)/i);
            otherSellers = osM ? osM[1] + ' offers' : cv(osEl.textContent.trim().replace(/\s+/g,' ').substring(0,30), true);
        } else if (doc.querySelector('#dp, #ppd')) {
            // page loaded — no other sellers listed
            otherSellers = 'NA';
        } else {
            otherSellers = 'Not able to fetch';
        }

        /* ── Stock Status ── */
        var stockEl = doc.querySelector('#availability, #outOfStock');
        var stock;
        if (stockEl) {
            var st = stockEl.textContent.trim().toLowerCase();
            stock = /out of stock|currently unavailable/.test(st) ? 'Out of Stock'
                  : /only \d+ left|limited stock/.test(st)        ? 'Limited Stock'
                  : /in stock/.test(st)                            ? 'In Stock'
                  : cv(stockEl.textContent.trim().substring(0, 30), true);
        } else if (doc.querySelector('#dp, #ppd')) {
            stock = 'NA';
        } else {
            stock = 'Not able to fetch';
        }

        /* ── Channel FBA / MFN ── */
        var ch = 'Not able to fetch';
        if (doc.querySelector('#dp, #ppd')) {
            if (/Fulfilled\s+by\s+Amazon/i.test(bh)) ch = 'FBA';
            else if (/Ships\s+from\s+and\s+sold\s+by/i.test(bh) || (bbEl && bbEl.textContent.toLowerCase().indexOf('sold by') !== -1)) ch = 'MFN';
            else ch = 'NA';
        }

        /* ── Image Count ── */
        var imgItems   = doc.querySelectorAll('#altImages li.item, #imageBlock_feature_div .imageThumbnail');
        var imageCount = imgItems.length > 0 ? imgItems.length
                       : doc.querySelector('#imageBlock, #altImages') ? 'NA'
                       : 'Not able to fetch';

        /* ── A+ Content ── */
        var aplusEl = doc.querySelector('#aplus, #aplusBrandStory_feature_div, #aplus3pContentBody_feature_div');
        var aplus   = doc.querySelector('#dp, #ppd') ? (aplusEl ? 'Yes' : 'NA') : 'Not able to fetch';

        /* ── Delivery ── */
        var db   = doc.querySelector('#mir-layout-DELIVERY_BLOCK-block, #deliveryBlockMessage, #ddmDeliveryMessage');
        var dbTx = db ? db.textContent : bt;

        var std = 'Not able to fetch';
        var sp1 = [
            /(?:FREE\s+delivery|Delivery\s+by)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
            /(?:FREE\s+delivery|Delivery\s+by)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i
        ];
        for (var i = 0; i < sp1.length; i++) { var sm2 = dbTx.match(sp1[i]); if (sm2) { std = sm2[1].trim(); break; } }
        if (std === 'Not able to fetch' && db) {
            var bolds = db.querySelectorAll('.a-text-bold, b, strong');
            for (var b = 0; b < bolds.length; b++) {
                if (((bolds[b].parentElement || {}).textContent || '').toLowerCase().indexOf('fastest') !== -1) continue;
                var dm = bolds[b].textContent.trim().match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]*\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i);
                if (dm) { std = dm[1].trim(); break; }
            }
        }
        // If delivery block exists but no date parsed → NA (genuinely no std delivery shown)
        if (std === 'Not able to fetch' && db) std = 'NA';

        var fast = 'Not able to fetch';
        var fp1  = [
            /fastest\s+delivery\s+(Today[^.]*?)(?:\.|Order|$)/i,
            /fastest\s+delivery\s+(Tomorrow[^.]*?)(?:\.|Order|$)/i,
            /fastest\s+delivery\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
            /fastest\s+delivery\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i
        ];
        for (var f = 0; f < fp1.length; f++) { var fm = dbTx.match(fp1[f]); if (fm) { fast = fm[1].trim().replace(/\s+/g, ' ').replace(/Order\s+within.*$/i, '').trim(); break; } }
        if (fast === 'Not able to fetch' && db) fast = 'NA';

        return { title, brand, category, price, mrp, deal, coupon, sns, rating, reviews, pastBought, soldby, otherSellers, stock, ch, imageCount, aplus, std, fast };
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
        document.getElementById('t2St').innerHTML = '<div class="maSt maStB">&#8987; Scraping ' + total + ' ASINs...</div>';
        document.getElementById('t2Ab').style.display = 'none';
        document.getElementById('t2Rs').innerHTML = '';

        var tw = document.createElement('div'); tw.className = 'maTW';
        tw.innerHTML = `<table class="maTbl"><thead><tr>
          <th>#</th><th>ASIN</th><th>Title</th><th>Brand</th><th>Category</th>
          <th>Price</th><th>MRP</th><th>Deal</th><th>Coupon</th><th>Sub&amp;Save</th>
          <th>Rating</th><th>Reviews</th><th>Past Bought</th>
          <th>Sold By</th><th>Other Sellers</th><th>Stock</th>
          <th>Channel</th><th>Images</th><th>A+</th>
          <th>Std Delivery</th><th>Fast Delivery</th><th>Date</th>
        </tr></thead><tbody id="t2Tb"></tbody></table>`;
        document.getElementById('t2Rs').appendChild(tw);
        var tbody = document.getElementById('t2Tb');

        if (pin && /^\d{6}$/.test(pin)) {
            t2Log('<span class="lC">Setting pin: ' + pin + '</span>');
            try { await setPin(pin); await wt(1000); t2Log('<span class="lG">&#10003; Pin set</span>'); }
            catch (e) { t2Log('<span class="lR">Pin fail</span>'); }
        }

       var data = await runPDPFast(
    asins,
    async function (asin) {
        try {
            let d = await fetchPDP(asin);
            t2Log('<span class="lA">&#128230; ' + asin + '</span>');
            t2Log('&nbsp;&nbsp;<span class="lG">&#10003; ' + esc(d.title.substring(0, 40)) + '</span>');
            return d;
        } catch (e) {
            t2Log('&nbsp;&nbsp;<span class="lR">&#10007; ' + e.message + '</span>');
            return {
                title:'Error', brand:'N/A', category:'N/A', price:'N/A', mrp:'N/A',
                deal:'N/A', coupon:'N/A', sns:'N/A', rating:'N/A', reviews:'N/A',
                pastBought:'N/A', soldby:'N/A', otherSellers:'N/A',
                stock:'N/A', ch:'N/A', imageCount:'N/A', aplus:'N/A',
                std:'N/A', fast:'N/A'
            };
        }
    },
    function (done, total, asin) {
        var pct = Math.round((done / total) * 100);
        document.getElementById('t2Fl').style.width = pct + '%';
        document.getElementById('t2PT').textContent =
            asin + ' — ' + done + '/' + total + ' (' + pct + '%)';
    }
);

// ✅ TABLE BUILD (same UI as before)
for (var a = 0; a < data.length; a++) {
    var d = data[a];

    var row = {
        i: a + 1, asin: asins[a],
        title: d.title, brand: d.brand, category: d.category,
        price: d.price, mrp: d.mrp, deal: d.deal,
        coupon: d.coupon, sns: d.sns,
        rating: d.rating, reviews: d.reviews, pastBought: d.pastBought,
        soldby: d.soldby, otherSellers: d.otherSellers,
        stock: d.stock, ch: d.ch,
        imageCount: d.imageCount, aplus: d.aplus,
        std: d.std, fast: d.fast, today
    };

    pData.push(row);

    var cb  = row.ch === 'FBA' ? 'bFBA' : row.ch === 'MFN' ? 'bMFN' : 'bNA';
    var stB = row.stock === 'In Stock' ? 'bIS' : row.stock === 'Out of Stock' ? 'bOOS' : row.stock === 'Limited Stock' ? 'bLim' : 'bNA';
    var apB = row.aplus === 'Yes' ? 'bAP' : 'bNA';
    var snsB = (row.sns && row.sns !== 'No' && row.sns !== 'N/A') ? 'bSNS' : 'bNA';
    var hasDeal = row.deal && row.deal !== 'None' && row.deal !== 'N/A';

    var tSh = row.title.length > 35 ? esc(row.title.substring(0, 35)) + '…' : esc(row.title);

    tbody.insertAdjacentHTML('beforeend',
        '<tr>' +
        '<td>' + row.i + '</td>' +
        '<td>' + row.asin + '</td>' +
        '<td>' + tSh + '</td>' +
        '<td>' + esc(row.brand) + '</td>' +
        '<td>' + esc(row.category) + '</td>' +
        '<td>' + esc(row.price) + '</td>' +
        '<td>' + esc(row.mrp) + '</td>' +
        '<td>' + (hasDeal ? row.deal : '—') + '</td>' +
        '<td>' + row.today + '</td>' +
        '</tr>'
    );
}

        document.getElementById('t2Fl').style.width = '100%';
        document.getElementById('t2PT').textContent = 'Done — ' + total + ' ASINs scraped.';
        document.getElementById('t2St').innerHTML = '<div class="maSt maStD">&#10003; ' + pData.length + ' ASINs scraped</div>';
        document.getElementById('t2Ab').style.display = 'flex';
        document.getElementById('t2Rc').textContent = pData.length + ' rows';
        goB.disabled = false; goB.innerHTML = '&#128230; Scrape PDPs';
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
            '#','ASIN','Title','Brand','Category',
            'Price','MRP','Deal','Coupon','Subscribe & Save',
            'Rating','Reviews','Past Bought',
            'Sold By','Other Sellers','Stock Status',
            'Channel','Image Count','A+ Content',
            'Std Delivery','Fast Delivery','Date'
        ]];
        pData.forEach(function (r) {
            rows.push([
                r.i, r.asin, r.title, r.brand, r.category,
                r.price, r.mrp, r.deal, r.coupon, r.sns,
                r.rating, r.reviews, r.pastBought,
                r.soldby, r.otherSellers, r.stock,
                r.ch, r.imageCount, r.aplus,
                r.std, r.fast, r.today
            ]);
        });
        downloadCSV('PDP_Scraper_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    }

    /*
    ================================================================
      INIT
    ================================================================
    */

    function init() {
        injectCSS();
        buildTrackerPanel();
        buildPDPPanel();
        buildLauncher();
        console.log('[MyAssistant v3.1] Ready — Rank Tracker (Pause + Pivot) | PDP Scraper (Pause + clean NA/Not-able-to-fetch logic)');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
