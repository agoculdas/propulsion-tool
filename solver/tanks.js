// Propulsion trade-study solver — tanks module.
// Depends on: constants.js, tanks-data.js (auto-generated from Python).
//
// Wraps the plain-data tank catalog (window.SOLVER_TANK_DATA) into Tank
// objects that carry behaviour: mass interpolation for variable-geometry
// tanks, capacity queries, and the findLightestTank search.

(function () {
  'use strict';

  const { PROPELLANT_DENSITY } = window.SOLVER_CONSTANTS;

  // --- Tank behaviour ----------------------------------------------------
  // Plain-object wrapper (cheaper than class instances, avoids `this` gotchas
  // in callbacks). Every entry in SOLVER_TANK_DATA becomes one of these.

  function makeTank(raw) {
    const isVariable = raw.volume_range_L != null;
    return {
      // data fields (all preserved verbatim)
      manufacturer: raw.manufacturer,
      model: raw.model,
      tankType: raw.tank_type,
      compatiblePropellants: raw.compatible_propellants,
      totalVolumeL: raw.total_volume_L,
      propellantVolumeL: raw.propellant_volume_L,
      dryMassKg: raw.dry_mass_kg,
      meopBar: raw.meop_bar,
      diameterMm: raw.diameter_mm,
      lengthMm: raw.length_mm,
      shellMaterial: raw.shell_material,
      heritage: raw.heritage,
      status: raw.status,
      notes: raw.notes,
      itarRestricted: raw.itar_restricted,
      volumeRangeL: raw.volume_range_L,
      massRangeKg: raw.mass_range_kg,
      isVariable,

      // Usable liquid volume at MAX size (for fits-single-tank queries).
      // Variable tanks use (1 - 0.10 ullage) × max. Fixed tanks use stored
      // propellant_volume_L if given, else 90% of total_volume_L.
      get usableVolumeL() {
        if (isVariable) return raw.volume_range_L[1] * 0.90;
        if (raw.propellant_volume_L != null) return raw.propellant_volume_L;
        return raw.total_volume_L * 0.90;
      },

      // Dry mass at a specific volume (variable tanks interpolate linearly
      // between the published endpoints; fixed tanks ignore volL).
      massAtVolume(volL) {
        if (!isVariable) return raw.dry_mass_kg;
        const [vmin, vmax] = raw.volume_range_L;
        const [mmin, mmax] = raw.mass_range_kg;
        if (volL <= vmin) return mmin;
        if (volL >= vmax) return mmax;
        const frac = (volL - vmin) / (vmax - vmin);
        return mmin + frac * (mmax - mmin);
      },

      // Maximum propellant mass this tank can hold, kg.
      maxPropellantMass(propellant) {
        if (!this.compatiblePropellants.includes(propellant)) return 0;
        const density = PROPELLANT_DENSITY[propellant];
        return this.usableVolumeL * density;
      },

      // Display
      repr() {
        if (isVariable) {
          const [vmin, vmax] = raw.volume_range_L;
          const [mmin, mmax] = raw.mass_range_kg;
          return `${raw.manufacturer} ${raw.model} (${vmin.toFixed(0)}-${vmax.toFixed(0)}L, ${mmin.toFixed(1)}-${mmax.toFixed(1)}kg, variable)`;
        }
        return `${raw.manufacturer} ${raw.model} (${raw.total_volume_L.toFixed(0)}L, ${raw.dry_mass_kg.toFixed(1)}kg)`;
      },
    };
  }

  // Build the catalog from the plain-data module
  const SOLVER_TANKS = window.SOLVER_TANK_DATA.map(makeTank);

  // --- findLightestTank --------------------------------------------------
  // Port of tank_selector.py:_find_lightest_tank. Returns
  // { tank, count, volEachL } or null if nothing fits.
  //
  // Variable tanks size exactly to need; fixed tanks use stored volume.
  // For n=2..max copies, finds min-total-mass combination. Variable tanks
  // are searched up to max(maxTanks, 9) copies (converge.py convention).
  function findLightestTank(propMassKg, propellant, tankCandidates, maxTanks, ullage = 0.10) {
    const density = PROPELLANT_DENSITY[propellant];
    const volNeededLiquid = propMassKg / density;
    const volNeededTank = ullage < 1.0 ? volNeededLiquid / (1.0 - ullage) : volNeededLiquid;

    let best = null;
    let bestMass = Infinity;

    for (const t of tankCandidates) {
      if (!t.compatiblePropellants.includes(propellant)) continue;

      if (t.isVariable) {
        const [vmin, vmax] = t.volumeRangeL;
        // Single variable tank: size to volNeededTank (clamped to vmin)
        if (volNeededTank <= vmax) {
          const volPick = Math.max(volNeededTank, vmin);
          const m = t.massAtVolume(volPick);
          if (m < bestMass) {
            best = { tank: t, count: 1, volEachL: volPick };
            bestMass = m;
          }
        }
        // N identical variable tanks — up to max(maxTanks, 9)
        const nMax = Math.max(maxTanks, 9);
        for (let n = 2; n <= nMax; n++) {
          const volEach = volNeededTank / n;
          if (volEach < vmin || volEach > vmax) continue;
          const total = n * t.massAtVolume(volEach);
          if (total < bestMass) {
            best = { tank: t, count: n, volEachL: volEach };
            bestMass = total;
          }
        }
      } else {
        // Fixed tank: apply ullage consistently
        const usableEach = t.totalVolumeL * (1.0 - ullage);
        if (usableEach >= volNeededLiquid && t.dryMassKg < bestMass) {
          best = { tank: t, count: 1, volEachL: t.totalVolumeL };
          bestMass = t.dryMassKg;
        }
        const capLiquidMass = usableEach * density;
        if (capLiquidMass > 0) {
          const n = Math.ceil(propMassKg / capLiquidMass);
          if (n >= 1 && n <= maxTanks && n * t.dryMassKg < bestMass) {
            best = { tank: t, count: n, volEachL: t.totalVolumeL };
            bestMass = n * t.dryMassKg;
          }
        }
      }
    }
    return best;
  }

  // Filter tanks by status (drops "Restart Required" always; drops
  // "Under Development" unless includeDev=true). Mirror of the analogous
  // block in select_propulsion_system.
  function availableTanks(includeDev = false) {
    return SOLVER_TANKS.filter(t => {
      if (t.status === 'Restart Required') return false;
      if (!includeDev && t.status === 'Under Development') return false;
      return true;
    });
  }

  window.SOLVER_TANKS = SOLVER_TANKS;
  window.findLightestTank = findLightestTank;
  window.availableTanks = availableTanks;
})();
