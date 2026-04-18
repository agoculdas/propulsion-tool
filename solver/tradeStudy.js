// Propulsion trade-study solver — top-level.
// Depends on: constants.js, tanks.js, engines.js, pressurant.js, sizer.js.
//
// Exports:
//   window.runTradeStudy(mission, filters)   → { configs: [...], meta: {...} }
//   window.previewAtDV(solverCfg, newDV, dryMass) → cheap rocket-eq rescale
//       (used by the sensitivity slider for live preview on the selected
//        config without re-running the full solver)

(function () {
  'use strict';

  const { G0, PROPELLANT_DENSITY } = window.SOLVER_CONSTANTS;
  const { SOLVER_ENGINES, filterEngines } = window;
  const { SOLVER_TANKS, availableTanks } = window;
  const { solveMonoprop, solveBiprop } = window.SOLVER_SIZER;

  // --- Full trade study --------------------------------------------------
  // mission: { dryMass, deltaV, hwMargin?, ullage?, maxTanks? }
  // filters: { minThrustN?, maxThrustN?, allowedModes?, allowedFuels?,
  //            includeDev?, excludeItar?, maxComplexity? }
  //
  // Returns { configs: [...] (ranked by wet mass), meta: { ... } }
  function runTradeStudy(mission, filters) {
    const t0 = performance.now();

    const {
      dryMass,
      deltaV,
      hwMargin = 0.0,
      ullage = 0.10,
      maxTanks = 4,
    } = mission;

    // Filter engines
    const candidateEngines = filterEngines({
      ...(filters || {}),
      includeDev: (filters || {}).includeDev || false,
    });

    // Available tanks (status filter)
    const avail = availableTanks((filters || {}).includeDev || false);

    const results = [];
    for (const eng of candidateEngines) {
      const fuelTanks = eng.fuelTanksFor(avail);
      if (fuelTanks.length === 0) continue;

      let r;
      if (eng.isBiprop) {
        const oxTanks = eng.oxTanksFor(avail);
        if (oxTanks.length === 0) continue;
        r = solveBiprop({
          scDry: dryMass, dv: deltaV, eng,
          fuelTanks, oxTanks, ullage, maxTanks, hwMargin,
        });
      } else {
        r = solveMonoprop({
          scDry: dryMass, dv: deltaV, eng,
          fuelTanks, ullage, maxTanks, hwMargin,
        });
      }
      if (r !== null) results.push(r);
    }

    // Rank by wet mass ascending
    results.sort((a, b) => a.totalWetMassKg - b.totalWetMassKg);

    const runtimeMs = performance.now() - t0;

    return {
      configs: results,
      meta: {
        solver: 'iterative-oscillation-damped',
        runtimeMs,
        totalCandidates: SOLVER_ENGINES.length,
        filteredCount: candidateEngines.length,
        feasibleCount: results.length,
        convergedCount: results.reduce((n, r) => n + (r.converged ? 1 : 0), 0),
        oscillationDampedCount: results.reduce((n, r) => n + (r.oscillationDamped ? 1 : 0), 0),
        maxIterations: results.reduce((m, r) => Math.max(m, r.iterations), 0),
      },
    };
  }

  // --- Sensitivity slider preview ----------------------------------------
  // Cheap rescale for the selected config only, used while the user is
  // dragging the sensitivity slider. Keeps tank selection frozen and
  // rescales propellant via rocket equation. 200 ms after drag release,
  // the full solver re-runs with the committed ΔV.
  //
  // Note: this is an APPROXIMATION for large ΔV excursions — tanks would
  // actually resize. For small excursions (±500 m/s from the committed
  // value) it's well within a few %.
  function previewAtDV(solverCfg, newDV, dryMass) {
    const ve = solverCfg.engine.ispS * G0;
    // Keep the current hw_mass (tanks + pressurant, margined if applicable)
    const hw = solverCfg.hwMassMarginedKg;
    const eng = solverCfg.engineMassKg;
    const totalDry = dryMass + eng + hw;
    const mProp = totalDry * (Math.exp(newDV / ve) - 1.0);
    const wet = totalDry + mProp;
    const frac = (eng + hw + mProp) / wet;
    return {
      propellantMassKg: mProp,
      totalWetMassKg: wet,
      propSystemFraction: frac,
      totalDryKg: totalDry,
    };
  }

  window.runTradeStudy = runTradeStudy;
  window.previewAtDV = previewAtDV;
})();
