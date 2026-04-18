// Propulsion trade-study solver — frontend adapter.
// Depends on: tradeStudy.js (consumes its output shape).
//
// Maps the solver's native output (Python-style snake_case dataclasses) into
// the CONFIGS shape the existing React tree already understands. This way
// HeroTopConfig, RankedTable, CompareView, DetailView, Schematic.html, and
// pid.js all keep working unchanged.
//
// Also handles:
//   - slug IDs:  `mfr-model-slug` (stable across catalog reorderings)
//   - warnings generation from engine/tank flags + solver metadata
//   - Pareto frontier flagging on (wet mass, thrust)

(function () {
  'use strict';

  // Python enum → frontend-expected string
  const MODE_TO_FE = {
    MONOPROP: 'Mono',
    BIPROP: 'Biprop',
    GREEN_MONOPROP: 'Green',
  };

  function slugify(s) {
    return String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Build a stable id from manufacturer + model, stripping any parenthetical
  // annotation from the model (the thrust class is already captured elsewhere
  // and makes slugs ugly: "l3harris-dm-r-4d-15-445n-dual-mode" → "l3harris-dm-r-4d-15").
  function slugIdFor(eng) {
    const modelBase = String(eng.model).replace(/\s*\(.*\)\s*/g, '').trim();
    return `${slugify(eng.manufacturer)}-${slugify(modelBase)}`;
  }

  // Map one solver cfg (from runTradeStudy's configs[]) into the
  // CONFIGS shape the frontend consumes.
  function adaptOne(cfg, mission, { pareto = false } = {}) {
    const eng = cfg.engine;
    const ft = cfg.fuelTank;
    const ot = cfg.oxTank;
    const pr = cfg.pressurant;

    // Tank block mapper (handles both fixed and variable tanks)
    function tankBlock(t, count, volEachL) {
      if (t === null || t === undefined) return null;
      // For variable tanks, volEachL is the chosen volume; compute mass at that volume.
      // For fixed tanks, volEachL equals totalVolumeL and dryMassKg is the mass.
      const dry = t.massAtVolume ? t.massAtVolume(volEachL) : t.dryMassKg;
      return {
        mfr: t.manufacturer,
        model: t.model,
        type: t.tankType,
        count: count,
        volL: volEachL,                 // per-tank volume
        dry: dry,                       // per-tank dry mass
        meop: t.meopBar,
        dia: t.diameterMm,
        len: t.lengthMm,
        heritage: t.heritage,
        status: t.status,
        material: t.shellMaterial,
      };
    }

    // Warnings (deterministic ordering)
    const warnings = [];
    if (eng.status === 'Under Development') {
      warnings.push({
        sev: 'CAUTION',
        msg: 'Engine status: Under Development — qualification not complete.',
      });
    }
    const feedMargin = (ft.meopBar - eng.feedPressureBar) / eng.feedPressureBar;
    if (feedMargin < 0.10) {
      warnings.push({
        sev: 'CAUTION',
        msg: `Feed pressure margin ${(feedMargin * 100).toFixed(0)}% — below 10%. Risk of regulator droop.`,
      });
    }
    if (ot !== null && ft.totalVolumeL !== ot.totalVolumeL) {
      // Asymmetric tankage in biprop — fuel tank total volume != ox tank total volume.
      // This isn't automatically wrong (different propellants, different densities)
      // but worth flagging — the original frontend used this warning.
      warnings.push({
        sev: 'CAUTION',
        msg: 'Asymmetric tank pair — fuel and oxidizer mass capacities differ.',
      });
    }
    if (cfg.oscillationDamped) {
      warnings.push({
        sev: 'INFO',
        msg: 'Solver hit oscillation damping — picked heavier of two limit-cycle tank configs for feasibility.',
      });
    }
    if (!cfg.converged) {
      warnings.push({
        sev: 'CAUTION',
        msg: 'Solver did not converge in 30 iterations; wet mass may be imprecise.',
      });
    }
    if (cfg.hwMarginApplied > 0) {
      warnings.push({
        sev: 'INFO',
        msg: `${(cfg.hwMarginApplied * 100).toFixed(0)}% procurement margin applied to tanks + pressurant.`,
      });
    }
    if (eng.itarRestricted) {
      warnings.push({ sev: 'INFO', msg: 'Engine is ITAR / export restricted.' });
    }

    return {
      id: slugIdFor(eng),
      engine: {
        mfr: eng.manufacturer,
        model: eng.model,
        mode: MODE_TO_FE[eng.mode] || eng.mode,
        thrust: eng.thrustN,
        isp: eng.ispS,
        mass: eng.engineMassKg,
        feedP: eng.feedPressureBar,
        heritage: eng.heritage,
        status: eng.status,
        itar: eng.itarRestricted,
        cx: eng.complexity,
        fuel: eng.fuel,
        oxidizer: eng.oxidizer,
        mixtureRatio: eng.mixtureRatio,
        notes: eng.notes,
      },
      fuelTank: tankBlock(ft, cfg.fuelTankCount, cfg.fuelTankVolEachL),
      oxTank:   tankBlock(ot, cfg.oxTankCount,   cfg.oxTankVolEachL),
      press: {
        gas: pr.gas,
        storeP: pr.storagePressureBar,
        feedP: pr.feedPressureBar,
        tankL: pr.pressTankVolumeL,              // total realized volume (all tanks)
        tankKg: pr.pressTankDryMassKg,           // total mass (all tanks)
        gasKg: pr.gasMassKg,
        totalKg: pr.totalPressSystemKg,
        // Multi-tank fields (for BOM + future pid.js upgrade)
        tankCount: pr.tankCount || 1,
        tankVolEachL: pr.tankVolEachL || pr.pressTankVolumeL,
        tankMassEachKg: pr.tankMassEachKg || pr.pressTankDryMassKg,
        source: pr.pressTankSource,
      },
      budget: {
        dry: mission.dryMass,
        eng: cfg.engineMassKg,
        fTk: cfg.fuelTankMassKg,
        oTk: cfg.oxTankMassKg,
        prs: cfg.pressSystemMassKg,
        prop: cfg.propellantMassKg,
        wet: cfg.totalWetMassKg,
        frac: cfg.propSystemFraction,
      },
      warnings,
      pareto,
      // Solver metadata for telemetry + debugging (non-breaking additions to CONFIGS)
      solver: {
        converged: cfg.converged,
        oscillationDamped: cfg.oscillationDamped,
        iterations: cfg.iterations,
        hwMarginApplied: cfg.hwMarginApplied,
        hwMassBareKg: cfg.hwMassBareKg,
        hwMassMarginedKg: cfg.hwMassMarginedKg,
        trace: cfg.trace,
      },
      // Raw solver cfg stashed for previewAtDV — needs hwMassMarginedKg, engine, etc.
      _solver: cfg,
    };
  }

  // Pareto frontier on (wet mass, thrust).
  // Lower wet = better, higher thrust = better. A config is Pareto-optimal
  // iff no other config has BOTH lower-or-equal wet AND higher-or-equal thrust
  // with at least one strict improvement.
  function computePareto(configs) {
    const n = configs.length;
    const pareto = new Array(n).fill(true);
    for (let i = 0; i < n; i++) {
      const wi = configs[i].totalWetMassKg;
      const ti = configs[i].engine.thrustN;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const wj = configs[j].totalWetMassKg;
        const tj = configs[j].engine.thrustN;
        const dominates = (wj <= wi) && (tj >= ti) && ((wj < wi) || (tj > ti));
        if (dominates) { pareto[i] = false; break; }
      }
    }
    return pareto;
  }

  // Full adapter: runs runTradeStudy, adapts each config, flags Pareto.
  // Returns { CONFIGS: [...], meta: {...} } ready for the frontend.
  function adaptTradeStudy(mission, filters) {
    const result = window.runTradeStudy(mission, filters);
    const pareto = computePareto(result.configs);
    const CONFIGS = result.configs.map((c, i) => adaptOne(c, mission, { pareto: pareto[i] }));
    return { CONFIGS, meta: result.meta };
  }

  window.SOLVER_ADAPTER = { adaptOne, adaptTradeStudy, slugIdFor, computePareto };
})();
