// Propulsion trade-study solver — constants module.
// Ported from tank_selector.py. Exposes all module globals under window.SOLVER_CONSTANTS
// and individually on window. Safe to load before other solver modules.

(function () {
  'use strict';

  // Standard gravity, m/s^2
  const G0 = 9.80665;

  // Propellant enum (string-based; matches Python enum names)
  const Propellant = {
    N2H4:  'N2H4',   // Hydrazine
    MMH:   'MMH',    // Monomethylhydrazine
    MON:   'MON',    // Mixed Oxides of Nitrogen / NTO (MON-3)
    WATER: 'WATER',
    XENON: 'XENON',
  };

  // Densities at ~20°C, kg/L.
  // NOTE literature values are 1.004 (N2H4) and 1.443 (MON-3). We use the
  // rounded project-consistent values so results match the Python side exactly.
  const PROPELLANT_DENSITY = {
    [Propellant.N2H4]:  1.01,
    [Propellant.MMH]:   0.878,
    [Propellant.MON]:   1.45,
    [Propellant.WATER]: 1.000,
    [Propellant.XENON]: 1.640,
  };

  // Default monopropellant Isp per propellant
  const DEFAULT_ISP = {
    [Propellant.N2H4]: 230,   // catalytic decomposition
    [Propellant.MMH]:  310,   // biprop fuel side
    [Propellant.MON]:  310,   // biprop ox side (rarely used as mono)
  };

  // Propulsion mode enum (string-based; matches Python enum names)
  const PropulsionMode = {
    MONOPROP:        'MONOPROP',
    BIPROP:          'BIPROP',
    GREEN_MONOPROP:  'GREEN_MONOPROP',
  };

  // Gas constants for pressurant sizing, J/(kg·K)
  const R_HE = 2077.0;
  const R_N2 = 296.8;
  const T_STORE = 293.0;

  // He compressibility factor (non-ideal gas): Z ≈ 1 + 5.77e-4·P(bar) at 293K
  // From virial coefficient B ≈ 11.8 cm³/mol.
  function heCompressibility(pressureBar /* , T_K = 293 */) {
    return 1.0 + 0.000577 * pressureBar;
  }

  // Namespaced export (preferred) + a few convenience globals
  window.SOLVER_CONSTANTS = {
    G0,
    Propellant,
    PROPELLANT_DENSITY,
    DEFAULT_ISP,
    PropulsionMode,
    R_HE,
    R_N2,
    T_STORE,
    heCompressibility,
  };
})();
