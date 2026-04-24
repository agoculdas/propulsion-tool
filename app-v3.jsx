// Mk 3 BLK 1 — Analogue 70s Propulsion Trade
/* global React, ReactDOM, CONFIGS, BASELINE, buildPID, recalcForDV, solveMission */

const { useState, useEffect, useMemo, useRef } = React;

// ─── Helpers ────────────────────────────────────────────────────────
function fmt(n, d=1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Build advisory tree (copied structure from v2)
function buildAdvisories(cfg, recalc, minTWR) {
  const twr = cfg.engine.thrust / Math.max(0.001, recalc.wet * 9.81);
  const adv = [];
  if (recalc.frac >= 0.90)      adv.push({ sev:'WARNING', src:'MARGIN',     code:'W-MRG', msg:`Prop fraction ${(recalc.frac*100).toFixed(1)}% ≥ 90% — tyranny of Δv.` });
  else if (recalc.frac >= 0.80) adv.push({ sev:'CAUTION', src:'MARGIN',     code:'C-MRG', msg:`Prop fraction ${(recalc.frac*100).toFixed(1)}% ≥ 80% — low reserve.` });
  if (cfg.engine.cx >= 5)       adv.push({ sev:'WARNING', src:'COMPLEXITY', code:'W-CX5', msg:`Engine complexity 5/5 — max. New qual path.` });
  else if (cfg.engine.cx === 4) adv.push({ sev:'CAUTION', src:'COMPLEXITY', code:'C-CX4', msg:`Engine complexity 4/5 — high integration burden.` });
  if (twr < minTWR)             adv.push({ sev:'WARNING', src:'TWR',        code:'W-TWR', msg:`T/W ${twr.toFixed(3)} below required ${minTWR.toFixed(3)}.` });
  else if (twr < minTWR * 1.15) adv.push({ sev:'CAUTION', src:'TWR',        code:'C-TWR', msg:`T/W ${twr.toFixed(3)} within 15% of minimum.` });
  (cfg.warnings || []).forEach((w,i) => {
    const sev = w.sev === 'INFO' ? 'ADVISORY' : (w.sev || 'ADVISORY').toUpperCase();
    adv.push({ sev, src:'CONFIG', code:`A-C${i+1}`, msg: w.msg });
  });
  const rank = { WARNING:0, CAUTION:1, ADVISORY:2 };
  adv.sort((a,b) => (rank[a.sev]||9) - (rank[b.sev]||9));
  const counts = {
    WARNING: adv.filter(a=>a.sev==='WARNING').length,
    CAUTION: adv.filter(a=>a.sev==='CAUTION').length,
    ADVISORY: adv.filter(a=>a.sev==='ADVISORY').length,
  };
  return { items: adv, counts, twr };
}

// ─── Nixie-tube readout ─────────────────────────────────────────────
// Shows N digits + optional decimal. Unused leading digits go "dim" (glow off)
// mimicking a real Nixie bank. Value changes trigger a brief flicker.
function NixieReadout({ value, digits = 4, decimals = 0, minDisplay }) {
  const [flickerKey, setFlickerKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      setFlickerKey(k => k + 1);
      prev.current = value;
    }
  }, [value]);

  // Format value into a fixed-width digit string
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const str = decimals > 0 ? abs.toFixed(decimals) : Math.round(abs).toString();
  const [intPart, decPart = ''] = str.split('.');
  const intWidth = digits - decimals;
  const padded = intPart.padStart(intWidth, ' ');
  // Build cells: int digits, optional dot, then decimal digits
  const cells = [];
  for (let i = 0; i < padded.length; i++) {
    const ch = padded[i];
    const isBlank = ch === ' ';
    // Blank leading digits stay dim (show 0 dim) except when the whole value is 0
    cells.push({ kind:'digit', ch: isBlank ? '0' : ch, dim: isBlank });
  }
  if (decimals > 0) cells.push({ kind:'dot', ch: '.' });
  for (let i = 0; i < decimals; i++) {
    cells.push({ kind:'digit', ch: decPart[i] || '0' });
  }

  return (
    <span className="mk3-nixie-window" aria-label={sign + str}>
      {cells.map((c, i) => (
        <span
          key={i}
          className={`mk3-tube ${c.kind === 'dot' ? 'dot' : ''} ${c.dim ? 'dim' : ''} flicker`}
          style={{ animationDelay: `${i * 15}ms` }}
          data-flicker={flickerKey}
        >
          <span className="mk3-tube-digit">{c.ch}</span>
        </span>
      ))}
    </span>
  );
}

// ─── Metric with Nixie readout + silkscreen + alarm LED ─────────────
function NixieMetric({ label, value, unit, digits, decimals, sub, sev }) {
  const sevClass = sev === 'WARNING' ? 'warning' : sev === 'CAUTION' ? 'caution' : '';
  return (
    <div className={`mk3-metric ${sevClass}`}>
      <div className="mk3-metric-lbl">
        <span>{label}</span>
        {sev && <span className="mk3-metric-led"/>}
      </div>
      <div className="mk3-readout">
        <NixieReadout value={value} digits={digits} decimals={decimals}/>
        <span className="mk3-readout-unit">{unit}</span>
      </div>
      {sub && <div className="mk3-metric-delta">{sub}</div>}
    </div>
  );
}

// ─── Master lamp (CAUTION / WARNING) — Apollo cue card style ────────
function MasterLamp({ kind, active, acked, sub, onClick }) {
  return (
    <button
      className={`mk3-master ${active ? 'active' : ''} ${acked ? 'acked' : ''} ${kind}`}
      onClick={onClick}
      type="button"
    >
      <div className="mk3-master-head">
        <span className="mk3-master-tag">{kind === 'warning' ? 'SYS-W' : 'SYS-C'}</span>
        <span className="mk3-master-state">{active ? (acked ? 'ACKED' : 'TRIGGERED') : 'NOMINAL'}</span>
      </div>
      <div className="mk3-master-lens">
        <span className="mk3-master-rivet tl"/>
        <span className="mk3-master-rivet tr"/>
        <span className="mk3-master-rivet bl"/>
        <span className="mk3-master-rivet br"/>
        <div className="mk3-master-l1">MASTER</div>
        <div className="mk3-master-l2">{kind.toUpperCase()}</div>
      </div>
      <div className="mk3-master-sub">{sub}</div>
      <div className="mk3-master-foot">
        <span className="mk3-master-press">{active ? (acked ? 'ACKNOWLEDGED' : 'PUSH TO ACK') : 'PRESS TO TEST'}</span>
      </div>
    </button>
  );
}

