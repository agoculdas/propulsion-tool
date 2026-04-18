// v2 — Tactical HUD variant
// Bolder composition: 4-up HUD grid with schematic-hero, trade-space radar,
// mass-delta tape, and mission config panel. Accent uses missile-lock red
// for threats/warnings, radar green for selected/optimal.

/* global React, ReactDOM, CONFIGS, BASELINE, buildPID, buildScatter, recalcForDV */
const { useState, useEffect, useMemo, useRef } = React;

const MODE_COLORS = { Mono:'#4fd5ff', Biprop:'#f5b041', Green:'#6ee06a' };

function fmt(n, d=1) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ───────────────────── Top HUD bar ─────────────────────
function HUDBar({ params, dv, feasibleCount, total, pinnedCount, armed }) {
  return (
    <header className="hud-bar">
      <div className="hud-left">
        <div className="hud-reticle"/>
        <div>
          <div className="hud-title">PROPULSION · TRADE</div>
          <div className="hud-sub">TACTICAL HUD · v2 · BUILD 0418</div>
        </div>
      </div>
      <div className="hud-stats">
        <div className="hud-stat"><span className="hs-lbl">DRY</span><span className="hs-val">{params.dryMass}<i>kg</i></span></div>
        <div className="hud-stat"><span className="hs-lbl">ΔV</span><span className="hs-val">{dv.toFixed(0)}<i>m/s</i></span></div>
        <div className="hud-stat"><span className="hs-lbl">FEASIBLE</span><span className="hs-val">{feasibleCount}<i>/{total}</i></span></div>
        <div className="hud-stat"><span className="hs-lbl">TRACKED</span><span className="hs-val">{pinnedCount}</span></div>
        <div className="hud-stat">
          <span className="hs-lbl">SYS</span>
          <span className="hs-val" style={{color: armed ? 'var(--radar)' : 'var(--lock)'}}>
            <span className="blink-dot"/> {armed ? 'ARMED' : 'STANDBY'}
          </span>
        </div>
      </div>
    </header>
  );
}

