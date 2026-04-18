// Propulsion Trade Tool — live trade study data
//
// Previously: static hard-coded CONFIGS array (the "lie" — a frozen snapshot
// of one solver run at 500 kg / 300 m/s that pretended to recompute).
//
// Now: thin wrapper over the real iterative solver. window.CONFIGS holds the
// initial baseline run for any code that still reads it synchronously on load
// (e.g. Schematic.html). app.jsx calls window.runTradeStudy(mission, filters)
// directly via the adapter and memoizes on committed params.
//
// Load order (see v2 Mission Control.html):
//   solver/*.js (all modules + catalog data)  →  data.js  →  app.jsx
//
// Source of truth for the catalog + physics: SEAD/Spacecraft/tank_selector.py.
// Catalog data is auto-generated via tools/export_catalog.py; solver behaviour
// is hand-ported into solver/*.js and regression-tested in solver/_check_*.cjs.

(function () {
  'use strict';

  // Baseline mission — what the UI shows on first load, unchanged.
  window.BASELINE = { dryMass: 500, deltaV: 300, g0: 9.80665 };

  // Run the baseline trade study once at script load so window.CONFIGS is
  // populated for any consumer that reads it synchronously. Subsequent
  // parameter changes drive fresh runs via app.jsx's useMemo.
  const { adaptTradeStudy } = window.SOLVER_ADAPTER;
  const initial = adaptTradeStudy(
    { dryMass: window.BASELINE.dryMass, deltaV: window.BASELINE.deltaV },
    {}
  );
  window.CONFIGS = initial.CONFIGS;
  window.SOLVER_META = initial.meta;

  // Frontend-facing helper: wraps runTradeStudy + adaptTradeStudy so callers
  // get CONFIGS-shaped output directly.
  //
  //   solveMission(mission, filters) → { configs, meta }
  //
  // mission = { dryMass, deltaV, hwMargin?, ullage?, maxTanks? }
  // filters = { minThrustN?, maxThrustN?, allowedModes?, allowedFuels?,
  //             includeDev?, excludeItar?, maxComplexity? }
  window.solveMission = function (mission, filters) {
    const { CONFIGS, meta } = adaptTradeStudy(mission, filters);
    return { configs: CONFIGS, meta };
  };

  // --- Cheap preview for sensitivity slider ---------------------------------
  // recalcForDV is the rocket-equation rescale of a SINGLE config at fixed
  // hardware. It's what we called a "lie" before — the lie was pretending
  // this was the full trade-study solver. It IS a correct live-preview math:
  // keeps the selected tank set frozen and rescales propellant + wet mass
  // for a different Δv. Accurate for small excursions (±few hundred m/s);
  // for large excursions the real solver must re-run (which happens 200 ms
  // after the slider drag releases).
  //
  // Contract kept identical to the pre-port shape so existing app.jsx call
  // sites work unchanged:
  //   recalcForDV(cfg, newDV, dryMassOverride) →
  //     { prop, wet, frac, dry }
  window.recalcForDV = function (cfg, newDV, dryMassOverride) {
    const g0 = 9.80665;
    const ve = cfg.engine.isp * g0;
    const baseDry = (dryMassOverride != null ? dryMassOverride : cfg.budget.dry);
    const dry = baseDry + cfg.budget.eng + cfg.budget.fTk + cfg.budget.oTk + cfg.budget.prs;
    const mp = dry * (Math.exp(newDV / ve) - 1);
    const wet = dry + mp;
    return {
      prop: mp,
      wet: wet,
      frac: (cfg.budget.eng + cfg.budget.fTk + cfg.budget.oTk + cfg.budget.prs + mp) / wet,
      dry: baseDry,
    };
  };
})();