// ─── Cue-card matrix of lamps (one per advisory item) ───────────────
// Fills a 4×4 grid (16 cells). Unused cells render dark + engraved with
// ─── Fixed annunciator catalog ─────────────────────────────────────
// Every possible alert has a dedicated lamp. All lamps are always visible;
// unused ones sit dim/gray. When an advisory fires, the matching lamp lights
// at its severity color and picks up a tooltip with the full message.
//
// `match(adv)` returns the active advisory for that slot (or undefined).
// A slot with no match renders dim in its designed severity color.
const CUE_CATALOG = [
  { code:'MRG',   src:'MARGIN',   sev:'caution', label:'PROP FRAC ≥ 80%',
    match: (a) => a.find(x => x.code === 'C-MRG') },
  { code:'MRG!',  src:'MARGIN',   sev:'warning', label:'PROP FRAC ≥ 90%',
    match: (a) => a.find(x => x.code === 'W-MRG') },
  { code:'CX4',   src:'CMPLX',    sev:'caution', label:'ENGINE CX 4/5',
    match: (a) => a.find(x => x.code === 'C-CX4') },
  { code:'CX5',   src:'CMPLX',    sev:'warning', label:'ENGINE CX 5/5',
    match: (a) => a.find(x => x.code === 'W-CX5') },
  { code:'TWR',   src:'TWR',      sev:'caution', label:'T/W WITHIN 15%',
    match: (a) => a.find(x => x.code === 'C-TWR') },
  { code:'TWR!',  src:'TWR',      sev:'warning', label:'T/W BELOW MIN',
    match: (a) => a.find(x => x.code === 'W-TWR') },
  { code:'CFG',   src:'CONFIG',   sev:'advisory', label:'CONFIG NOTES',
    match: (a) => a.find(x => x.src === 'CONFIG') },
];

