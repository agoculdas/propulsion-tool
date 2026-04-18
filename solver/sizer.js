// Propulsion trade-study solver — per-engine iterative sizer.
// Depends on: constants.js, tanks.js (findLightestTank), pressurant.js.
//
// Ports _solve_monoprop_system and _solve_biprop_system from tank_selector.py.
// Both solvers iterate the coupled dry↔propellant fixed point via Tsiolkovsky,
// with oscillation damping: if the sequence bounces between two tank configs,
// force convergence on the heavier of the two.

(function () {
  'use strict';

  const { G0, PROPELLANT_DENSITY } = window.SOLVER_CONSTANTS;
  const { findLightestTank } = window;
  const { sizePressurantDiscrete } = window.SOLVER_PRESSURANT;

  // Monoprop solver: engine + fuel tank(s) + pressurant.
  function solveMonoprop({ scDry, dv, eng, fuelTanks, ullage = 0.10, maxTanks = 4, hwMargin = 0.0 }) {
    const ve = eng.ispS * G0;
    let hwMass = 0.0;
    let prevPrev = 0.0;
    let pressResult = null;
    let pick = null;
    const trace = [];
    let converged = false;
    let oscDamped = false;
    let newHwBare = 0.0;
    let newHw = 0.0;
    let totalDry = 0, mProp = 0;

    for (let it = 0; it < 30; it++) {
      totalDry = scDry + eng.engineMassKg + hwMass;
      mProp = totalDry * (Math.exp(dv / ve) - 1.0);

      pick = findLightestTank(mProp, eng.fuel, fuelTanks, maxTanks, ullage);
      if (pick === null) return null;
      const { tank, count, volEachL } = pick;

      const propTankMass = tank.massAtVolume(volEachL) * count;
      // Pressurant sized to LIQUID volume expelled, not tank volume
      const propVolL = mProp / PROPELLANT_DENSITY[eng.fuel];

      pressResult = sizePressurantDiscrete({
        propVolumeL: propVolL,
        feedPressureBar: eng.feedPressureBar,
      });

      newHwBare = propTankMass + pressResult.totalPressSystemKg;
      newHw = newHwBare * (1.0 + hwMargin);

      trace.push({
        iter: it + 1,
        totalDryKg: totalDry,
        mPropKg: mProp,
        hwMassKg: newHw,
        hwBareKg: newHwBare,
        tankModel: tank.model,
        tankCount: count,
        tankVolEachL: volEachL,
      });

      // Strict convergence
      if (Math.abs(newHw - hwMass) < 0.01) {
        converged = true;
        hwMass = newHw;
        break;
      }
      // Oscillation damping (converge.py trick)
      if (it >= 2 && Math.abs(newHw - prevPrev) < 0.1) {
        newHw = Math.max(newHw, hwMass);
        trace[trace.length - 1].oscillationDamped = true;
        converged = true;
        oscDamped = true;
        hwMass = newHw;
        break;
      }

      prevPrev = hwMass;
      hwMass = newHw;
    }

    // Final recompute with converged hw
    totalDry = scDry + eng.engineMassKg + hwMass;
    mProp = totalDry * (Math.exp(dv / ve) - 1.0);
    const wet = totalDry + mProp;

    return {
      engine: eng,
      fuelTank: pick.tank,
      fuelTankCount: pick.count,
      fuelTankVolEachL: pick.volEachL,
      oxTank: null,
      oxTankCount: 0,
      oxTankVolEachL: 0,
      engineMassKg: eng.engineMassKg,
      fuelTankMassKg: pick.tank.massAtVolume(pick.volEachL) * pick.count,
      oxTankMassKg: 0,
      pressurant: pressResult,
      pressSystemMassKg: pressResult.totalPressSystemKg,
      propellantMassKg: mProp,
      fuelMassKg: mProp,
      oxMassKg: 0,
      totalPropSystemMassKg: eng.engineMassKg + hwMass + mProp,
      totalWetMassKg: wet,
      propSystemFraction: (eng.engineMassKg + hwMass + mProp) / wet,
      // Solver metadata
      hwMarginApplied: hwMargin,
      hwMassBareKg: newHwBare,
      hwMassMarginedKg: hwMass,
      converged,
      oscillationDamped: oscDamped,
      iterations: trace.length,
      trace,
    };
  }

  // Biprop solver: engine + fuel tank(s) + ox tank(s) + pressurant.
  // Splits propellant by mixture ratio, sizes fuel and ox tankage separately.
  function solveBiprop({ scDry, dv, eng, fuelTanks, oxTanks, ullage = 0.10, maxTanks = 4, hwMargin = 0.0 }) {
    const ve = eng.ispS * G0;
    const mr = eng.mixtureRatio;
    let hwMass = 0.0;
    let prevPrev = 0.0;
    let fuelPick = null;
    let oxPick = null;
    let pressResult = null;
    const trace = [];
    let converged = false;
    let oscDamped = false;
    let newHwBare = 0.0;
    let newHw = 0.0;
    let totalDry = 0, mPropTotal = 0, mOx = 0, mFuel = 0;

    for (let it = 0; it < 30; it++) {
      totalDry = scDry + eng.engineMassKg + hwMass;
      mPropTotal = totalDry * (Math.exp(dv / ve) - 1.0);
      mOx = mPropTotal * mr / (1 + mr);
      mFuel = mPropTotal / (1 + mr);

      fuelPick = findLightestTank(mFuel, eng.fuel, fuelTanks, maxTanks, ullage);
      oxPick   = findLightestTank(mOx,   eng.oxidizer, oxTanks, maxTanks, ullage);
      if (fuelPick === null || oxPick === null) return null;

      const fuelTankMass = fuelPick.tank.massAtVolume(fuelPick.volEachL) * fuelPick.count;
      const oxTankMass   = oxPick.tank.massAtVolume(oxPick.volEachL)     * oxPick.count;

      // Pressurant sized to LIQUID volumes, not tank volumes
      const totalPropVol = (mFuel / PROPELLANT_DENSITY[eng.fuel]) +
                           (mOx   / PROPELLANT_DENSITY[eng.oxidizer]);

      pressResult = sizePressurantDiscrete({
        propVolumeL: totalPropVol,
        feedPressureBar: eng.feedPressureBar,
      });

      newHwBare = fuelTankMass + oxTankMass + pressResult.totalPressSystemKg;
      newHw = newHwBare * (1.0 + hwMargin);

      trace.push({
        iter: it + 1,
        totalDryKg: totalDry,
        mPropKg: mPropTotal,
        mFuelKg: mFuel,
        mOxKg: mOx,
        hwMassKg: newHw,
        hwBareKg: newHwBare,
        fuelTankModel: fuelPick.tank.model,
        fuelTankCount: fuelPick.count,
        fuelVolEachL: fuelPick.volEachL,
        oxTankModel: oxPick.tank.model,
        oxTankCount: oxPick.count,
        oxVolEachL: oxPick.volEachL,
      });

      if (Math.abs(newHw - hwMass) < 0.01) {
        converged = true;
        hwMass = newHw;
        break;
      }
      if (it >= 2 && Math.abs(newHw - prevPrev) < 0.1) {
        newHw = Math.max(newHw, hwMass);
        trace[trace.length - 1].oscillationDamped = true;
        converged = true;
        oscDamped = true;
        hwMass = newHw;
        break;
      }

      prevPrev = hwMass;
      hwMass = newHw;
    }

    // Final recompute
    totalDry = scDry + eng.engineMassKg + hwMass;
    mPropTotal = totalDry * (Math.exp(dv / ve) - 1.0);
    mOx = mPropTotal * mr / (1 + mr);
    mFuel = mPropTotal / (1 + mr);
    const wet = totalDry + mPropTotal;

    return {
      engine: eng,
      fuelTank: fuelPick.tank,
      fuelTankCount: fuelPick.count,
      fuelTankVolEachL: fuelPick.volEachL,
      oxTank: oxPick.tank,
      oxTankCount: oxPick.count,
      oxTankVolEachL: oxPick.volEachL,
      engineMassKg: eng.engineMassKg,
      fuelTankMassKg: fuelPick.tank.massAtVolume(fuelPick.volEachL) * fuelPick.count,
      oxTankMassKg:   oxPick.tank.massAtVolume(oxPick.volEachL)     * oxPick.count,
      pressurant: pressResult,
      pressSystemMassKg: pressResult.totalPressSystemKg,
      propellantMassKg: mPropTotal,
      fuelMassKg: mFuel,
      oxMassKg: mOx,
      totalPropSystemMassKg: eng.engineMassKg + hwMass + mPropTotal,
      totalWetMassKg: wet,
      propSystemFraction: (eng.engineMassKg + hwMass + mPropTotal) / wet,
      hwMarginApplied: hwMargin,
      hwMassBareKg: newHwBare,
      hwMassMarginedKg: hwMass,
      converged,
      oscillationDamped: oscDamped,
      iterations: trace.length,
      trace,
    };
  }

  window.SOLVER_SIZER = { solveMonoprop, solveBiprop };
})();
