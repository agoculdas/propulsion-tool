// Main App — v1 (safe, polished mission-control)
/* global React, ReactDOM, CONFIGS, BASELINE, buildPID, buildScatter, recalcForDV */

const { useState, useEffect, useMemo, useRef } = React;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const MODE_COLORS = { Mono:'#4fd5ff', Biprop:'#f5b041', Green:'#6ee06a' };

function fmt(n, d=1) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function StatusPill({ status }) {
  const cls = status === 'COTS' ? 'cots' : status === 'Delta' ? 'delta' : 'dev';
  const label = status === 'COTS' ? 'COTS' : status === 'Delta' ? 'Δ-QUAL' : 'DEV';
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

// Three-tier advisory severity: ADVISORY < CAUTION < WARNING.
// Normalizes raw cfg.warnings (which use INFO/CAUTION) and merges derived
// alarms from runtime state (prop fraction, complexity, TWR req).
function buildAdvisories(cfg, recalc, minTWR) {
  const twr = cfg.engine.thrust / Math.max(0.001, recalc.wet * 9.81);
  const adv = [];

  // Propellant margin — same thresholds as master caution/warning lamps
  if (recalc.frac >= 0.90) {
    adv.push({ sev:'WARNING', src:'MARGIN', msg:`Prop fraction ${(recalc.frac*100).toFixed(1)}% ≥ 90% — tyranny of Δv.` });
  } else if (recalc.frac >= 0.80) {
    adv.push({ sev:'CAUTION', src:'MARGIN', msg:`Prop fraction ${(recalc.frac*100).toFixed(1)}% ≥ 80% — low reserve.` });
  }

  // Complexity 5/5
  if (cfg.engine.cx >= 5) {
    adv.push({ sev:'WARNING', src:'COMPLEXITY', msg:`Engine complexity 5/5 — max. New qual path, schedule risk.` });
  } else if (cfg.engine.cx === 4) {
    adv.push({ sev:'CAUTION', src:'COMPLEXITY', msg:`Engine complexity 4/5 — high integration burden.` });
  }

  // Dormant TWR alarm
  if (twr < minTWR) {
    adv.push({ sev:'WARNING', src:'TWR', msg:`Initial T/W ${twr.toFixed(3)} below requirement ${minTWR.toFixed(3)}.` });
  } else if (twr < minTWR * 1.15) {
    adv.push({ sev:'CAUTION', src:'TWR', msg:`Initial T/W ${twr.toFixed(3)} within 15% of requirement.` });
  }

  // Normalize raw warnings authored on the config (INFO → ADVISORY)
  (cfg.warnings || []).forEach(w => {
    const sev = w.sev === 'INFO' ? 'ADVISORY' : (w.sev || 'ADVISORY').toUpperCase();
    adv.push({ sev, src:'CONFIG', msg: w.msg });
  });

  // Sort WARNING → CAUTION → ADVISORY
  const rank = { WARNING: 0, CAUTION: 1, ADVISORY: 2 };
  adv.sort((a,b) => (rank[a.sev]||9) - (rank[b.sev]||9));

  const counts = {
    WARNING: adv.filter(a => a.sev === 'WARNING').length,
    CAUTION: adv.filter(a => a.sev === 'CAUTION').length,
    ADVISORY: adv.filter(a => a.sev === 'ADVISORY').length,
  };
  counts.total = adv.length;
  counts.top = counts.WARNING ? 'WARNING' : counts.CAUTION ? 'CAUTION' : counts.ADVISORY ? 'ADVISORY' : 'NOMINAL';
  return { items: adv, counts, twr };
}

// Live UTC clock — ticks once a second, formatted like "2026-04-18 · 14:32:07Z"
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = n => String(n).padStart(2,'0');
  return `${now.getUTCFullYear()}-${p(now.getUTCMonth()+1)}-${p(now.getUTCDate())} · ${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())}Z`;
}

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────
function Sidebar({ params, setParams, filters, setFilters, dirty, onCommit, onRevert, liveParams, liveFilters }) {
  const toggleMode = m => {
    const next = new Set(filters.modes);
    next.has(m) ? next.delete(m) : next.add(m);
    setFilters({ ...filters, modes: next });
  };
  const toggleFuel = f => {
    const next = new Set(filters.fuels);
    next.has(f) ? next.delete(f) : next.add(f);
    setFilters({ ...filters, fuels: next });
  };

  return (
    <aside className="sidebar">
      <div className="side-section">
        <h3>Command</h3>
        <MasterArm dirty={dirty} onCommit={onCommit} onRevert={onRevert} params={params} liveParams={liveParams} filters={filters} liveFilters={liveFilters}/>
      </div>

      <div className="side-section">
        <h3>Mission Parameters</h3>
        <div className="field">
          <div className="field-label"><span>Dry mass</span><span className="unit">kg</span></div>
          <input type="number" className="num-input" value={params.dryMass}
            onChange={e => setParams({ ...params, dryMass: +e.target.value })}/>
        </div>
        <div className="field">
          <div className="field-label"><span>Delta-V</span><span className="unit">m/s</span></div>
          <input type="number" className="num-input" value={params.deltaV}
            onChange={e => setParams({ ...params, deltaV: +e.target.value })}/>
        </div>
      </div>

      <div className="side-section">
        <h3>Hard Constraints</h3>
        <div style={{marginBottom: 10}}>
          <div className="lbl-tight" style={{marginBottom: 6}}>Mode</div>
          <div className="chip-row">
            {['Mono','Biprop','Green'].map(m => (
              <div key={m} className={`chip ${filters.modes.has(m) ? 'active':''}`} onClick={() => toggleMode(m)}>{m}</div>
            ))}
          </div>
        </div>
        <div style={{marginBottom: 10}}>
          <div className="lbl-tight" style={{marginBottom: 6}}>Fuel</div>
          <div className="chip-row">
            {['N2H4','MMH','LMP-103S'].map(f => (
              <div key={f} className={`chip ${filters.fuels.has(f) ? 'active':''}`} onClick={() => toggleFuel(f)}>{f}</div>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="field-label"><span>Min thrust</span><span className="unit">N</span></div>
          <input type="number" className="num-input" value={filters.minT}
            onChange={e => setFilters({ ...filters, minT: +e.target.value })}/>
        </div>
        <div className="field">
          <div className="field-label"><span>Max thrust</span><span className="unit">N</span></div>
          <input type="number" className="num-input" value={filters.maxT}
            onChange={e => setFilters({ ...filters, maxT: +e.target.value })}/>
        </div>
      </div>

      <div className="side-section">
        <h3>Soft Filters</h3>
        <div style={{marginBottom: 10}}>
          <div className="lbl-tight" style={{marginBottom: 6}}>Heritage</div>
          <div className="chip-row">
            {['COTS only','Incl. Δ-qual','Incl. dev'].map((h,i) => (
              <div key={h} className={`chip ${filters.heritage===i ? 'active':''}`} onClick={() => setFilters({...filters, heritage: i})}>{h}</div>
            ))}
          </div>
        </div>
        <div className="toggle-row">
          <span>Exclude ITAR</span>
          <div className={`toggle ${filters.noItar ? 'on':''}`} onClick={() => setFilters({...filters, noItar: !filters.noItar})}/>
        </div>
        <div className="field" style={{marginTop: 10}}>
          <div className="field-label"><span>Max complexity</span><span className="num" style={{color:'var(--radar)'}}>{filters.maxCx}</span></div>
          <div className="slider-row">
            <input type="range" min="1" max="5" step="1" value={filters.maxCx}
              onChange={e => setFilters({...filters, maxCx: +e.target.value})}/>
          </div>
        </div>
        <div className="field" style={{marginTop: 10}}>
          <div className="field-label"><span>Min TWR (init)</span><span className="num" style={{color:'var(--lock)'}}>{filters.minTWR.toFixed(3)}</span></div>
          <div className="slider-row">
            <span className="num" style={{color:'var(--text-faint)', fontSize:10}}>0</span>
            <input type="range" min="0" max="0.2" step="0.005" value={filters.minTWR}
              onChange={e => setFilters({...filters, minTWR: +e.target.value})}/>
            <span className="num" style={{color:'var(--text-faint)', fontSize:10}}>0.2</span>
          </div>
          <div style={{fontFamily:'var(--font-mono)', fontSize:9.5, color:'var(--text-faint)', letterSpacing:'0.08em', marginTop:4}}>
            DORMANT ALARM IF T/W &lt; REQ
          </div>
        </div>
      </div>

      <div className="side-section">
        <h3>Telemetry</h3>
        <div style={{fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--text-faint)', lineHeight:1.8, letterSpacing:'0.04em'}}>
          <div>DB: 23 engines / 26 tanks</div>
          <div>SOLVER: tsiolkovsky-iterative</div>
          <div>TOL: 1e-4 kg</div>
          <div>RUNTIME: 47 ms</div>
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// MasterArm — red-guarded toggle at the bottom of the sidebar.
// Click the guard to lift it. Click the toggle to commit draft → live.
// State:
//   idle       : guard closed, no pending changes, LED green nominal
//   pending    : guard closed, draft dirty, LED amber blink
//   unguarded  : guard lifted, toggle SAFE (down), waiting for user
//   armed      : toggle thrown UP, commit fires, LED green pulse,
//                then guard auto-closes after 700ms
// ─────────────────────────────────────────────────────────────
function MasterArm({ dirty, onCommit, onRevert, params, liveParams, filters, liveFilters }) {
  const [guardOpen, setGuardOpen] = useState(false);
  const [firing, setFiring] = useState(false);
  const fireTimer = useRef(null);

  // Auto-close guard whenever draft changes (forces re-lift per commit)
  useEffect(() => { setGuardOpen(false); }, [params, filters]);
  // Also close when draft goes clean
  useEffect(() => { if (!dirty && !firing) setGuardOpen(false); }, [dirty, firing]);

  const lift = (e) => { e && e.stopPropagation(); if (firing || !dirty) return; setGuardOpen(true); };
  const close = (e) => { e && e.stopPropagation(); if (firing) return; setGuardOpen(false); };
  const fire = () => {
    if (!guardOpen || firing || !dirty) return;
    setFiring(true);
    onCommit();
    clearTimeout(fireTimer.current);
    fireTimer.current = setTimeout(() => { setFiring(false); setGuardOpen(false); }, 750);
  };

  // Ctrl+Enter — lift and press in one go
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'Enter' && dirty && !firing) {
        e.preventDefault();
        setGuardOpen(true);
        setFiring(true);
        onCommit();
        clearTimeout(fireTimer.current);
        fireTimer.current = setTimeout(() => { setFiring(false); setGuardOpen(false); }, 750);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, firing, onCommit]);

  let status = 'idle';
  if (firing) status = 'firing';
  else if (guardOpen) status = 'unguarded';
  else if (dirty) status = 'pending';

  // Build a compact two-line diff: "LIVE:  dryMass=500, Δv=300"  "DRAFT: dryMass=520, Δv=350 ↑"
  const fmtN = n => (typeof n === 'number' ? (Math.round(n*1000)/1000).toString() : String(n));
  const diffs = [];
  if (liveParams && params) {
    if (liveParams.dryMass !== params.dryMass) diffs.push({k:'DRY', live:liveParams.dryMass, draft:params.dryMass, unit:'kg'});
    if (liveParams.deltaV  !== params.deltaV)  diffs.push({k:'ΔV',  live:liveParams.deltaV,  draft:params.deltaV,  unit:'m/s'});
  }
  if (liveFilters && filters) {
    if (liveFilters.minT !== filters.minT) diffs.push({k:'T-MIN', live:liveFilters.minT, draft:filters.minT, unit:'N'});
    if (liveFilters.maxT !== filters.maxT) diffs.push({k:'T-MAX', live:liveFilters.maxT, draft:filters.maxT, unit:'N'});
    if (liveFilters.maxCx !== filters.maxCx) diffs.push({k:'CX-MAX', live:liveFilters.maxCx, draft:filters.maxCx, unit:''});
    if (liveFilters.minTWR !== filters.minTWR) diffs.push({k:'TWR-MIN', live:liveFilters.minTWR, draft:filters.minTWR, unit:''});
    if (liveFilters.heritage !== filters.heritage) diffs.push({k:'HERITAGE', live:liveFilters.heritage, draft:filters.heritage, unit:''});
    if (liveFilters.noItar !== filters.noItar) diffs.push({k:'ITAR-EXCL', live:liveFilters.noItar?'Y':'N', draft:filters.noItar?'Y':'N', unit:''});
    const eqSet = (a,b) => a.size === b.size && [...a].every(x => b.has(x));
    if (!eqSet(liveFilters.modes, filters.modes)) diffs.push({k:'MODES', live:[...liveFilters.modes].join('/'), draft:[...filters.modes].join('/'), unit:''});
    if (!eqSet(liveFilters.fuels, filters.fuels)) diffs.push({k:'FUELS', live:[...liveFilters.fuels].join('/'), draft:[...filters.fuels].join('/'), unit:''});
  }
  const primaryDiff = diffs[0];
  const extraDiffs = diffs.length - 1;
  const arrow = primaryDiff && typeof primaryDiff.live === 'number' && typeof primaryDiff.draft === 'number'
    ? (primaryDiff.draft > primaryDiff.live ? '↑' : primaryDiff.draft < primaryDiff.live ? '↓' : '')
    : (primaryDiff && primaryDiff.live !== primaryDiff.draft ? '↕' : '');

  return (
    <div className={`master-arm master-arm-${status}`}>
      <div className="ma-plate">
        <div className="ma-plate-top">
          <span className="ma-plate-lbl">ARM / COMMIT</span>
          <span className="ma-plate-sn">CTRL+↵ · SN-04-1129</span>
        </div>

        <div className="ma-pb-row">
          {/* Guarded illuminated pushbutton */}
          <div className={`ma-pb-housing ${guardOpen ? 'guard-open' : 'guard-closed'} ${firing ? 'firing' : ''}`}>
            <button
              className={`ma-pb ma-pb-${status}`}
              onClick={fire}
              disabled={!guardOpen || firing || !dirty}
              aria-label="Commit configuration"
              title={guardOpen ? 'Press to commit' : 'Guard closed'}
            >
              <span className="ma-pb-ring"/>
              <span className="ma-pb-lens">
                <span className="ma-pb-glow"/>
                <span className="ma-pb-label">{firing ? 'LIVE' : 'COMMIT'}</span>
                <span className="ma-pb-gloss"/>
              </span>
            </button>

            {/* Flip-up safety guard */}
            <div
              className={`ma-guard ${guardOpen ? 'open' : 'closed'}`}
              onClick={guardOpen ? close : lift}
              role="button"
              aria-label={guardOpen ? 'Lower guard' : 'Lift guard'}
            >
              <div className="ma-guard-face">
                <div className="ma-guard-chevrons"/>
                <div className="ma-guard-engrave">{dirty ? 'LIFT · COMMIT' : 'NO DRAFT'}</div>
                <div className="ma-guard-screw ma-guard-screw-tl"/>
                <div className="ma-guard-screw ma-guard-screw-tr"/>
                <div className="ma-guard-screw ma-guard-screw-bl"/>
                <div className="ma-guard-screw ma-guard-screw-br"/>
              </div>
              <div className="ma-guard-edge"/>
            </div>
          </div>

          {/* Two-line LIVE / DRAFT diff */}
          <div className="ma-diff">
            {primaryDiff ? (
              <>
                <div className="ma-diff-row live">
                  <span className="ma-diff-tag">LIVE</span>
                  <span className="ma-diff-k">{primaryDiff.k}</span>
                  <span className="ma-diff-v">{fmtN(primaryDiff.live)}<span className="ma-diff-u">{primaryDiff.unit}</span></span>
                </div>
                <div className="ma-diff-row draft">
                  <span className="ma-diff-tag">DRAFT</span>
                  <span className="ma-diff-k">{primaryDiff.k}</span>
                  <span className="ma-diff-v hi">{fmtN(primaryDiff.draft)}<span className="ma-diff-u">{primaryDiff.unit}</span> <span className={`ma-diff-arr ${arrow==='↑'?'up':arrow==='↓'?'down':''}`}>{arrow}</span></span>
                </div>
                {extraDiffs > 0 && <div className="ma-diff-more">+{extraDiffs} MORE CHANGED</div>}
              </>
            ) : (
              <>
                <div className="ma-diff-row live"><span className="ma-diff-tag">LIVE</span><span className="ma-diff-msg">CONFIG COMMITTED</span></div>
                <div className="ma-diff-row draft idle"><span className="ma-diff-tag">DRAFT</span><span className="ma-diff-msg">NO PENDING CHANGES</span></div>
              </>
            )}
          </div>
        </div>

        {/* Status strip */}
        <div className="ma-status">
          <div className={`ma-led ma-led-${status}`}/>
          <div className="ma-status-txt">
            {status === 'idle' && 'CONFIG LIVE · NOMINAL'}
            {status === 'pending' && 'DRAFT · LIFT GUARD OR CTRL+↵'}
            {status === 'unguarded' && 'UNGUARDED · PRESS TO COMMIT'}
            {status === 'firing' && 'ARMED · CONFIG COMMITTED'}
          </div>
          {dirty && !firing && (
            <button className="ma-revert" onClick={onRevert}>REVERT</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Annunciator panel — ONLY the two master lamps. These reflect the
// whole-configuration state; they fire only when the mission itself is
// untenable. Local alarms (complexity, TWR, etc.) do NOT light these.
//   MASTER CAUTION (amber)  : frac >= 0.80
//   MASTER WARNING (red)    : frac >= 0.90
// ─────────────────────────────────────────────────────────────
function Annunciators({ frac, ackd, onReset, onTest, testing }) {
  const cautionActive = frac >= 0.80;
  const warningActive = frac >= 0.90;
  const cautionShow = testing ? 'test' : cautionActive ? (ackd.has('caution') ? 'ack' : 'active') : 'off';
  const warningShow = testing ? 'test' : warningActive ? (ackd.has('warning') ? 'ack' : 'active') : 'off';
  return (
    <div className="annunciator-bay tall">
      <div className="ann-rails"><span/><span/><span/><span/></div>
      <Lamp
        kind="caution"
        state={cautionShow}
        l1="MASTER"
        l2="CAUTION"
        sub={cautionActive ? `PROP FRAC ${(frac*100).toFixed(1)}% ≥ 80%` : 'MARGIN NOMINAL'}
        onClick={cautionActive ? onReset : onTest}
        resetArmed={cautionActive}
      />
      <Lamp
        kind="warning"
        state={warningShow}
        l1="MASTER"
        l2="WARNING"
        sub={warningActive ? `PROP FRAC ${(frac*100).toFixed(1)}% ≥ 90% — TYRANNY OF Δv` : 'BELOW 90% LIMIT'}
        onClick={warningActive ? onReset : onTest}
        resetArmed={warningActive}
      />
    </div>
  );
}

function Lamp({ kind, on, state, l1, l2, sub, onClick, resetArmed }) {
  // Accept either `on` (boolean legacy) or `state` (off | active | ack | test)
  const s = state != null ? state : (on ? 'active' : 'off');
  const onNow = s === 'active' || s === 'test';
  const isButton = typeof onClick === 'function';
  const pressLabel = resetArmed ? 'PUSH TO RESET' : 'PRESS TO TEST';
  const Tag = isButton ? 'button' : 'div';
  const btnProps = isButton
    ? { type: 'button', onClick, 'aria-label': `${l1} ${l2} — ${pressLabel}` }
    : {};
  return (
    <Tag className={`lamp lamp-${kind} state-${s} ${onNow ? 'on' : 'off'} ${isButton ? 'lamp-btn' : ''} ${resetArmed ? 'is-armed' : ''}`} {...btnProps}>
      <div className="lamp-bezel">
        <div className="lamp-lens">
          <div className="lamp-glow"/>
          <div className="lamp-face">
            <div className="lamp-l1">{l1}</div>
            <div className="lamp-l2">{l2}</div>
            {isButton && <div className="lamp-press">{pressLabel}</div>}
          </div>
          <div className="lamp-gloss"/>
          <div className="lamp-screws">
            <span className="scr scr-tl"/><span className="scr scr-tr"/>
            <span className="scr scr-bl"/><span className="scr scr-br"/>
          </div>
          {s === 'ack' && <div className="lamp-ack-chip">ACK</div>}
        </div>
      </div>
      <div className="lamp-sub">{sub}</div>
    </Tag>
  );
}

// Skeuomorphic round chrome pushbutton used on the annunciator panel
// and the CAS header (press-to-test / push-to-reset / ack).
function PressButton({ label, kind, onClick, disabled }) {
  return (
    <button
      className={`press-btn press-btn-${kind} ${disabled ? 'is-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className="pb-ring"/>
      <span className="pb-cap">
        <span className="pb-cap-gloss"/>
        <span className="pb-cap-label">{label}</span>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// CAS list — Crew Alerting System tape. Rows with an illuminated
// glyph (W/C/A), a source code, message, and a sequence index.
// Housed in a ribbed avionics panel to match the skeuomorphic
// master annunciators, but subordinate — these are the LOCAL items.
// ─────────────────────────────────────────────────────────────
function CASList({ advisories, ackedCAS, onResetCAS }) {
  const { items, counts } = advisories;
  const glyph = { WARNING: 'W', CAUTION: 'C', ADVISORY: 'A' };
  const hasAny = items.length > 0;
  const anyUnacked = items.some(w => !ackedCAS.has(`${w.src}:${w.sev}`));
  return (
    <div className="cas-panel">
      <div className="cas-rails"><span/><span/><span/><span/><span/><span/></div>
      <div className="cas-head">
        <span className="cas-head-id">CAS · CREW ALERT LIST</span>
        <span className="cas-head-meta">
          <span className={`cas-pip sev-warning ${counts.WARNING ? 'on':''}`}>W·{counts.WARNING}</span>
          <span className={`cas-pip sev-caution ${counts.CAUTION ? 'on':''}`}>C·{counts.CAUTION}</span>
          <span className={`cas-pip sev-advisory ${counts.ADVISORY ? 'on':''}`}>A·{counts.ADVISORY}</span>
          <PressButton label="PUSH TO RESET" kind="reset cas" onClick={onResetCAS} disabled={!hasAny || !anyUnacked}/>
        </span>
      </div>
      <div className="cas-body">
        {items.length === 0 ? (
          <div className="cas-empty">— NO LOCAL ALERTS —</div>
        ) : (
          items.map((w, i) => {
            const k = `${w.src}:${w.sev}`;
            const acked = ackedCAS.has(k);
            return (
              <div key={i} className={`cas-row sev-${w.sev.toLowerCase()} ${acked ? 'acked' : ''}`}>
                <span className={`cas-glyph sev-${w.sev.toLowerCase()}`}>{glyph[w.sev] || '·'}</span>
                <span className="cas-src">{w.src}</span>
                <span className="cas-msg">{w.msg}</span>
                <span className="cas-seq">{acked ? 'ACK' : String(i+1).padStart(3,'0')}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="cas-screws">
        <span className="scr scr-tl"/><span className="scr scr-tr"/>
        <span className="scr scr-bl"/><span className="scr scr-br"/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero: Top config with P&ID schematic + metrics
// ─────────────────────────────────────────────────────────────
function HeroTopConfig({ cfg, dv, selectedId, setSelectedId, feasible, dryMass, advisories, ackedMaster, onResetMaster, onTestMaster, masterTesting, pinned, togglePin, committedDV }) {
  const recalc = (() => {
    const r = recalcForDV(cfg, dv, dryMass);
    return { ...cfg.budget, dry: dryMass, prop: r.prop, wet: r.wet, frac: r.frac };
  })();
  const wetDelta = recalc.wet - cfg.budget.wet;
  const twr = advisories.twr;
  // Alarm flags for inline metric LEDs
  const fracSev   = advisories.items.find(a => a.src === 'MARGIN')?.sev;
  const cxSev     = advisories.items.find(a => a.src === 'COMPLEXITY')?.sev;
  const twrSev    = advisories.items.find(a => a.src === 'TWR')?.sev;
  const sevClass = sev => sev === 'WARNING' ? 'metric-alarm warning' : sev === 'CAUTION' ? 'metric-alarm caution' : '';

  // Top-2 alternatives — re-rank feasible at the COMMITTED Δv for stability
  const rankedByCommitted = useMemo(() => {
    return feasible.map(c => {
      const r = recalcForDV(c, committedDV, dryMass);
      return { ...c, _committedWet: r.wet };
    }).sort((a,b) => a._committedWet - b._committedWet);
  }, [feasible, committedDV, dryMass]);
  const currentIdx = rankedByCommitted.findIndex(c => c.id === cfg.id);
  const currentCommittedWet = currentIdx >= 0 ? rankedByCommitted[currentIdx]._committedWet : recalc.wet;
  const isOptimal = currentIdx === 0;
  // If current = #1, surface #2 as alternative; else show top 2 (excluding current)
  const top2 = useMemo(() => {
    const picks = [];
    for (const c of rankedByCommitted) {
      if (c.id === cfg.id) continue;
      picks.push(c);
      if (picks.length >= 2) break;
    }
    return picks;
  }, [rankedByCommitted, cfg.id]);
  const scrubberOffset = Math.abs(dv - committedDV) > 0.5;

  return (
    <section style={{marginBottom: 28}}>
      <div className="top-candidate-bar compact">
        <a href={`Schematic.html?cfg=${cfg.id}&from=${encodeURIComponent(location.pathname.split('/').pop())}`} className="schematic-open-btn compact" aria-label="Open detailed schematic">
          <span className="sob-led"/>
          <span className="sob-face">
            <span className="sob-main">OPEN DETAILED DESIGN</span>
            <span className="sob-sub">PID-{cfg.id}-R01</span>
          </span>
          <span className="sob-arrow">▼</span>
        </a>

        <div className="top2-cell">
          <div className="top2-head">
            {isOptimal ? <span className="top2-optimal">★ OPTIMAL · TOP RANKED</span> : <span>TOP ALTERNATIVES {scrubberOffset && <span className="top2-stale">· vs committed Δv {committedDV.toFixed(0)}</span>}</span>}
          </div>
          <div className="top2-list">
            {top2.map((c, i) => {
              const delta = c._committedWet - currentCommittedWet;
              const deltaStr = delta === 0 ? '±0 kg' : (delta > 0 ? '+' : '') + delta.toFixed(1) + ' kg';
              const deltaCls = delta < 0 ? 'down' : delta > 0 ? 'up' : '';
              return (
                <div
                  key={c.id}
                  className="top2-item"
                  onClick={(e) => {
                    if (e.shiftKey) { togglePin(c.id); } else { setSelectedId(c.id); }
                  }}
                  title={`Click to preview · Shift-click to pin`}
                >
                  <span className="top2-rank">#{isOptimal ? i+2 : i+1}</span>
                  <span className="top2-id">{c.id}</span>
                  <span className="top2-eng">{c.engine.mfr.split(' ')[0]} {c.engine.model}</span>
                  <span className="top2-mass">{c._committedWet.toFixed(1)} kg</span>
                  <span className={`top2-delta ${deltaCls}`}>{deltaStr}</span>
                  <button className={`top2-pin ${pinned.has(c.id) ? 'on' : ''}`}
                          onClick={(e) => { e.stopPropagation(); togglePin(c.id); }}
                          title="Pin to Pareto compare">
                    {pinned.has(c.id) ? '●' : '○'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <select value={cfg.id} onChange={e => setSelectedId(e.target.value)} className="top-candidate-picker">
          {feasible.map((c,i) => (
            <option key={c.id} value={c.id}>#{String(i+1).padStart(2,'0')} — {c.engine.mfr} {c.engine.model} · {c.budget.wet.toFixed(1)}kg</option>
          ))}
        </select>
      </div>

      <div className="hero-grid">
        <div className="panel bracket schematic-thumb-panel" style={{overflow:'hidden'}}>
          <span className="br-bl"/><span className="br-br"/>
          <div className="panel-head">
            <span className="ph-id">{cfg.id}</span>
            <span>{cfg.engine.mfr} {cfg.engine.model}</span>
            <span className={`mode-chip ${cfg.engine.mode}`} style={{marginLeft:8}}>{cfg.engine.mode}</span>
            <span className="ph-right">SCHEMATIC · P&amp;ID</span>
          </div>
          <div className="schematic-wrap" dangerouslySetInnerHTML={{__html: buildPID(cfg)}}/>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="panel bracket">
            <span className="br-bl"/><span className="br-br"/>
            <div className="panel-head"><span className="ph-id">KEY METRICS</span><span className="ph-right">Δv = {dv.toFixed(0)} m/s</span></div>
            <div className="hero-metrics">
              <div className="metric">
                <div className="metric-lbl">Wet Mass</div>
                <div className="metric-val accent">{fmt(recalc.wet, 1)}<span className="unit"> kg</span></div>
                <div className="metric-delta">
                  {wetDelta > 0.1 ? <span className="up">▲ +{wetDelta.toFixed(1)} kg</span> :
                   wetDelta < -0.1 ? <span className="down">▼ {wetDelta.toFixed(1)} kg</span> :
                   <span>baseline</span>}
                </div>
              </div>
              <div className="metric">
                <div className="metric-lbl">Propellant</div>
                <div className="metric-val">{fmt(recalc.prop, 1)}<span className="unit"> kg</span></div>
                <div className="metric-delta">{(recalc.prop/recalc.wet*100).toFixed(1)}% of wet</div>
              </div>
              <div className={`metric ${sevClass(fracSev)}`}>
                <div className="metric-lbl">Prop Fraction{fracSev && <span className={`metric-led ${fracSev.toLowerCase()}`}/>}</div>
                <div className="metric-val">{(recalc.frac*100).toFixed(1)}<span className="unit"> %</span></div>
                <div className="metric-delta">of total wet mass</div>
              </div>
              <div className={`metric ${sevClass(twrSev)}`}>
                <div className="metric-lbl">Thrust{twrSev && <span className={`metric-led ${twrSev.toLowerCase()}`}/>}</div>
                <div className="metric-val">{cfg.engine.thrust}<span className="unit"> N</span></div>
                <div className="metric-delta">T/W {twr.toFixed(3)}</div>
              </div>
              <div className="metric">
                <div className="metric-lbl">Isp</div>
                <div className="metric-val">{cfg.engine.isp}<span className="unit"> s</span></div>
                <div className="metric-delta">ve {(cfg.engine.isp*9.80665).toFixed(0)} m/s</div>
              </div>
              <div className={`metric ${sevClass(cxSev)}`}>
                <div className="metric-lbl">Complexity{cxSev && <span className={`metric-led ${cxSev.toLowerCase()}`}/>}</div>
                <div className="metric-val">{cfg.engine.cx}<span className="unit"> / 5</span></div>
                <div className="metric-delta">{cfg.engine.cx <= 2 ? 'low' : cfg.engine.cx <= 3 ? 'moderate' : cfg.engine.cx === 4 ? 'high' : 'maximum'}</div>
              </div>
            </div>
          </div>

          <div className="panel bracket advisory-panel">
            <span className="br-bl"/><span className="br-br"/>
            <div className="panel-head">
              <span className="ph-id">MASTER ANNUNCIATORS</span>
              <span className="ph-right">
                <span className={`adv-count-pill sev-warning ${advisories.counts.WARNING ? 'on':''}`}>W {advisories.counts.WARNING}</span>
                <span className={`adv-count-pill sev-caution ${advisories.counts.CAUTION ? 'on':''}`}>C {advisories.counts.CAUTION}</span>
                <span className={`adv-count-pill sev-advisory ${advisories.counts.ADVISORY ? 'on':''}`}>A {advisories.counts.ADVISORY}</span>
              </span>
            </div>
            <div className="advisory-body">
              <Annunciators frac={recalc.frac} ackd={ackedMaster} onReset={onResetMaster} onTest={onTestMaster} testing={masterTesting}/>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Sensitivity slider strip
// ─────────────────────────────────────────────────────────────
function SensitivityStrip({ cfg, dv, setDV, dryMass, feasible, alarmState, advisories }) {
  const r = recalcForDV(cfg, dv, dryMass);
  // Mass-optimal reference: lightest feasible config re-solved at the current Δv.
  // Delta is (this config - min feasible wet). Positive = heavier than optimum.
  const optimal = useMemo(() => {
    if (!feasible || feasible.length === 0) return null;
    let best = null, bestWet = Infinity;
    for (const c of feasible) {
      const rc = recalcForDV(c, dv, dryMass);
      if (rc.wet < bestWet) { best = c; bestWet = rc.wet; }
    }
    return { cfg: best, wet: bestWet };
  }, [feasible, dv, dryMass]);
  const delta = optimal ? r.wet - optimal.wet : 0;
  const pct = optimal ? (delta / optimal.wet) * 100 : 0;
  const isOptimal = optimal && cfg.id === optimal.cfg.id;
  // Local alarm on the Mass Delta card — purely local:
  //   CAUTION   at ≥ 5 kg over optimum
  //   WARNING   at ≥ 15 kg over optimum
  // Independent of master. (Master = whole-config tyranny of Δv.)
  const localAlarm = isOptimal ? null : delta >= 15 ? 'warning' : delta >= 5 ? 'caution' : null;

  return (
    <div className="slider-card">
      <div>
        <div className="sc-title">Δ-V Sensitivity</div>
        <div className="sc-val">{dv.toFixed(0)}<span className="unit" style={{fontSize:12}}> m/s</span></div>
        <div className="sc-delta">baseline {BASELINE.deltaV} m/s</div>
      </div>
      <div>
        <div className="slider-row" style={{marginBottom:10}}>
          <span className="num" style={{color:'var(--text-faint)', fontSize:10}}>50</span>
          <input type="range" min="50" max="6000" step="25" value={dv} onChange={e => setDV(+e.target.value)}/>
          <span className="num" style={{color:'var(--text-faint)', fontSize:10}}>6000</span>
        </div>
        <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)', textAlign:'center', letterSpacing:'0.1em'}}>
          DRAG TO EXPLORE MISSION ΔV — MASS SCALES VIA TSIOLKOVSKY
        </div>
      </div>
      <div className={`sc-mass-delta ${localAlarm ? `alarm-${localAlarm}` : ''}`}>
        <div className="sc-title">
          vs Mass-Optimal
          {localAlarm && <span className={`metric-led ${localAlarm}`}/>}
        </div>
        <div className="sc-val" style={{color: isOptimal ? 'var(--radar)' : delta > 0 ? 'var(--lock)' : 'var(--text)'}}>
          {isOptimal ? '★ OPTIMAL' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
          {!isOptimal && <span className="unit" style={{fontSize:12}}> kg</span>}
        </div>
        <div className="sc-delta">
          {isOptimal ? (
            <span style={{color:'var(--radar)'}}>this config is mass-optimal</span>
          ) : optimal ? (
            <>
              <span className="up">▲ +{pct.toFixed(1)}%</span>
              &nbsp;·&nbsp;ref {optimal.cfg.id} {optimal.wet.toFixed(1)} kg
            </>
          ) : 'no reference'}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ranked table
// ─────────────────────────────────────────────────────────────
function RankedTable({ configs, selectedId, setSelectedId, pinned, togglePin }) {
  return (
    <div className="table-wrap">
      <table className="trade">
        <thead>
          <tr>
            <th>Pin</th>
            <th></th>
            <th>ID</th>
            <th>Engine</th>
            <th>Mode</th>
            <th className="num-col">T (N)</th>
            <th className="num-col">Isp (s)</th>
            <th className="num-col">Cx</th>
            <th>Fuel tank</th>
            <th>Ox tank</th>
            <th className="num-col">Eng (kg)</th>
            <th className="num-col">Tanks (kg)</th>
            <th className="num-col">Press (kg)</th>
            <th className="num-col">Prop (kg)</th>
            <th className="num-col">Wet (kg)</th>
            <th>Advisories</th>
          </tr>
        </thead>
        <tbody>
          {configs.map(c => {
            const totalTanks = c.budget.fTk + c.budget.oTk;
            return (
              <tr key={c.id}
                  className={`${c.id===selectedId?'selected':''} ${c.pareto?'pareto':''}`}
                  onClick={() => setSelectedId(c.id)}>
                <td className="pin-col">
                  <button className={`pin-btn ${pinned.has(c.id)?'on':''}`}
                          onClick={e => { e.stopPropagation(); togglePin(c.id); }}>
                    {pinned.has(c.id) ? '●' : '○'}
                  </button>
                </td>
                <td className="pareto-col">{c.pareto ? <span className="pareto-star">★</span> : ''}</td>
                <td className="id-col">{c.id}</td>
                <td>
                  {c.engine.mfr} {c.engine.model}
                  {c.engine.itar && <span className="itar-flag">ITAR</span>}
                </td>
                <td><span className={`mode-chip ${c.engine.mode}`}>{c.engine.mode}</span></td>
                <td className="num-col">{c.engine.thrust}</td>
                <td className="num-col">{c.engine.isp}</td>
                <td className="num-col">{c.engine.cx}</td>
                <td style={{fontSize:10.5, color:'var(--text-dim)'}}>{c.fuelTank.mfr.split(' ')[0]} {c.fuelTank.model}</td>
                <td style={{fontSize:10.5, color:'var(--text-dim)'}}>{c.oxTank ? `${c.oxTank.mfr.split(' ')[0]} ${c.oxTank.model}` : '—'}</td>
                <td className="num-col">{c.budget.eng.toFixed(2)}</td>
                <td className="num-col">{totalTanks.toFixed(1)}</td>
                <td className="num-col">{c.budget.prs.toFixed(2)}</td>
                <td className="num-col">{c.budget.prop.toFixed(1)}</td>
                <td className="num-col" style={{color: c.pareto ? 'var(--radar)':'var(--text)', fontWeight:500}}>{c.budget.wet.toFixed(1)}</td>
                <td className="warn-cell">
                  {c.warnings.length === 0 ? <span style={{color:'var(--text-faint)'}}>—</span> :
                   c.warnings.map((w,i) => <div key={i}><span className={`warn-sev ${w.sev}`}>{w.sev}</span>{w.msg}</div>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Compare view: scatter + pinned stacked bars
// ─────────────────────────────────────────────────────────────
function CompareView({ configs, selectedId, setSelectedId, pinned }) {
  const scatterRef = useRef(null);
  useEffect(() => {
    const svgHost = scatterRef.current;
    if (!svgHost) return;
    svgHost.innerHTML = buildScatter(configs, selectedId, pinned);
    // Attach click handlers to .point elements
    svgHost.querySelectorAll('.point').forEach(el => {
      el.addEventListener('click', () => setSelectedId(el.dataset.id));
    });
  }, [configs, selectedId, pinned]);

  const pinnedCfgs = configs.filter(c => pinned.has(c.id)).sort((a,b) => a.budget.wet - b.budget.wet);
  const maxWet = Math.max(...configs.map(c => c.budget.wet), 620);

  return (
    <div>
      <div className="scatter-wrap">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
          <div style={{fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.14em', color:'var(--text-dim)', textTransform:'uppercase'}}>
            Pareto Scatter — Thrust × Wet Mass
          </div>
          <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)', letterSpacing:'0.08em'}}>
            CLICK POINT TO SELECT · ★ = PARETO-OPTIMAL
          </div>
        </div>
        <div ref={scatterRef}/>
        <div className="legend">
          <div className="lg"><span className="sw" style={{background:'#4fd5ff'}}/>Mono</div>
          <div className="lg"><span className="sw" style={{background:'#f5b041'}}/>Biprop</div>
          <div className="lg"><span className="sw" style={{background:'#6ee06a'}}/>Green</div>
          <div className="lg" style={{marginLeft:12}}><span className="sw" style={{background:'transparent', border:'1px dashed #6ee06a'}}/>Pareto frontier</div>
          <div className="lg"><span className="sw" style={{background:'#6ee06a', position:'relative'}}><span style={{position:'absolute', inset:3, background:'#0a0d0f'}}/></span>Pinned</div>
        </div>
      </div>

      {pinnedCfgs.length > 0 && (
        <div style={{marginTop:18}}>
          <div className="section-title" style={{marginBottom:10}}>
            <h2>Pinned Comparison</h2>
            <span className="section-meta">{pinnedCfgs.length} pinned · mass budget stacked</span>
          </div>
          <div className="pin-compare">
            {pinnedCfgs.map(c => {
              const segs = [
                { k:'dry', v: c.budget.dry },
                { k:'eng', v: c.budget.eng },
                { k:'fTk', v: c.budget.fTk },
                { k:'oTk', v: c.budget.oTk },
                { k:'prs', v: c.budget.prs },
                { k:'prop', v: c.budget.prop },
              ];
              return (
                <div key={c.id} className="pin-bar" onClick={() => setSelectedId(c.id)} style={{cursor:'pointer'}}>
                  <div className="pb-lbl">
                    <span className="id-col" style={{color:'var(--text-dim)', marginRight:6}}>{c.id}</span>
                    {c.engine.mfr} {c.engine.model}
                    <div className="sub">{c.engine.mode} · {c.fuelTank.model}{c.oxTank ? ` + ${c.oxTank.model}` : ''}</div>
                  </div>
                  <div className="stack-bar" style={{width: `${(c.budget.wet/maxWet)*100}%`}}>
                    {segs.filter(s=>s.v>0).map((s,i) => (
                      <div key={i} className="stack-seg" data-k={s.k} style={{width: `${(s.v/c.budget.wet)*100}%`}} title={`${s.k}: ${s.v.toFixed(2)} kg`}/>
                    ))}
                  </div>
                  <div className="pb-wet">{c.budget.wet.toFixed(1)} <span className="unit">kg</span></div>
                </div>
              );
            })}
          </div>
          <div className="legend" style={{marginTop:12}}>
            <div className="lg"><span className="sw" style={{background:'#3a434c'}}/>S/C Dry</div>
            <div className="lg"><span className="sw" style={{background:'#4fd5ff'}}/>Engine</div>
            <div className="lg"><span className="sw" style={{background:'#6ee06a'}}/>Fuel Tank</div>
            <div className="lg"><span className="sw" style={{background:'#f5b041'}}/>Ox Tank</div>
            <div className="lg"><span className="sw" style={{background:'#d86ecc'}}/>Pressurant</div>
            <div className="lg"><span className="sw" style={{background:'#8a96a0', opacity:0.55}}/>Propellant</div>
          </div>
        </div>
      )}
      {pinnedCfgs.length === 0 && (
        <div style={{marginTop:18, padding:'24px 20px', border:'1px dashed var(--hairline)', textAlign:'center',
                     fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-dim)', letterSpacing:'0.08em'}}>
          PIN CONFIGURATIONS IN THE RANKED TABLE TO COMPARE MASS BUDGETS HERE
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Component detail tab (expanded breakdown of selected config)
// ─────────────────────────────────────────────────────────────
function DetailView({ cfg }) {
  const rows = [
    ['Manufacturer', cfg.engine.mfr],
    ['Model', cfg.engine.model],
    ['Mode', cfg.engine.mode + (cfg.engine.ox ? ` (${cfg.engine.fuel}/${cfg.engine.ox})` : `/${cfg.engine.fuel || 'N2H4'}`)],
    ['Thrust', `${cfg.engine.thrust} N`],
    ['Isp (vac)', `${cfg.engine.isp} s`],
    ['Dry mass', `${cfg.engine.mass.toFixed(2)} kg`],
    ['Feed pressure', `${cfg.engine.feedP.toFixed(1)} bar`],
    ['Heritage', cfg.engine.heritage],
    ['Status', cfg.engine.status],
    ['Complexity', `${cfg.engine.cx} / 5`],
    ['ITAR / export', cfg.engine.itar ? 'Restricted' : 'Clear'],
  ];
  const tankRows = t => t ? [
    ['Manufacturer', t.mfr],
    ['Model', t.model],
    ['Type', t.type],
    ['Count', `×${t.count}`],
    ['Volume (each)', `${t.volL} L`],
    ['Dry mass (each)', `${t.dry.toFixed(2)} kg`],
    ['MEOP', `${t.meop.toFixed(1)} bar`],
    ['Diameter', `${t.dia} mm`],
    ['Length', `${t.len} mm`],
    ['Material', t.material],
    ['Heritage', t.heritage],
    ['Status', t.status],
  ] : [];

  const pr = cfg.press;
  const prRows = [
    ['Gas', pr.gas],
    ['Storage P', `${pr.storeP} bar`],
    ['Regulated P', `${pr.feedP.toFixed(1)} bar`],
    ['Tank volume', `${pr.tankL.toFixed(1)} L`],
    ['Tank dry mass', `${pr.tankKg.toFixed(2)} kg`],
    ['Gas mass', `${pr.gasKg.toFixed(3)} kg`],
    ['System total', `${pr.totalKg.toFixed(2)} kg`],
  ];

  const Card = ({title, color, model, rows}) => (
    <div className="comp-card">
      <h4><span className="dot-sq" style={{background:color}}/>{title}</h4>
      <div className="comp-model">{model}</div>
      {rows.map(([k,v]) => (
        <div key={k} className="comp-row"><span>{k}</span><span className="v">{v}</span></div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="section-title" style={{marginBottom:10}}>
        <h2>Component Breakdown</h2>
        <span className="section-meta">{cfg.id} · {cfg.engine.mfr} {cfg.engine.model}</span>
      </div>
      <div className="comp-grid">
        <Card title="Engine" color="#4fd5ff" model={`${cfg.engine.mfr} ${cfg.engine.model}`} rows={rows}/>
        <Card title="Fuel Tank" color="#6ee06a" model={`${cfg.fuelTank.mfr} ${cfg.fuelTank.model}`} rows={tankRows(cfg.fuelTank)}/>
        {cfg.oxTank && <Card title="Oxidizer Tank" color="#f5b041" model={`${cfg.oxTank.mfr} ${cfg.oxTank.model}`} rows={tankRows(cfg.oxTank)}/>}
        <Card title="Pressurant" color="#d86ecc" model={`${pr.gas} @ ${pr.storeP} bar`} rows={prRows}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────
function App() {
  // "draft" state = sidebar inputs. "live" state = what the main view uses.
  // The master-arm switch at the bottom of the sidebar commits draft → live.
  const [draftParams, setDraftParams] = useState({ dryMass: 500, deltaV: 300 });
  const [draftFilters, setDraftFilters] = useState({
    modes: new Set(['Mono','Biprop','Green']),
    fuels: new Set(['N2H4','MMH','LMP-103S']),
    minT: 0, maxT: 10000, heritage: 1, noItar: false, maxCx: 5,
    minTWR: 0.040,
  });
  const [params, setLiveParams] = useState(draftParams);
  const [filters, setLiveFilters] = useState(draftFilters);

  // Dirty check — any draft field differs from live?
  const dirty = useMemo(() => {
    if (draftParams.dryMass !== params.dryMass) return true;
    if (draftParams.deltaV !== params.deltaV) return true;
    const f = draftFilters, g = filters;
    if (f.minT !== g.minT || f.maxT !== g.maxT) return true;
    if (f.heritage !== g.heritage) return true;
    if (f.noItar !== g.noItar) return true;
    if (f.maxCx !== g.maxCx) return true;
    if (f.minTWR !== g.minTWR) return true;
    const eqSet = (a,b) => a.size === b.size && [...a].every(x => b.has(x));
    if (!eqSet(f.modes, g.modes)) return true;
    if (!eqSet(f.fuels, g.fuels)) return true;
    return false;
  }, [draftParams, draftFilters, params, filters]);

  const commit = () => {
    setLiveParams(draftParams);
    setLiveFilters({ ...draftFilters, modes: new Set(draftFilters.modes), fuels: new Set(draftFilters.fuels) });
  };
  const revert = () => {
    setDraftParams(params);
    setDraftFilters({ ...filters, modes: new Set(filters.modes), fuels: new Set(filters.fuels) });
  };

  const [dv, setDV] = useState(300);
  // Sidebar ΔV → sensitivity slider baseline (applied on commit)
  useEffect(() => { setDV(params.deltaV); }, [params.deltaV]);
  const [tab, setTab] = useState('ranked'); // ranked | compare | detail
  const [pinned, setPinned] = useState(() => {
    try { const s = localStorage.getItem('pinned-v1'); return new Set(s ? JSON.parse(s) : ['C01','C03','C05']); }
    catch { return new Set(['C01','C03','C05']); }
  });

  useEffect(() => { try { localStorage.setItem('pinned-v1', JSON.stringify([...pinned])); } catch {} }, [pinned]);

  // Mode → default fuel mapping used by the fuel-filter chips
  const fuelForMode = { Mono: 'N2H4', Biprop: 'MMH', Green: 'LMP-103S' };

  const feasible = useMemo(() => {
    return CONFIGS.map(c => {
      // recompute budget so sidebar dryMass + deltaV actually flow through
      const r = recalcForDV(c, params.deltaV, params.dryMass);
      return { ...c, budget: { ...c.budget, dry: params.dryMass, prop: r.prop, wet: r.wet, frac: r.frac } };
    }).filter(c => {
      if (!filters.modes.has(c.engine.mode)) return false;
      if (!filters.fuels.has(fuelForMode[c.engine.mode])) return false;
      if (c.engine.thrust < filters.minT || c.engine.thrust > filters.maxT) return false;
      if (filters.heritage === 0 && c.engine.status !== 'COTS') return false;
      if (filters.heritage === 1 && c.engine.status === 'Dev') return false;
      if (filters.noItar && c.engine.itar) return false;
      if (c.engine.cx > filters.maxCx) return false;
      return true;
    }).sort((a,b) => a.budget.wet - b.budget.wet);
  }, [filters, params.dryMass, params.deltaV]);

  const [selectedId, setSelectedIdRaw] = useState(() => {
    try { return localStorage.getItem('selected-v1') || 'C01'; } catch { return 'C01'; }
  });
  const setSelectedId = id => { setSelectedIdRaw(id); try { localStorage.setItem('selected-v1', id); } catch {} };

  // Ensure selected is in feasible
  useEffect(() => {
    if (feasible.length && !feasible.find(c => c.id === selectedId)) {
      setSelectedId(feasible[0].id);
    }
  }, [feasible, selectedId]);

  const selectedCfg = feasible.find(c => c.id === selectedId) || feasible[0] || CONFIGS[0];

  // Master alarm state — drives UI-wide amber/red propagation. Now reflects
  // the full advisory tree (prop fraction + complexity + dormant TWR) rather
  // than just prop fraction.
  const selectedRecalc = useMemo(() => {
    return { ...selectedCfg.budget, ...recalcForDV(selectedCfg, dv, params.dryMass) };
  }, [selectedCfg, dv, params.dryMass]);
  const advisories = useMemo(
    () => buildAdvisories(selectedCfg, selectedRecalc, params.minTWR ?? filters.minTWR),
    [selectedCfg, selectedRecalc, filters.minTWR]
  );
  // Master alarms track only the propellant-fraction — whole-configuration
  // severity. Local alarms (complexity, TWR, etc.) exist per-metric and do
  // NOT escalate the master lamps or the body-level alarm state.
  const alarmState =
    selectedRecalc.frac >= 0.90 ? 'warning' :
    selectedRecalc.frac >= 0.80 ? 'caution' : 'nominal';
  useEffect(() => {
    const b = document.body;
    b.classList.remove('alarm-caution', 'alarm-warning');
    if (alarmState === 'caution') b.classList.add('alarm-caution');
    if (alarmState === 'warning') b.classList.add('alarm-warning');
  }, [alarmState]);

  // ── Acknowledge / reset state for both panels ─────────────────
  // Master lamps: a set of which severities are currently acked.
  // When a lamp goes from OFF→ON, its ack clears automatically so a fresh
  // event re-fires the flash. Press TEST to briefly light both lamps.
  const [ackedMaster, setAckedMaster] = useState(() => new Set());
  const prevAlarmRef = useRef(alarmState);
  useEffect(() => {
    const prev = prevAlarmRef.current;
    if (prev !== alarmState) {
      // Any rising edge clears its own ack so the lamp flashes anew.
      if (alarmState !== 'nominal' && prev !== alarmState) {
        const next = new Set(ackedMaster);
        next.delete(alarmState);
        setAckedMaster(next);
      }
    }
    prevAlarmRef.current = alarmState;
  }, [alarmState]);
  const [masterTesting, setMasterTesting] = useState(false);
  const testMaster = () => {
    setMasterTesting(true);
    setTimeout(() => setMasterTesting(false), 900);
  };
  const resetMaster = () => {
    // Latch ack for whichever severity is currently active.
    const next = new Set(ackedMaster);
    if (selectedRecalc.frac >= 0.80) next.add('caution');
    if (selectedRecalc.frac >= 0.90) next.add('warning');
    setAckedMaster(next);
  };

  // CAS: a set of 'SRC:SEV' keys that have been acknowledged. Cleared when
  // the item drops off or re-fires (exits then re-enters the advisory set).
  const [ackedCAS, setAckedCAS] = useState(() => new Set());
  const prevCASKeysRef = useRef(new Set());
  useEffect(() => {
    const cur = new Set(advisories.items.map(a => `${a.src}:${a.sev}`));
    const prev = prevCASKeysRef.current;
    // Remove acks for items no longer present (drop off = natural clear)
    let changed = false;
    const next = new Set(ackedCAS);
    for (const k of ackedCAS) {
      if (!cur.has(k)) { next.delete(k); changed = true; }
    }
    if (changed) setAckedCAS(next);
    prevCASKeysRef.current = cur;
  }, [advisories]);
  const resetCAS = () => {
    setAckedCAS(new Set(advisories.items.map(a => `${a.src}:${a.sev}`)));
  };

  const togglePin = id => {
    const next = new Set(pinned);
    next.has(id) ? next.delete(id) : next.add(id);
    setPinned(next);
  };

  const clock = useClock();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark"/>
          <span>Propulsion Trade Tool</span>
          <span className="brand-sub">· {window.MARK_BLOCK || 'MK 1 BLK 1'} — mission-control</span>
        </div>
        <div className="topbar-meta">
          <span className={`solver-pill solver-${alarmState}`}><span className="dot"></span> {alarmState === 'warning' ? 'MASTER WARNING' : alarmState === 'caution' ? 'MASTER CAUTION' : 'SYSTEM NOMINAL'}</span>
          <span>MISSION · {params.dryMass}kg · Δv {dv.toFixed(0)}m/s</span>
          <span>CONFIGS · {feasible.length}/{CONFIGS.length}</span>
          <span>PINNED · {pinned.size}</span>
          <span className="topbar-clock"><span className="clock-dot"/>{clock}</span>
        </div>
      </header>

      <div className="layout">
        <Sidebar
          params={draftParams} setParams={setDraftParams}
          filters={draftFilters} setFilters={setDraftFilters}
          liveParams={params} liveFilters={filters}
          dirty={dirty} onCommit={commit} onRevert={revert}
        />

        <main className="main">
          {feasible.length === 0 ? (
            <div style={{padding:40, textAlign:'center', fontFamily:'var(--font-mono)', color:'var(--text-dim)'}}>
              <div style={{color:'var(--lock)', fontSize:14, letterSpacing:'0.14em', marginBottom:10}}>NO FEASIBLE CONFIGURATIONS</div>
              <div style={{fontSize:11}}>Relax constraints in the left panel to see candidates.</div>
            </div>
          ) : (
            <>
              <HeroTopConfig
                cfg={selectedCfg} dv={dv}
                selectedId={selectedId} setSelectedId={setSelectedId}
                feasible={feasible} dryMass={params.dryMass}
                advisories={advisories}
                ackedMaster={ackedMaster}
                onResetMaster={resetMaster}
                onTestMaster={testMaster}
                masterTesting={masterTesting}
                pinned={pinned}
                togglePin={togglePin}
                committedDV={params.deltaV}
              />

              <CASList advisories={advisories} ackedCAS={ackedCAS} onResetCAS={resetCAS}/>

              <SensitivityStrip cfg={selectedCfg} dv={dv} setDV={setDV} dryMass={params.dryMass} feasible={feasible} alarmState={alarmState} advisories={advisories} minTWR={filters.minTWR}/>

              <div className="tabs">
                <div className={`tab ${tab==='ranked'?'active':''}`} onClick={()=>setTab('ranked')}>Ranked Trade <span className="tab-count">{feasible.length}</span></div>
                <div className={`tab ${tab==='compare'?'active':''}`} onClick={()=>setTab('compare')}>Pareto &amp; Compare <span className="tab-count">{pinned.size}</span></div>
                <div className={`tab ${tab==='detail'?'active':''}`} onClick={()=>setTab('detail')}>Detail</div>
              </div>

              {tab === 'ranked' && <RankedTable configs={feasible} selectedId={selectedId} setSelectedId={setSelectedId} pinned={pinned} togglePin={togglePin}/>}
              {tab === 'compare' && <CompareView configs={feasible} selectedId={selectedId} setSelectedId={setSelectedId} pinned={pinned}/>}
              {tab === 'detail' && <DetailView cfg={selectedCfg}/>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
