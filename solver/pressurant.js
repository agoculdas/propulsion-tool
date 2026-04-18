// Propulsion trade-study solver — pressurant module.
// Depends on: constants.js.
//
// Sizes regulated pressurant systems. Matches tank_selector.py's
// size_pressurant + size_pressurant_discrete exactly.

(function () {
  'use strict';

  const { G0, R_HE, R_N2, T_STORE, heCompressibility } = window.SOLVER_CONSTANTS;

  // MT Aerospace PVG catalog (real procurement sizes).
  // Larger sizes (100L, 120L) are delta-qualification.
  const PVG_CATALOG = [
    { volumeL: 40,  massKg: 9.0 },
    { volumeL: 50,  massKg: 11.5 },
    { volumeL: 65,  massKg: 13.0 },
    { volumeL: 75,  massKg: 14.4 },
    { volumeL: 100, massKg: 16.5 },
    { volumeL: 120, massKg: 18.0 },
  ];

  // Continuous pressurant sizing (PV/W COPV scaling). Used directly for gas
  // mass; tank mass gets discretized via sizePressurantDiscrete below.
  //
  // Physics:
  //   Isothermal expansion: V_press = P_feed × V_prop / (P_store - P_feed)
  //   Gas mass:             m_gas = P_store × V_press / (Z × R × T)
  //   COPV tank mass:       m_tank = P·V / (PVW × g0), with PVW scaling from
  //                         MT Aerospace PVG family (capped at 17 km for
  //                         larger tanks).
  function sizePressurant({
    propVolumeL,
    feedPressureBar,
    storagePressureBar = 310.0,
    gas = 'He',
    temperatureK = 293.0,
  }) {
    // Fallback if caller accidentally passed feed >= store
    if (storagePressureBar <= feedPressureBar) {
      storagePressureBar = feedPressureBar * 10;
    }

    const V_prop_m3 = propVolumeL * 1e-3;
    const P_store = storagePressureBar * 1e5;  // Pa
    const P_feed  = feedPressureBar * 1e5;

    const V_press_m3 = P_feed * V_prop_m3 / (P_store - P_feed);
    const V_press_L  = V_press_m3 * 1000;

    let Z, R_gas;
    if (gas === 'He') {
      Z = heCompressibility(storagePressureBar, temperatureK);
      R_gas = R_HE;
    } else {
      Z = 1.0 + 0.00045 * storagePressureBar;  // rough N2 compressibility
      R_gas = R_N2;
    }

    const m_gas = P_store * V_press_m3 / (Z * R_gas * temperatureK);

    // PV/W figure of merit, km → m
    const pvw_km = Math.min(12.0 + 0.06 * V_press_L, 17.0);
    const pvw_m = pvw_km * 1000;
    const m_tank = P_store * V_press_m3 / (pvw_m * G0);

    let source;
    if (V_press_L <= 75)      source = 'MT Aerospace PVG 40-75L family (Ti+CFRP, 310 bar, COTS)';
    else if (V_press_L <= 120) source = 'MT Aerospace PVG 80-120L family (Ti+CFRP, 310 bar, delta qual)';
    else                       source = 'Extrapolated from PVG family scaling (verify for large volumes)';

    return {
      gas,
      propVolumeToPressL: propVolumeL,
      feedPressureBar,
      storagePressureBar,
      pressTankVolumeL: V_press_L,
      gasMassKg: m_gas,
      pressTankDryMassKg: m_tank,
      totalPressSystemKg: m_gas + m_tank,
      pressTankSource: source,
    };
  }

  // Discrete PVG picker. Keeps the continuous sizePressurant's gas mass
  // (correct physics) but snaps tank count to an integer choice from the
  // PVG catalog that minimises total dry mass.
  function sizePressurantDiscrete({
    propVolumeL,
    feedPressureBar,
    storagePressureBar = 310.0,
    gas = 'He',
    temperatureK = 293.0,
  }) {
    const cont = sizePressurant({ propVolumeL, feedPressureBar, storagePressureBar, gas, temperatureK });
    const V_press_needed = cont.pressTankVolumeL;

    let best = null;
    for (const entry of PVG_CATALOG) {
      const n = Math.max(1, Math.ceil(V_press_needed / entry.volumeL));
      const totalMass = n * entry.massKg;
      if (best === null || totalMass < best.totalMass) {
        best = { totalMass, nTanks: n, tankV: entry.volumeL, tankM: entry.massKg };
      }
    }
    const realizedV = best.nTanks * best.tankV;

    return {
      gas,
      propVolumeToPressL: propVolumeL,
      feedPressureBar,
      storagePressureBar,
      pressTankVolumeL: realizedV,
      gasMassKg: cont.gasMassKg,
      pressTankDryMassKg: best.totalMass,
      totalPressSystemKg: cont.gasMassKg + best.totalMass,
      pressTankSource: `${best.nTanks}× MT Aerospace PVG ${best.tankV}L @ ${best.tankM.toFixed(1)}kg each (discrete; needed ${V_press_needed.toFixed(1)}L)`,
      // Extra fields the adapter uses to populate the CONFIGS.press shape
      tankCount: best.nTanks,
      tankVolEachL: best.tankV,
      tankMassEachKg: best.tankM,
    };
  }

  window.SOLVER_PRESSURANT = { PVG_CATALOG, sizePressurant, sizePressurantDiscrete };
})();