function CueMatrix({ advisories }) {
  return (
    <div className="mk3-cue">
      {CUE_CATALOG.map((slot, i) => {
        const hit = slot.match(advisories.items);
        const on = !!hit;
        return (
          <div key={i}
               className={`mk3-cue-lamp ${on ? 'on' : ''} ${slot.sev}`}
               title={hit ? `${hit.sev} · ${hit.src} — ${hit.msg}` : `${slot.src} — ${slot.label} (clear)`}>
            <div className="mk3-cue-glass"/>
            <div className="mk3-cue-code">{slot.code}</div>
            <div className="mk3-cue-src">{slot.src}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Vellum schematic thumb ─────────────────────────────────────────
function VellumThumb({ cfg, revision='R01' }) {
  const today = '24 APR 26';
  return (
    <div className="mk3-vellum">
      <span className="mk3-grommet tl"/>
      <span className="mk3-grommet tr"/>
      <div dangerouslySetInnerHTML={{__html: buildPID(cfg)}}/>
      <div className="mk3-margin-note" style={{top: 24, right: 80}}>see Rev. {revision}</div>
      <div className="mk3-titleblock">
        <div><div className="lbl">Dwg No.</div><div className="val">{cfg.id}-PID</div></div>
        <div><div className="lbl">Rev.</div><div className="val">{revision}</div></div>
        <div className="full"><div className="lbl">Title</div><div className="val">{cfg.engine.mfr.split(' ')[0]} {cfg.engine.model} — P&amp;ID</div></div>
        <div><div className="lbl">Drawn</div><div className="val">A.G.C.</div></div>
        <div><div className="lbl">Date</div><div className="val">{today}</div></div>
      </div>
    </div>
  );
}

// ─── OPEN DETAILED DESIGN button (red-capped guarded pushbutton) ────
function PidOpenButton({ cfg, dryMass, dv }) {
  const href = `Schematic.html?cfg=${cfg.id}&dry=${dryMass}&dv=${dv}&from=${encodeURIComponent(location.pathname.split('/').pop())}`;
  return (
    <a href={href} className="mk3-pid-btn" aria-label="Open detailed schematic">
      <span className="mk3-pid-lamp">
        <span className="mk3-pid-cap"/>
        <span className="mk3-pid-cage" aria-hidden="true">
          {/* Wire-basket guard seen TOP-DOWN — hub + two concentric rings + 6 radial bars */}
          <svg viewBox="0 0 48 48">
            <defs>
              <linearGradient id="pidWire" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3a332a"/>
                <stop offset="0.5" stopColor="#14110d"/>
                <stop offset="1" stopColor="#3a332a"/>
              </linearGradient>
            </defs>
            {/* outer mounting ring — the rivet collar */}
            <circle cx="24" cy="24" r="22" fill="none" stroke="#08060500" strokeWidth="0"/>
            <circle cx="24" cy="24" r="21" fill="none" stroke="#0a0908" strokeWidth="2.2"/>
            <circle cx="24" cy="24" r="21" fill="none" stroke="url(#pidWire)" strokeWidth="1.3"/>
            {/* inner ring */}
            <circle cx="24" cy="24" r="11" fill="none" stroke="#0a0908" strokeWidth="1.8"/>
            <circle cx="24" cy="24" r="11" fill="none" stroke="url(#pidWire)" strokeWidth="1"/>
            {/* six radial bars from outer to inner ring, then tiny stubs to center hub */}
            {[0, 60, 120, 180, 240, 300].map(a => {
              const rad = a * Math.PI / 180;
              const x1 = 24 + Math.cos(rad) * 21;
              const y1 = 24 + Math.sin(rad) * 21;
              const x2 = 24 + Math.cos(rad) * 4;
              const y2 = 24 + Math.sin(rad) * 4;
              return (
                <g key={a}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0a0908" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#pidWire)" strokeWidth="1" strokeLinecap="round"/>
                </g>
              );
            })}
            {/* central hub nut — where the bars converge */}
            <circle cx="24" cy="24" r="3.2" fill="#1a1714" stroke="#0a0908" strokeWidth="0.8"/>
            <circle cx="24" cy="24" r="3.2" fill="none" stroke="#4a4238" strokeWidth="0.6"/>
            {/* tiny highlight on hub */}
            <circle cx="23" cy="23" r="0.8" fill="rgba(255,245,220,0.25)"/>
          </svg>
        </span>
      </span>
      <span className="mk3-pid-face">
        <span className="mk3-pid-main">PID · OPEN</span>
        <span className="mk3-pid-sub">{cfg.id}-R01 DETAILED</span>
      </span>
    </a>
  );
}

// ─── Switch / rocker ────────────────────────────────────────────────
function RockerSwitch({ label, on, onToggle }) {
  return (
    <div className={`mk3-switch ${on ? 'on' : ''}`} onClick={onToggle}>
      <div className="mk3-switch-led"/>
      <div className="mk3-switch-label">{label}</div>
    </div>
  );
}
function BooleanRocker({ label, on, onToggle }) {
  return (
    <div className={`mk3-rocker ${on ? 'on' : ''}`}>
      <span className="mk3-rocker-lbl">{label}</span>
      <div className="mk3-rocker-sw" onClick={onToggle}>
        <div className="mk3-rocker-bat"/>
      </div>
    </div>
  );
}

// ─── Sidebar (patch-panel) ──────────────────────────────────────────
function Sidebar({ draftParams, setDraftParams, draftFilters, setDraftFilters, liveParams, liveFilters, dirty, onCommit, onRevert, solverMeta }) {
  const toggleMode = m => { const n = new Set(draftFilters.modes); n.has(m) ? n.delete(m) : n.add(m); setDraftFilters({...draftFilters, modes:n}); };
  const toggleFuel = f => { const n = new Set(draftFilters.fuels); n.has(f) ? n.delete(f) : n.add(f); setDraftFilters({...draftFilters, fuels:n}); };

  return (
    <aside className="mk3-sidebar">
      <div className="mk3-side-unit mk3-steel">
        <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
        <div className="mk3-dymo"><span>COMMAND · ARM</span><span className="mk3-dymo-sub">BAY-00</span></div>
        <MasterArm dirty={dirty} onCommit={onCommit} onRevert={onRevert}
                   liveParams={liveParams} draftParams={draftParams}
                   liveFilters={liveFilters} draftFilters={draftFilters}/>
      </div>

      <div className="mk3-side-unit mk3-steel">
        <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
        <div className="mk3-dymo"><span>MISSION INPUT</span><span className="mk3-dymo-sub">BAY-01</span></div>

        <div className="mk3-field">
          <div className="mk3-field-head">
            <span className="mk3-field-lbl">Dry Mass</span>
            <span className="mk3-field-unit">KG</span>
          </div>
          <input type="number" className="mk3-numinput" value={draftParams.dryMass}
            onChange={e => setDraftParams({ ...draftParams, dryMass: +e.target.value })}/>
        </div>

        <div className="mk3-field">
          <div className="mk3-field-head">
            <span className="mk3-field-lbl">Δ-V</span>
            <span className="mk3-field-unit">M/S</span>
          </div>
          <input type="number" className="mk3-numinput" value={draftParams.deltaV}
            onChange={e => setDraftParams({ ...draftParams, deltaV: +e.target.value })}/>
        </div>
      </div>

      <div className="mk3-side-unit mk3-steel">
        <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
        <div className="mk3-dymo"><span>HARD CONSTRAINTS</span><span className="mk3-dymo-sub">BAY-02</span></div>

        <div className="mk3-field-lbl" style={{marginBottom:6}}>PROP MODE</div>
        <div className="mk3-switchbank">
          {['Mono','Biprop','Green'].map(m => (
            <RockerSwitch key={m} label={m} on={draftFilters.modes.has(m)} onToggle={() => toggleMode(m)}/>
          ))}
        </div>

        <div className="mk3-field-lbl" style={{marginBottom:6, marginTop:10}}>FUEL</div>
        <div className="mk3-switchbank">
          {['N2H4','MMH','LMP-103S'].map(f => (
            <RockerSwitch key={f} label={f} on={draftFilters.fuels.has(f)} onToggle={() => toggleFuel(f)}/>
          ))}
        </div>

        <div className="mk3-field" style={{marginTop:12}}>
          <div className="mk3-field-head"><span className="mk3-field-lbl">Thrust Min</span><span className="mk3-field-unit">N</span></div>
          <input type="number" className="mk3-numinput" value={draftFilters.minT}
            onChange={e => setDraftFilters({...draftFilters, minT:+e.target.value})}/>
        </div>
        <div className="mk3-field">
          <div className="mk3-field-head"><span className="mk3-field-lbl">Thrust Max</span><span className="mk3-field-unit">N</span></div>
          <input type="number" className="mk3-numinput" value={draftFilters.maxT}
            onChange={e => setDraftFilters({...draftFilters, maxT:+e.target.value})}/>
        </div>
      </div>

      <div className="mk3-side-unit mk3-steel">
        <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
        <div className="mk3-dymo"><span>SOFT FILTERS</span><span className="mk3-dymo-sub">BAY-03</span></div>

        <div className="mk3-field-lbl" style={{marginBottom:6}}>HERITAGE</div>
        <div className="mk3-switchbank">
          {['COTS only','Incl. Δ-qual','Incl. dev'].map((h,i) => (
            <RockerSwitch key={h} label={h} on={draftFilters.heritage===i} onToggle={() => setDraftFilters({...draftFilters, heritage:i})}/>
          ))}
        </div>

        <BooleanRocker label="Exclude ITAR" on={draftFilters.noItar} onToggle={() => setDraftFilters({...draftFilters, noItar:!draftFilters.noItar})}/>

        <div className="mk3-slider-field">
          <div className="mk3-slider-head">
            <span className="mk3-field-lbl">MAX CX</span>
            <span className="mk3-slider-val">{draftFilters.maxCx}</span>
          </div>
          <input type="range" min="1" max="5" step="1" className="mk3-range"
            value={draftFilters.maxCx}
            onChange={e => setDraftFilters({...draftFilters, maxCx:+e.target.value})}/>
        </div>

        <div className="mk3-slider-field">
          <div className="mk3-slider-head">
            <span className="mk3-field-lbl">MIN T/W</span>
            <span className="mk3-slider-val">{draftFilters.minTWR.toFixed(3)}</span>
          </div>
          <input type="range" min="0" max="0.2" step="0.005" className="mk3-range"
            value={draftFilters.minTWR}
            onChange={e => setDraftFilters({...draftFilters, minTWR:+e.target.value})}/>
          <div className="mk3-slider-caption">DORMANT ALARM IF T/W &lt; REQ</div>
        </div>
      </div>

      <div className="mk3-side-unit mk3-steel">
        <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
        <div className="mk3-dymo"><span>TELEMETRY</span><span className="mk3-dymo-sub">BAY-05</span></div>
        <div className="mk3-telem">
          <div><span className="k">DB · </span><span className="v">{solverMeta ? solverMeta.totalCandidates : '—'}</span> engines</div>
          <div><span className="k">FEASIBLE · </span><span className="v">{solverMeta ? `${solverMeta.feasibleCount}/${solverMeta.filteredCount}` : '—'}</span></div>
          <div><span className="k">CONVERGED · </span><span className="v">{solverMeta ? `${solverMeta.convergedCount}/${solverMeta.feasibleCount}` : '—'}</span></div>
          <div><span className="k">RUNTIME · </span><span className="v">{solverMeta ? solverMeta.runtimeMs.toFixed(1) : '—'} ms</span></div>
          <div><span className="k">TOL · </span><span className="v">1e-2 kg</span></div>
        </div>
      </div>
    </aside>
  );
}

// ─── Master Arm — re-skinned lever ─────────────────────────────────
function MasterArm({ dirty, onCommit, onRevert, liveParams, draftParams, liveFilters, draftFilters }) {
  const [firing, setFiring] = useState(false);
  const t = useRef(null);
  const fire = () => {
    if (firing || !dirty) return;
    setFiring(true);
    onCommit();
    clearTimeout(t.current);
    t.current = setTimeout(() => setFiring(false), 750);
  };
  useEffect(() => {
    const k = e => {
      if (e.ctrlKey && e.key === 'Enter' && dirty && !firing) { e.preventDefault(); fire(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [dirty, firing]);

  const state = firing ? 'firing' : dirty ? 'pending' : 'idle';

  // Build short diff
  const diffs = [];
  if (liveParams.dryMass !== draftParams.dryMass) diffs.push({k:'DRY',  l:liveParams.dryMass, d:draftParams.dryMass});
  if (liveParams.deltaV  !== draftParams.deltaV)  diffs.push({k:'ΔV',   l:liveParams.deltaV,  d:draftParams.deltaV});
  if (liveFilters.minT   !== draftFilters.minT)   diffs.push({k:'T-MIN',l:liveFilters.minT,   d:draftFilters.minT});
  if (liveFilters.maxT   !== draftFilters.maxT)   diffs.push({k:'T-MAX',l:liveFilters.maxT,   d:draftFilters.maxT});
  if (liveFilters.maxCx  !== draftFilters.maxCx)  diffs.push({k:'CX',   l:liveFilters.maxCx,  d:draftFilters.maxCx});
  if (liveFilters.minTWR !== draftFilters.minTWR) diffs.push({k:'TWR',  l:liveFilters.minTWR, d:draftFilters.minTWR});
  const primary = diffs[0];

  return (
    <div className={`mk3-arm ${state}`}>
      <div className="mk3-arm-plate">
        <div className="mk3-arm-lever" onClick={fire} role="button" aria-label="Commit" style={{cursor: dirty ? 'pointer' : 'default'}}>
          <div className="mk3-arm-bat"/>
        </div>
        <div className="mk3-arm-state">
          <div className="mk3-arm-led-row">
            <div className="mk3-arm-led"/>
            <div className="mk3-arm-status">
              {state === 'idle' ? 'CONFIG LIVE · NOMINAL' : state === 'pending' ? 'DRAFT · THROW LEVER' : 'ARMED · COMMITTED'}
            </div>
          </div>
          <div className="mk3-arm-diff">
            {primary ? (
              <>
                <div><span className="tag">LIVE</span>{primary.k} {fmt(+primary.l, 0)}</div>
                <div><span className="tag">DRAFT</span><span className="hi">{primary.k} {fmt(+primary.d, 0)}</span>{diffs.length > 1 && ` · +${diffs.length-1}`}</div>
              </>
            ) : (
              <>
                <div><span className="tag">LIVE</span>COMMITTED</div>
                <div><span className="tag">DRAFT</span>— no changes —</div>
              </>
            )}
          </div>
          {dirty && !firing && <button className="mk3-arm-revert" onClick={onRevert}>REVERT</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Sensitivity strip (calibrated lever) ───────────────────────────
function SensitivityStrip({ cfg, dv, setDV, dryMass, feasible }) {
  const [local, setLocal] = useState(dv);
  useEffect(() => { setLocal(dv); }, [dv]);
  const commit = () => { if (local !== dv) setDV(local); };
  const r = recalcForDV(cfg, dv, dryMass);
  const optimal = useMemo(() => {
    if (!feasible || !feasible.length) return null;
    let best = null, bestWet = Infinity;
    for (const c of feasible) {
      const rc = recalcForDV(c, dv, dryMass);
      if (rc.wet < bestWet) { best = c; bestWet = rc.wet; }
    }
    return { cfg: best, wet: bestWet };
  }, [feasible, dv, dryMass]);
  const delta = optimal ? r.wet - optimal.wet : 0;
  const isOptimal = optimal && cfg.id === optimal.cfg.id;

  return (
    <div className="mk3-unit mk3-steel" style={{display:'grid', gridTemplateColumns:'auto 1fr auto', gap:20, alignItems:'center'}}>
      <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
      <div className="mk3-dymo"><span>Δ-V SENSITIVITY LEVER</span><span className="mk3-dymo-sub">RACK 01 · UNIT C</span></div>

      <div className="mk3-readout" style={{minWidth: 160}}>
        <span className="mk3-readout-silk">MISSION Δ-V</span>
        <NixieReadout value={local} digits={4} decimals={0}/>
        <span className="mk3-readout-unit">M/S · BASELINE {BASELINE.deltaV}</span>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        <input type="range" min="50" max="6000" step="25" className="mk3-range"
          value={local} onChange={e => setLocal(+e.target.value)}
          onPointerUp={commit} onKeyUp={commit} onTouchEnd={commit} onBlur={commit}/>
        <div className="mk3-slider-caption">DRAG LEVER · MASS SCALES VIA TSIOLKOVSKY · RELEASE TO COMMIT</div>
      </div>

      <div className="mk3-readout" style={{minWidth: 170}}>
        <span className="mk3-readout-silk">vs MASS-OPTIMAL</span>
        {isOptimal ? (
          <span className="mk3-nixie-window" style={{padding:'10px 14px'}}>
            <span className="mk3-tube" style={{width:'auto', padding:'0 6px'}}>
              <span className="mk3-tube-digit" style={{fontSize:13, letterSpacing:'0.1em'}}>OPT</span>
            </span>
          </span>
        ) : (
          <NixieReadout value={delta} digits={4} decimals={1}/>
        )}
        <span className="mk3-readout-unit">{isOptimal ? '★ OPTIMAL' : 'KG OVER REF'}</span>
      </div>
    </div>
  );
}

// ─── Top bar: PID button + top-2 alts + candidate selector ──────────
function TopBar({ cfg, feasible, selectedId, setSelectedId, dryMass, dv, committedDV }) {
  const rankedByCommitted = useMemo(() => {
    return feasible.map(c => {
      const r = recalcForDV(c, committedDV, dryMass);
      return { ...c, _cw: r.wet };
    }).sort((a,b) => a._cw - b._cw);
  }, [feasible, committedDV, dryMass]);
  const curIdx = rankedByCommitted.findIndex(c => c.id === cfg.id);
  const curWet = curIdx >= 0 ? rankedByCommitted[curIdx]._cw : 0;
  const isOptimal = curIdx === 0;
  const top2 = useMemo(() => {
    const picks = [];
    for (const c of rankedByCommitted) {
      if (c.id === cfg.id) continue;
      picks.push(c); if (picks.length >= 2) break;
    }
    return picks;
  }, [rankedByCommitted, cfg.id]);

  return (
    <div className="mk3-top-bar">
      <div className="mk3-top2">
        <div className="mk3-top2-head">
          {isOptimal ? <span className="opt">★ OPTIMAL · TOP RANKED</span> : <span>TOP ALTERNATIVES · @ Δv {committedDV.toFixed(0)}</span>}
        </div>
        {top2.map((c, i) => {
          const d = c._cw - curWet;
          const s = d === 0 ? '±0' : (d > 0 ? '+' : '') + d.toFixed(1);
          return (
            <div key={c.id} className="mk3-top2-row" onClick={() => setSelectedId(c.id)}>
              <span className="mk3-top2-rank">#{isOptimal ? i+2 : i+1}</span>
              <span className="mk3-top2-eng">{c.engine.mfr.split(' ')[0]} {c.engine.model}</span>
              <span className="mk3-top2-mass">{c._cw.toFixed(1)}</span>
              <span className={`mk3-top2-delta ${d < 0 ? 'down' : d > 0 ? 'up' : ''}`}>{s} kg</span>
            </div>
          );
        })}
      </div>

      <select className="mk3-selector" value={cfg.id} onChange={e => setSelectedId(e.target.value)}>
        {feasible.map((c,i) => (
          <option key={c.id} value={c.id}>
            #{String(i+1).padStart(2,'0')} · {c.engine.mfr} {c.engine.model} · {c.budget.wet.toFixed(1)}kg
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Hero strip ─────────────────────────────────────────────────────
function Hero({ cfg, dv, dryMass, advisories, cautionAcked, warningAcked, ackCautionNow, ackWarningNow }) {
  const recalc = (() => { const r = recalcForDV(cfg, dv, dryMass); return { ...cfg.budget, dry:dryMass, prop:r.prop, wet:r.wet, frac:r.frac }; })();
  const twr = advisories.twr;
  const fracSev = advisories.items.find(a => a.src === 'MARGIN')?.sev;
  const cxSev   = advisories.items.find(a => a.src === 'COMPLEXITY')?.sev;
  const twrSev  = advisories.items.find(a => a.src === 'TWR')?.sev;

  return (
    <div className="mk3-hero">
      <div className="mk3-vellum-col">
        <PidOpenButton cfg={cfg} dryMass={dryMass} dv={dv}/>
        <div className="mk3-unit mk3-steel">
          <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
          <div className="mk3-dymo">
            <span>{cfg.id} · SCHEMATIC THUMB</span>
            <span className="mk3-dymo-sub">{cfg.engine.mfr.split(' ')[0]} {cfg.engine.model} · {cfg.engine.mode}</span>
          </div>
          <VellumThumb cfg={cfg}/>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:14, minWidth:0}}>
        <div className="mk3-unit mk3-steel">
          <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
          <div className="mk3-dymo"><span>KEY METRICS · READOUT</span><span className="mk3-dymo-sub">Δv {dv.toFixed(0)} m/s</span></div>
          <div className="mk3-metric-grid">
            <NixieMetric label="WET MASS" value={recalc.wet} unit="KG" digits={4} decimals={1}
                         sub={<>Δ {(recalc.wet - cfg.budget.wet).toFixed(1)} kg baseline</>}/>
            <NixieMetric label="PROPELLANT" value={recalc.prop} unit="KG" digits={4} decimals={1}
                         sub={`${(recalc.prop/recalc.wet*100).toFixed(1)}% of wet`}/>
            <NixieMetric label="PROP FRAC" value={recalc.frac*100} unit="% WET" digits={3} decimals={1} sev={fracSev}
                         sub="m_prop / m_wet"/>
            <NixieMetric label="THRUST" value={cfg.engine.thrust} unit="N" digits={4} decimals={0} sev={twrSev}
                         sub={`T/W ${twr.toFixed(3)}`}/>
            <NixieMetric label="ISP VAC" value={cfg.engine.isp} unit="S" digits={3} decimals={0}
                         sub={`ve ${(cfg.engine.isp*9.80665).toFixed(0)} m/s`}/>
            <NixieMetric label="COMPLEXITY" value={cfg.engine.cx} unit="/ 5" digits={1} decimals={0} sev={cxSev}
                         sub={cfg.engine.cx <= 2 ? 'low' : cfg.engine.cx <= 3 ? 'moderate' : cfg.engine.cx === 4 ? 'high' : 'maximum'}/>
          </div>
        </div>

        <div className="mk3-unit mk3-steel">
          <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
          <div className="mk3-dymo">
            <span>ANNUNCIATOR PANEL</span>
            <span className="mk3-dymo-sub">W {advisories.counts.WARNING} · C {advisories.counts.CAUTION} · A {advisories.counts.ADVISORY}</span>
          </div>
          <div className="mk3-annun">
            <CueMatrix advisories={advisories}/>
            <div className="mk3-masters">
              <MasterLamp kind="caution" active={recalc.frac >= 0.80} acked={cautionAcked} onClick={ackCautionNow}
                          sub={recalc.frac >= 0.80 ? `PROP FRAC ${(recalc.frac*100).toFixed(1)}% ≥ 80%` : 'MARGIN NOMINAL'}/>
              <MasterLamp kind="warning" active={recalc.frac >= 0.90} acked={warningAcked} onClick={ackWarningNow}
                          sub={recalc.frac >= 0.90 ? `PROP FRAC ${(recalc.frac*100).toFixed(1)}% ≥ 90%` : 'BELOW 90% LIMIT'}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Teletype ranked trade printout ─────────────────────────────────
function TeletypeTable({ feasible, cfg, setSelectedId, dryMass, dv, params, filters, advisoriesByCfg }) {
  const ranked = useMemo(() => {
    return feasible
      .map(c => {
        const r = recalcForDV(c, dv, dryMass);
        return { ...c, _w: r.wet, _p: r.prop, _f: r.frac };
      })
      .sort((a, b) => a._w - b._w);
  }, [feasible, dv, dryMass]);

  const today = new Date();
  const stamp = today.toISOString().slice(0,16).replace('T',' ') + 'Z';
  const runId = `TR-${String(Math.abs(Math.round(dryMass * 37 + dv * 3)) % 9999).padStart(4,'0')}`;

  return (
    <div className="mk3-unit mk3-steel mk3-teletype-shelf">
      <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
      <div className="mk3-dymo">
        <span>RANKED TRADE · TELETYPE</span>
        <span className="mk3-dymo-sub">CONTINUOUS FORM · {ranked.length} LINES</span>
      </div>

      <div className="mk3-teletype">
        <div className="mk3-teletype-head">
          <div className="banner">── PROPULSION TRADE · RANKED PRINTOUT · BY WET MASS ASCENDING ──</div>
          <div className="meta">
            <span>RUN <b>{runId}</b></span>
            <span>STAMP <b>{stamp}</b></span>
            <span>DRY <b>{dryMass.toFixed(0)} kg</b></span>
            <span>Δv <b>{dv.toFixed(0)} m/s</b></span>
            <span>MODES <b>{[...filters.modes].join('/')}</b></span>
            <span>ITAR <b>{filters.noItar ? 'EXCLUDED' : 'OK'}</b></span>
            <span>HERITAGE <b>{['COTS','Δ-QUAL','DEV'][filters.heritage]}</b></span>
          </div>
        </div>

        <div className="mk3-tt-cols">
          <span className="r">#</span>
          <span>ENGINE</span>
          <span>MODE</span>
          <span className="r">WET kg</span>
          <span className="r">PROP kg</span>
          <span className="r">FRAC %</span>
          <span className="r mk3-tt-hide-compact">THR N</span>
          <span className="r mk3-tt-hide-compact">ISP s</span>
          <span className="r">T/W</span>
          <span className="r mk3-tt-hide-compact">CX</span>
          <span className="r">FLAGS</span>
        </div>

        {ranked.map((c, i) => {
          const twr = c.engine.thrust / Math.max(0.001, c._w * 9.81);
          const adv = advisoriesByCfg.get(c.id) || { counts: {WARNING:0,CAUTION:0,ADVISORY:0} };
          const selected = c.id === cfg.id;
          return (
            <div key={c.id}
                 className={`mk3-tt-row ${selected ? 'selected' : ''}`}
                 onClick={() => setSelectedId(c.id)}>
              <span className="r">{String(i+1).padStart(2,'0')}</span>
              <span className="eng">
                <span className="mdl">{c.engine.model}</span>
                <span className="mfr">{c.engine.mfr.split(' ')[0]}</span>
                {selected && <span className="pid">SEL</span>}
              </span>
              <span>{c.engine.mode}</span>
              <span className="r">{c._w.toFixed(1)}</span>
              <span className="r">{c._p.toFixed(1)}</span>
              <span className="r">{(c._f*100).toFixed(1)}</span>
              <span className="r mk3-tt-hide-compact">{c.engine.thrust.toFixed(0)}</span>
              <span className="r mk3-tt-hide-compact">{c.engine.isp.toFixed(0)}</span>
              <span className="r">{twr.toFixed(3)}</span>
              <span className="r mk3-tt-hide-compact">{c.engine.cx}</span>
              <span className="mk3-tt-flags">
                {adv.counts.WARNING  > 0 && <span className="mk3-tt-flag w">W{adv.counts.WARNING}</span>}
                {adv.counts.CAUTION  > 0 && <span className="mk3-tt-flag c">C{adv.counts.CAUTION}</span>}
                {adv.counts.ADVISORY > 0 && <span className="mk3-tt-flag a">A{adv.counts.ADVISORY}</span>}
              </span>
            </div>
          );
        })}

        <div className="mk3-teletype-foot">
          <span>── END OF RUN · {ranked.length} CONFIGURATIONS · FORM FEED ──</span>
          <span className="stamp">APPROVED — A.G.C.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Advisory log — detailed cue cards ──────────────────────────────
function AdvisoryList({ advisories }) {
  if (!advisories.items.length) {
    return (
      <div className="mk3-unit mk3-steel">
        <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
        <div className="mk3-dymo"><span>ADVISORY LOG</span><span className="mk3-dymo-sub">ALL CLEAR · NO FLAGS</span></div>
        <div className="mk3-advisory-log">
          <div className="mk3-advisory-empty">No advisories raised for current configuration</div>
        </div>
      </div>
    );
  }
  return (
    <div className="mk3-unit mk3-steel">
      <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
      <div className="mk3-dymo">
        <span>ADVISORY LOG</span>
        <span className="mk3-dymo-sub">W {advisories.counts.WARNING} · C {advisories.counts.CAUTION} · A {advisories.counts.ADVISORY}</span>
      </div>
      <div className="mk3-advisory-log">
        {advisories.items.map((a, i) => (
          <div key={i} className={`mk3-advisory ${a.sev.toLowerCase()}`}>
            <div className="mk3-advisory-tab"/>
            <div className="mk3-advisory-code">{a.code}</div>
            <div className="mk3-advisory-body"><span className="src">{a.src}</span>{a.msg}</div>
            <div className="mk3-advisory-sev">{a.sev}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tweaks ─────────────────────────────────────────────────────────
const { TweaksPanel, useTweaks, TweakSection, TweakSlider, TweakToggle, TweakSelect } = window;

function TweaksUI({ value, setValue }) {
  if (!TweaksPanel) return null;
  return (
    <TweaksPanel title="Tweaks · MK 3">
      <TweakSection title="Aesthetic">
        <TweakSelect label="Panel Finish" value={value.finish} onChange={v => setValue({...value, finish:v})}
          options={[
            {value:'putty',   label:'Putty Grey (EAI PACE)'},
            {value:'hammer',  label:'Hammer-Tone Green'},
            {value:'beige',   label:'USAF Beige'},
            {value:'black',   label:'Black Crackle'},
          ]}/>
        <TweakSlider label="Lamp Glow Intensity" min={0.3} max={1.5} step={0.05}
          value={value.glow} onChange={v => setValue({...value, glow:v})}/>
        <TweakToggle label="Hazard Tape (always visible)" value={value.alwaysTape}
          onChange={v => setValue({...value, alwaysTape:v})}/>
        <TweakToggle label="Nixie Flicker on Change" value={value.flicker}
          onChange={v => setValue({...value, flicker:v})}/>
      </TweakSection>
    </TweaksPanel>
  );
}

// ─── Live clock ─────────────────────────────────────────────────────
function useUTCClock() {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setN(new Date()), 1000); return () => clearInterval(t); }, []);
  const p = x => String(x).padStart(2,'0');
  return `${n.getUTCFullYear()}-${p(n.getUTCMonth()+1)}-${p(n.getUTCDate())} · ${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())}Z`;
}

// ─── App ────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "finish": "putty",
  "glow": 1.0,
  "alwaysTape": false,
  "flicker": true
}/*EDITMODE-END*/;

function App() {
  const [draftParams, setDraftParams] = useState({ dryMass: 500, deltaV: 300 });
  const [draftFilters, setDraftFilters] = useState({
    modes: new Set(['Mono','Biprop','Green']),
    fuels: new Set(['N2H4','MMH','LMP-103S']),
    minT: 0, maxT: 10000, heritage: 1, noItar: false, maxCx: 5, minTWR: 0.040,
  });
  const [params, setParams] = useState(draftParams);
  const [filters, setFilters] = useState(draftFilters);

  const dirty = useMemo(() => {
    if (draftParams.dryMass !== params.dryMass) return true;
    if (draftParams.deltaV  !== params.deltaV)  return true;
    const f = draftFilters, g = filters;
    if (f.minT !== g.minT || f.maxT !== g.maxT) return true;
    if (f.heritage !== g.heritage || f.noItar !== g.noItar) return true;
    if (f.maxCx !== g.maxCx || f.minTWR !== g.minTWR) return true;
    const eq = (a,b) => a.size === b.size && [...a].every(x => b.has(x));
    if (!eq(f.modes, g.modes)) return true;
    if (!eq(f.fuels, g.fuels)) return true;
    return false;
  }, [draftParams, draftFilters, params, filters]);

  const commit = () => { setParams(draftParams); setFilters({...draftFilters, modes:new Set(draftFilters.modes), fuels:new Set(draftFilters.fuels)}); };
  const revert = () => { setDraftParams(params); setDraftFilters({...filters, modes:new Set(filters.modes), fuels:new Set(filters.fuels)}); };

  const [dv, setDV] = useState(draftParams.deltaV);
  useEffect(() => { setDV(params.deltaV); }, [params.deltaV]);
  const commitDV = React.useCallback(v => { setParams(p => ({...p, deltaV:v})); setDraftParams(p => ({...p, deltaV:v})); }, []);

  const fuelForMode = { Mono:'N2H4', Biprop:'MMH', Green:'LMP-103S' };

  const studyResult = useMemo(() => {
    const modeNameMap = { Mono:'MONOPROP', Biprop:'BIPROP', Green:'GREEN_MONOPROP' };
    const modes = [...filters.modes].map(m => modeNameMap[m]);
    return window.solveMission(
      { dryMass: params.dryMass, deltaV: params.deltaV },
      { allowedModes: modes, minThrustN: filters.minT, maxThrustN: filters.maxT,
        includeDev: filters.heritage === 2, excludeItar: filters.noItar, maxComplexity: filters.maxCx });
  }, [filters, params.dryMass, params.deltaV]);

  const feasible = useMemo(() => studyResult.configs.filter(c => {
    if (!filters.fuels.has(fuelForMode[c.engine.mode])) return false;
    if (filters.heritage === 0 && c.engine.status !== 'COTS') return false;
    return true;
  }), [studyResult, filters.fuels, filters.heritage]);

  const [selectedId, setSelectedIdRaw] = useState(() => window.CONFIGS[0]?.id || '');
  const setSelectedId = id => setSelectedIdRaw(id);
  useEffect(() => {
    if (feasible.length && !feasible.find(c => c.id === selectedId)) setSelectedIdRaw(feasible[0].id);
  }, [feasible, selectedId]);
  const selectedCfg = feasible.find(c => c.id === selectedId) || feasible[0] || window.CONFIGS[0];

  const recalc = useMemo(() => ({ ...selectedCfg.budget, ...recalcForDV(selectedCfg, dv, params.dryMass) }),
    [selectedCfg, dv, params.dryMass]);
  const advisories = useMemo(() => buildAdvisories(selectedCfg, recalc, filters.minTWR),
    [selectedCfg, recalc, filters.minTWR]);

  // Advisory counts per feasible cfg — used to stamp warning/caution/advisory
  // flags next to each row in the ranked teletype printout.
  const advisoriesByCfg = useMemo(() => {
    const m = new Map();
    for (const c of feasible) {
      const r = recalcForDV(c, dv, params.dryMass);
      const rc = { ...c.budget, ...r };
      m.set(c.id, buildAdvisories(c, rc, filters.minTWR));
    }
    return m;
  }, [feasible, dv, params.dryMass, filters.minTWR]);

  const alarmState = recalc.frac >= 0.90 ? 'warning' : recalc.frac >= 0.80 ? 'caution' : 'nominal';

  // Master-alarm ACK state. Tracks a signature of the live "what's firing"
  // for each severity; when the signature changes (new alert condition OR
  // alarm clears) the ack flag resets so the master re-alerts. Push-to-ack
  // while active silences the pulse and shows an ACKED readout.
  const cautionSig = useMemo(() => advisories.items.filter(a=>a.sev==='CAUTION').map(a=>a.code).sort().join('|'), [advisories]);
  const warningSig = useMemo(() => advisories.items.filter(a=>a.sev==='WARNING').map(a=>a.code).sort().join('|'), [advisories]);
  const [ackCaution, setAckCaution] = useState('');
  const [ackWarning, setAckWarning] = useState('');
  const cautionActive = recalc.frac >= 0.80 || cautionSig !== '';
  const warningActive = recalc.frac >= 0.90 || warningSig !== '';
  const cautionAcked  = cautionActive && ackCaution === ('frac:' + (recalc.frac>=0.80?'y':'n') + '|' + cautionSig);
  const warningAcked  = warningActive && ackWarning === ('frac:' + (recalc.frac>=0.90?'y':'n') + '|' + warningSig);
  const ackCautionNow = () => { if (cautionActive) setAckCaution('frac:' + (recalc.frac>=0.80?'y':'n') + '|' + cautionSig); };
  const ackWarningNow = () => { if (warningActive) setAckWarning('frac:' + (recalc.frac>=0.90?'y':'n') + '|' + warningSig); };

  // Tweaks
  const [tweaks, setTweaks] = useTweaks ? useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  const clock = useUTCClock();

  const finishBg = {
    putty:   null,  // default steel from CSS
    hammer:  'linear-gradient(145deg, rgba(255,245,220,0.08), transparent 28%, rgba(0,0,0,0.08) 72%, rgba(0,0,0,0.18)), repeating-linear-gradient(90deg, rgba(80,120,90,0.1) 0 1px, rgba(0,0,0,0.02) 1px 2px), #6a7a6a',
    beige:   'linear-gradient(145deg, rgba(255,245,220,0.12), transparent 28%, rgba(0,0,0,0.06) 72%, rgba(0,0,0,0.18)), repeating-linear-gradient(90deg, rgba(255,255,255,0.01) 0 1px, rgba(0,0,0,0.02) 1px 2px), #b3a88a',
    black:   '#242017',
  };

  return (
    <div className={`mk3 alarm-${alarmState}`} style={{
      '--custom-glow': tweaks.glow,
    }}>
      <style>{`
        ${tweaks.finish !== 'putty' ? `
        .mk3-unit.mk3-steel, .mk3-side-unit.mk3-steel {
          background: ${finishBg[tweaks.finish]} !important;
        }` : ''}
        ${tweaks.alwaysTape ? `.mk3 .mk3-hazard-tape { opacity: 1 !important; }` : ''}
        ${!tweaks.flicker ? `.mk3-tube.flicker .mk3-tube-digit { animation: none !important; }` : ''}
        .mk3 { --nixie-glow: rgba(255,122,46, ${0.55 * tweaks.glow}); --amber-glow: rgba(216,168,74, ${0.55 * tweaks.glow}); --red-glow: rgba(196,52,40, ${0.55 * tweaks.glow}); }
      `}</style>

      <header className="mk3-rack-header mk3-steel">
        <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
        <div className="mk3-plate">
          <span className="mk3-screw tl"/><span className="mk3-screw tr"/><span className="mk3-screw bl"/><span className="mk3-screw br"/>
          <div className="mk3-plate-line1">Propulsion Trade — Rack 01</div>
          <div className="mk3-plate-line2">{window.MARK_BLOCK || 'MK 3 BLK 1'}</div>
        </div>
        <div className="mk3-header-meta">
          <span className={`mk3-solver-pill`}><span className="dot"/>{alarmState === 'warning' ? 'MASTER WARNING' : alarmState === 'caution' ? 'MASTER CAUTION' : 'SYSTEM NOMINAL'}</span>
          <span><span className="label">MISSION</span><span className="val">{params.dryMass} KG · {dv.toFixed(0)} M/S</span></span>
          <span><span className="label">CONFIGS</span><span className="val">{feasible.length}/{window.CONFIGS.length}</span></span>
          <span><span className="label">UTC</span><span className="val">{clock}</span></span>
        </div>
        <div className="mk3-hazard-tape"/>
      </header>

      <div className="mk3-layout">
        <Sidebar
          draftParams={draftParams} setDraftParams={setDraftParams}
          draftFilters={draftFilters} setDraftFilters={setDraftFilters}
          liveParams={params} liveFilters={filters}
          dirty={dirty} onCommit={commit} onRevert={revert}
          solverMeta={studyResult?.meta}
        />

        <main>
          {feasible.length === 0 ? (
            <div className="mk3-placeholder">
              <div className="note">No feasible configurations</div>
              <div>Relax a constraint in the patch panel →</div>
            </div>
          ) : (
            <>
              <TopBar cfg={selectedCfg} feasible={feasible}
                selectedId={selectedId} setSelectedId={setSelectedId}
                dryMass={params.dryMass} dv={dv} committedDV={params.deltaV}/>

              <Hero cfg={selectedCfg} dv={dv} dryMass={params.dryMass} advisories={advisories}
                    cautionAcked={cautionAcked} warningAcked={warningAcked}
                    ackCautionNow={ackCautionNow} ackWarningNow={ackWarningNow}/>

              <SensitivityStrip cfg={selectedCfg} dv={dv} setDV={commitDV}
                dryMass={params.dryMass} feasible={feasible}/>

              <AdvisoryList advisories={advisories}/>

              <TeletypeTable
                feasible={feasible}
                cfg={selectedCfg}
                setSelectedId={setSelectedId}
                dryMass={params.dryMass}
                dv={dv}
                params={params}
                filters={filters}
                advisoriesByCfg={advisoriesByCfg}/>
            </>
          )}
        </main>
      </div>

      <TweaksUI value={tweaks} setValue={setTweaks}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