// ───────────────────── Quadrant 1: Mission params + filters ─────────────────────
function MissionPanel({ params, setParams, dv, setDV, filters, setFilters }) {
  const toggleSet = (key, v) => {
    const n = new Set(filters[key]);
    n.has(v) ? n.delete(v) : n.add(v);
    setFilters({ ...filters, [key]: n });
  };

  return (
    <div className="hud-panel mission-panel">
      <div className="hp-head"><span className="hp-id">01</span><span>MISSION CONFIG</span><span className="hp-right">PRIMARY</span></div>
      <div className="hp-body">
        <div className="sweep">
          <div className="sweep-row">
            <label>DRY MASS</label>
            <div className="sweep-val"><input type="number" value={params.dryMass} onChange={e => setParams({...params, dryMass:+e.target.value})}/><i>kg</i></div>
          </div>
          <div className="sweep-row">
            <label>Δ-V TARGET</label>
            <div className="sweep-val"><input type="number" value={dv} onChange={e => setDV(+e.target.value)}/><i>m/s</i></div>
          </div>
          <div className="sweep-row dv-slider-row">
            <input type="range" min="50" max="1500" step="10" value={dv} onChange={e => setDV(+e.target.value)}/>
          </div>
          <div className="sweep-row">
            <div className="dv-ticks">
              {[100, 300, 500, 800, 1200].map(v => (
                <button key={v} className={`dv-tick ${dv===v?'on':''}`} onClick={() => setDV(v)}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="divider"><span>CONSTRAINTS</span></div>

        <div className="constraint-grid">
          <div>
            <div className="cg-lbl">MODE</div>
            <div className="chip-row">
              {['Mono','Biprop','Green'].map(m => (
                <div key={m} className={`chip ${filters.modes.has(m) ? 'active':''}`} onClick={() => toggleSet('modes', m)}>{m}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="cg-lbl">FUEL</div>
            <div className="chip-row">
              {['N2H4','MMH','LMP-103S'].map(f => (
                <div key={f} className={`chip ${filters.fuels.has(f) ? 'active':''}`} onClick={() => toggleSet('fuels', f)}>{f}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="cg-lbl">HERITAGE</div>
            <div className="chip-row">
              {['COTS','Δ-QUAL','DEV'].map((h,i) => (
                <div key={h} className={`chip ${filters.heritage===i ? 'active':''}`} onClick={() => setFilters({...filters, heritage: i})}>{h}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="cg-lbl">ITAR</div>
            <div className="chip-row">
              <div className={`chip ${!filters.noItar ? 'active':''}`} onClick={() => setFilters({...filters, noItar: false})}>ANY</div>
              <div className={`chip ${filters.noItar ? 'active lock':''}`} onClick={() => setFilters({...filters, noItar: true})}>EXCLUDE</div>
            </div>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div className="cg-lbl">THRUST ENVELOPE · {filters.minT}–{filters.maxT} N</div>
            <div className="thrust-range">
              <input type="range" min="0" max="1200" value={filters.minT} step="1"
                onChange={e => setFilters({...filters, minT: Math.min(+e.target.value, filters.maxT - 1)})}/>
              <input type="range" min="0" max="1200" value={Math.min(filters.maxT, 1200)} step="1"
                onChange={e => setFilters({...filters, maxT: Math.max(+e.target.value, filters.minT + 1)})}/>
            </div>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div className="cg-lbl">MAX COMPLEXITY · {filters.maxCx}/5</div>
            <div className="cx-bar">
              {[1,2,3,4,5].map(n => (
                <div key={n} className={`cx-cell ${n<=filters.maxCx?'on':''}`} onClick={() => setFilters({...filters, maxCx: n})}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────── Quadrant 2: Schematic hero ─────────────────────
function SchematicHero({ cfg, dv }) {
  const r = recalcForDV(cfg, dv);

  return (
    <div className="hud-panel hero-panel">
      <div className="hp-head">
        <span className="hp-id">02</span><span>LOCK · {cfg.id}</span>
        <span className={`mode-chip ${cfg.engine.mode}`}>{cfg.engine.mode}</span>
        <span className="hp-right">
          {cfg.pareto && <span style={{color:'var(--radar)', marginRight:10}}>★ PARETO</span>}
          {cfg.engine.mfr.toUpperCase()} · {cfg.engine.model}
        </span>
      </div>
      <div className="hp-body no-pad">
        <div className="crosshair-frame">
          <div className="ch tl"/><div className="ch tr"/><div className="ch bl"/><div className="ch br"/>
          <div className="ch-ticks"/>
          <div className="schematic-wrap-big" dangerouslySetInnerHTML={{__html: buildPID(cfg)}}/>
        </div>

        <div className="hero-stats">
          <div className="hs-cell radar">
            <div className="hs-k">WET</div>
            <div className="hs-v">{fmt(r.wet, 1)}<i>kg</i></div>
            <div className="hs-delta">{r.wet > cfg.budget.wet ? `▲ +${(r.wet-cfg.budget.wet).toFixed(1)}` : r.wet < cfg.budget.wet ? `▼ ${(r.wet-cfg.budget.wet).toFixed(1)}` : '= BASE'}</div>
          </div>
          <div className="hs-cell">
            <div className="hs-k">PROP</div>
            <div className="hs-v">{fmt(r.prop, 1)}<i>kg</i></div>
            <div className="hs-delta">{(r.prop/r.wet*100).toFixed(1)}% WET</div>
          </div>
          <div className="hs-cell">
            <div className="hs-k">THRUST</div>
            <div className="hs-v">{cfg.engine.thrust}<i>N</i></div>
            <div className="hs-delta">T/W {(cfg.engine.thrust/(r.wet*9.81)).toFixed(3)}</div>
          </div>
          <div className="hs-cell">
            <div className="hs-k">Isp</div>
            <div className="hs-v">{cfg.engine.isp}<i>s</i></div>
            <div className="hs-delta">ve {(cfg.engine.isp*9.80665).toFixed(0)}</div>
          </div>
          <div className="hs-cell">
            <div className="hs-k">FRACTION</div>
            <div className="hs-v">{(r.frac*100).toFixed(1)}<i>%</i></div>
            <div className="hs-delta">prop/wet</div>
          </div>
          <div className="hs-cell">
            <div className="hs-k">Cx</div>
            <div className="hs-v">{cfg.engine.cx}<i>/5</i></div>
            <div className="hs-delta">{cfg.engine.cx<=2?'LOW':cfg.engine.cx<=3?'MOD':'HIGH'}</div>
          </div>
        </div>

        {cfg.warnings.length > 0 && (
          <div className="warn-ticker">
            {cfg.warnings.map((w,i) => (
              <div key={i} className={`wt-item ${w.sev}`}>
                <span className="wt-sev">⚠ {w.sev}</span>
                <span className="wt-msg">{w.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────── Quadrant 3: Trade space scatter ─────────────────────
function TradeSpace({ configs, selectedId, setSelectedId, pinned, togglePin }) {
  const hostRef = useRef(null);
  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.innerHTML = buildScatter(configs, selectedId, pinned);
    hostRef.current.querySelectorAll('.point').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => setSelectedId(el.dataset.id));
    });
  }, [configs, selectedId, pinned]);

  return (
    <div className="hud-panel trade-panel">
      <div className="hp-head">
        <span className="hp-id">03</span><span>TRADE SPACE · T × M</span>
        <span className="hp-right">PARETO FRONT · CLICK TO LOCK · DBL-CLICK TO TRACK</span>
      </div>
      <div className="hp-body">
        <div ref={hostRef} onDoubleClick={e => {
          const pt = e.target.closest('.point');
          if (pt) togglePin(pt.dataset.id);
        }}/>
        <div className="legend compact">
          <div className="lg"><span className="sw" style={{background:'#4fd5ff'}}/>Mono</div>
          <div className="lg"><span className="sw" style={{background:'#f5b041'}}/>Biprop</div>
          <div className="lg"><span className="sw" style={{background:'#6ee06a'}}/>Green</div>
          <div className="lg" style={{marginLeft:10}}><span className="sw" style={{background:'transparent', border:'1px dashed #6ee06a'}}/>Pareto</div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────── Quadrant 4: Tracked list w/ stacked bars ─────────────────────
function TrackedList({ configs, selectedId, setSelectedId, pinned, togglePin }) {
  const tracked = configs.filter(c => pinned.has(c.id)).sort((a,b) => a.budget.wet - b.budget.wet);
  const maxWet = Math.max(...configs.map(c => c.budget.wet), 620);
  const best = tracked.length ? tracked[0].budget.wet : 0;

  return (
    <div className="hud-panel tracked-panel">
      <div className="hp-head">
        <span className="hp-id">04</span><span>TRACKED · MASS BUDGET</span>
        <span className="hp-right">{tracked.length} LOCKED</span>
      </div>
      <div className="hp-body scroll">
        {tracked.length === 0 ? (
          <div className="empty-panel">
            <div className="ep-title">NO TRACKED CANDIDATES</div>
            <div className="ep-sub">Pin configurations from trade space or table below</div>
          </div>
        ) : (
          <div className="tracked-list">
            {tracked.map((c, i) => {
              const segs = [
                { k:'dry',  v: c.budget.dry },
                { k:'eng',  v: c.budget.eng },
                { k:'fTk',  v: c.budget.fTk },
                { k:'oTk',  v: c.budget.oTk },
                { k:'prs',  v: c.budget.prs },
                { k:'prop', v: c.budget.prop },
              ];
              const delta = c.budget.wet - best;
              return (
                <div key={c.id} className={`tracked-row ${c.id===selectedId?'sel':''}`} onClick={() => setSelectedId(c.id)}>
                  <div className="tr-head">
                    <span className="tr-rank">T-{String(i+1).padStart(2,'0')}</span>
                    <span className="tr-id">{c.id}</span>
                    <span className={`mode-chip ${c.engine.mode}`} style={{fontSize:9}}>{c.engine.mode}</span>
                    <span className="tr-name">{c.engine.mfr} · {c.engine.model}</span>
                    {c.pareto && <span className="tr-star">★</span>}
                    <span className="tr-wet">{c.budget.wet.toFixed(1)}<i>kg</i></span>
                    {delta > 0 && <span className="tr-delta">+{delta.toFixed(1)}</span>}
                    <button className="tr-unpin" onClick={e => { e.stopPropagation(); togglePin(c.id); }}>✕</button>
                  </div>
                  <div className="tr-bar">
                    <div className="stack-bar" style={{width: `${(c.budget.wet/maxWet)*100}%`}}>
                      {segs.filter(s=>s.v>0).map((s,j) => (
                        <div key={j} className="stack-seg" data-k={s.k}
                             style={{width: `${(s.v/c.budget.wet)*100}%`}}
                             title={`${s.k}: ${s.v.toFixed(2)} kg`}/>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────── Ranked table (compact, below HUD) ─────────────────────
function RankedTable({ configs, selectedId, setSelectedId, pinned, togglePin }) {
  return (
    <div className="hud-panel" style={{marginTop:14}}>
      <div className="hp-head">
        <span className="hp-id">05</span><span>CANDIDATE REGISTER</span>
        <span className="hp-right">{configs.length} FEASIBLE · SORTED BY WET MASS</span>
      </div>
      <div className="hp-body no-pad">
        <div className="table-wrap">
          <table className="trade v2">
            <thead>
              <tr>
                <th>Trk</th><th></th><th>ID</th><th>Engine</th><th>Mode</th>
                <th className="num-col">T (N)</th><th className="num-col">Isp (s)</th><th className="num-col">Cx</th>
                <th>Fuel tank</th><th>Ox tank</th>
                <th className="num-col">Eng</th><th className="num-col">Tanks</th><th className="num-col">Press</th>
                <th className="num-col">Prop</th><th className="num-col">Wet (kg)</th><th>Advisories</th>
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
                        {pinned.has(c.id) ? '◉' : '○'}
                      </button>
                    </td>
                    <td className="pareto-col">{c.pareto ? <span className="pareto-star">★</span> : ''}</td>
                    <td className="id-col">{c.id}</td>
                    <td>{c.engine.mfr} {c.engine.model}{c.engine.itar && <span className="itar-flag">ITAR</span>}</td>
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
      </div>
    </div>
  );
}

// ───────────────────── App ─────────────────────
function App() {
  const [params, setParams] = useState({ dryMass: 500 });
  const [dv, setDV] = useState(300);
  const [filters, setFilters] = useState({
    modes: new Set(['Mono','Biprop','Green']),
    fuels: new Set(['N2H4','MMH','LMP-103S']),
    minT: 0, maxT: 1200, heritage: 1, noItar: false, maxCx: 5,
  });
  const [pinned, setPinned] = useState(() => {
    try { const s = localStorage.getItem('pinned-v2'); return new Set(s ? JSON.parse(s) : ['C01','C03','C05','C10']); }
    catch { return new Set(['C01','C03','C05','C10']); }
  });
  useEffect(() => { try { localStorage.setItem('pinned-v2', JSON.stringify([...pinned])); } catch {} }, [pinned]);

  const feasible = useMemo(() => {
    return CONFIGS.filter(c => {
      if (!filters.modes.has(c.engine.mode)) return false;
      if (c.engine.thrust < filters.minT || c.engine.thrust > filters.maxT) return false;
      if (filters.heritage === 0 && c.engine.status !== 'COTS') return false;
      if (filters.heritage === 1 && c.engine.status === 'Dev') return false;
      if (filters.noItar && c.engine.itar) return false;
      if (c.engine.cx > filters.maxCx) return false;
      return true;
    }).sort((a,b) => a.budget.wet - b.budget.wet);
  }, [filters]);

  const [selectedId, setSelectedIdRaw] = useState(() => {
    try { return localStorage.getItem('selected-v2') || 'C01'; } catch { return 'C01'; }
  });
  const setSelectedId = id => { setSelectedIdRaw(id); try { localStorage.setItem('selected-v2', id); } catch {} };

  useEffect(() => {
    if (feasible.length && !feasible.find(c => c.id === selectedId)) {
      setSelectedId(feasible[0].id);
    }
  }, [feasible, selectedId]);

  const selectedCfg = feasible.find(c => c.id === selectedId) || feasible[0] || CONFIGS[0];
  const togglePin = id => {
    const n = new Set(pinned);
    n.has(id) ? n.delete(id) : n.add(id);
    setPinned(n);
  };

  return (
    <div className="app v2">
      <HUDBar params={params} dv={dv} feasibleCount={feasible.length} total={CONFIGS.length} pinnedCount={pinned.size} armed={feasible.length>0}/>
      <main className="hud-grid">
        <MissionPanel params={params} setParams={setParams} dv={dv} setDV={setDV} filters={filters} setFilters={setFilters}/>
        {feasible.length > 0
          ? <SchematicHero cfg={selectedCfg} dv={dv}/>
          : <div className="hud-panel hero-panel"><div className="hp-head"><span className="hp-id">02</span><span>LOCK</span></div><div className="hp-body"><div className="empty-panel"><div className="ep-title" style={{color:'var(--lock)'}}>NO FEASIBLE LOCK</div><div className="ep-sub">Relax constraints in panel 01</div></div></div></div>}
        <TradeSpace configs={feasible} selectedId={selectedId} setSelectedId={setSelectedId} pinned={pinned} togglePin={togglePin}/>
        <TrackedList configs={feasible} selectedId={selectedId} setSelectedId={setSelectedId} pinned={pinned} togglePin={togglePin}/>
      </main>
      <RankedTable configs={feasible} selectedId={selectedId} setSelectedId={setSelectedId} pinned={pinned} togglePin={togglePin}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
