// Checkpoint C: full-solver regression vs Python fixtures.
//
// Loads all solver modules in a Node vm sandbox (fakes `window`), runs each
// golden fixture's mission, and compares top-N configs against Python.
//
// Tolerances:
//   total wet mass:   ±1%
//   tank model / count: exact
//   iteration count:  within ±1
//
// Exit code 0 on full pass, 1 on any failure.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOLVER = __dirname;
const FIXTURES = path.join(SOLVER, 'fixtures');
const MODULES = [
  'tanks-data.js',
  'engines-data.js',
  'constants.js',
  'tanks.js',
  'engines.js',
  'pressurant.js',
  'sizer.js',
  'tradeStudy.js',
];

// Build one sandbox, load all modules
const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
vm.createContext(sandbox);
for (const f of MODULES) {
  const src = fs.readFileSync(path.join(SOLVER, f), 'utf8');
  try {
    vm.runInContext(src, sandbox, { filename: f });
  } catch (e) {
    console.error(`LOAD FAIL: ${f}: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}
console.log(`Loaded ${MODULES.length} modules.`);
console.log(`  SOLVER_TANKS=${sandbox.SOLVER_TANKS.length}  SOLVER_ENGINES=${sandbox.SOLVER_ENGINES.length}`);

// --- Fixture mapping helpers -------------------------------------------
// Python enum names → JS mode/propellant strings (they're identical by design)
const MODE_MAP = { MONOPROP: 'MONOPROP', BIPROP: 'BIPROP', GREEN_MONOPROP: 'GREEN_MONOPROP' };
const PROP_MAP = { N2H4: 'N2H4', MMH: 'MMH', MON: 'MON', WATER: 'WATER', XENON: 'XENON' };

function missionFromFixture(fx) {
  const m = fx.mission;
  const f = fx.filters || {};
  return {
    mission: {
      dryMass: m.sc_dry_mass_kg,
      deltaV: m.delta_v_ms,
      hwMargin: f.hw_margin || 0.0,
      ullage: f.ullage_fraction !== undefined ? f.ullage_fraction : 0.10,
      maxTanks: f.max_tanks_per_role || 4,
    },
    filters: {
      minThrustN:   f.min_thrust_N || 0,
      maxThrustN:   f.max_thrust_N !== undefined ? f.max_thrust_N : Infinity,
      allowedModes: f.allowed_modes ? f.allowed_modes.map(n => MODE_MAP[n]) : null,
      allowedFuels: f.allowed_fuels ? f.allowed_fuels.map(n => PROP_MAP[n]) : null,
      includeDev:   f.include_dev || false,
      excludeItar:  f.exclude_itar || false,
      maxComplexity: f.max_complexity !== undefined ? f.max_complexity : 5,
    },
  };
}

// --- Diff one fixture ---------------------------------------------------
function diffFixture(name) {
  const fx = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
  const { mission, filters } = missionFromFixture(fx);
  const jsResult = sandbox.runTradeStudy(mission, filters);

  const pyConfigs = fx.configs;
  const jsConfigs = jsResult.configs;

  let fails = 0;
  const report = [];

  if (pyConfigs.length !== jsConfigs.length) {
    fails++;
    report.push(`  count mismatch: py=${pyConfigs.length} js=${jsConfigs.length}`);
  }

  // Compare top-N configs pair-by-pair (both are wet-mass sorted)
  const N = Math.min(pyConfigs.length, jsConfigs.length);
  for (let i = 0; i < N; i++) {
    const p = pyConfigs[i];
    const j = jsConfigs[i];
    const pName = `${p.engine.manufacturer} ${p.engine.model}`;
    const jName = `${j.engine.manufacturer} ${j.engine.model}`;

    if (pName !== jName) {
      fails++;
      report.push(`  rank ${i+1}: engine differs — py="${pName}" js="${jName}"`);
      continue;  // downstream comparisons not meaningful
    }

    // Wet mass
    const wetPct = 100 * (j.totalWetMassKg - p.total_wet_mass_kg) / p.total_wet_mass_kg;
    if (Math.abs(wetPct) > 1.0) {
      fails++;
      report.push(`  ${pName}: wet ${j.totalWetMassKg.toFixed(1)} vs py ${p.total_wet_mass_kg.toFixed(1)} (${wetPct.toFixed(2)}%)`);
    }

    // Tank model + count
    if (p.fuel_tank && j.fuelTank) {
      if (p.fuel_tank.model !== j.fuelTank.model) {
        fails++;
        report.push(`  ${pName}: fuel tank model py="${p.fuel_tank.model}" js="${j.fuelTank.model}"`);
      }
      if (p.fuel_tank_count !== j.fuelTankCount) {
        fails++;
        report.push(`  ${pName}: fuel tank count py=${p.fuel_tank_count} js=${j.fuelTankCount}`);
      }
    }
    if (p.ox_tank && j.oxTank) {
      if (p.ox_tank.model !== j.oxTank.model) {
        fails++;
        report.push(`  ${pName}: ox tank model py="${p.ox_tank.model}" js="${j.oxTank.model}"`);
      }
      if (p.ox_tank_count !== j.oxTankCount) {
        fails++;
        report.push(`  ${pName}: ox tank count py=${p.ox_tank_count} js=${j.oxTankCount}`);
      }
    }

    // Iterations within ±1
    if (Math.abs(p.iterations - j.iterations) > 1) {
      fails++;
      report.push(`  ${pName}: iterations py=${p.iterations} js=${j.iterations}`);
    }
  }

  return { fails, report, pyCount: pyConfigs.length, jsCount: jsConfigs.length, jsRuntimeMs: jsResult.meta.runtimeMs };
}

// --- Run checkpoint C (all 6 fixtures) ---
const FIXTURES_TO_CHECK = ['baseline', 'leros', 'cubesat', 'interplanetary', 'itar_free', 'dev_included'];
let totalFails = 0;
console.log('\n=== Checkpoint C: all 6 golden missions ===\n');
for (const name of FIXTURES_TO_CHECK) {
  const res = diffFixture(name);
  const status = res.fails === 0 ? '✓' : '✗';
  console.log(`${status} ${name.padEnd(16)} py=${String(res.pyCount).padStart(3)} js=${String(res.jsCount).padStart(3)}  ${res.jsRuntimeMs.toFixed(1)}ms  fails=${res.fails}`);
  if (res.fails > 0) {
    for (const r of res.report) console.log(r);
  }
  totalFails += res.fails;
}
console.log(`\n${totalFails === 0 ? '✓ ALL PASS' : '✗ ' + totalFails + ' TOTAL MISMATCH' + (totalFails > 1 ? 'ES' : '')}`);
process.exit(totalFails === 0 ? 0 : 1);
