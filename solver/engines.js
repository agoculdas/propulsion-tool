// Propulsion trade-study solver — engines module.
// Depends on: constants.js, engines-data.js, tanks.js.
//
// Wraps the plain-data engine catalog (window.SOLVER_ENGINE_DATA) into Engine
// objects with compatibility helpers: which tanks can serve as fuel / ox
// tanks for each engine (propellant match + 0.9× MEOP pressure margin).

(function () {
  'use strict';

  function makeEngine(raw) {
    const isBiprop = raw.oxidizer != null;
    return {
      manufacturer: raw.manufacturer,
      model: raw.model,
      mode: raw.mode,
      thrustN: raw.thrust_N,
      ispS: raw.isp_s,
      fuel: raw.fuel,
      oxidizer: raw.oxidizer,
      mixtureRatio: raw.mixture_ratio,
      engineMassKg: raw.engine_mass_kg,
      feedPressureBar: raw.feed_pressure_bar,
      heritage: raw.heritage,
      status: raw.status,
      notes: raw.notes,
      itarRestricted: raw.itar_restricted,
      complexity: raw.complexity,
      isBiprop,

      // Propellants the engine needs tanks for (length 1 for mono, 2 for bi).
      get propellantsNeeded() {
        return isBiprop ? [raw.fuel, raw.oxidizer] : [raw.fuel];
      },

      // Tanks compatible as FUEL tanks: propellant match + MEOP ≥ feedP × 0.9.
      fuelTanksFor(allTanks) {
        return allTanks.filter(t =>
          t.compatiblePropellants.includes(raw.fuel) &&
          t.meopBar >= raw.feed_pressure_bar * 0.9
        );
      },

      // Tanks compatible as OXIDIZER tanks. Empty list for monoprops.
      oxTanksFor(allTanks) {
        if (!isBiprop) return [];
        return allTanks.filter(t =>
          t.compatiblePropellants.includes(raw.oxidizer) &&
          t.meopBar >= raw.feed_pressure_bar * 0.9
        );
      },
    };
  }

  const SOLVER_ENGINES = window.SOLVER_ENGINE_DATA.map(makeEngine);

  // Filter engines by user constraints. Mirror of select_propulsion_system's
  // engine-filter block.
  function filterEngines(filters) {
    const {
      minThrustN = 0,
      maxThrustN = Infinity,
      allowedModes = null,        // array of strings or null (no filter)
      allowedFuels = null,
      includeDev  = false,
      excludeItar = false,
      maxComplexity = 5,
    } = filters || {};

    return SOLVER_ENGINES.filter(e => {
      if (e.thrustN < minThrustN || e.thrustN > maxThrustN) return false;
      if (allowedModes && !allowedModes.includes(e.mode)) return false;
      if (allowedFuels && !allowedFuels.includes(e.fuel)) return false;
      if (e.status === 'Under Development' && !includeDev) return false;
      if (excludeItar && e.itarRestricted) return false;
      if (e.complexity > maxComplexity) return false;
      return true;
    });
  }

  window.SOLVER_ENGINES = SOLVER_ENGINES;
  window.filterEngines = filterEngines;
})();
