// Checkpoint B: load constants/tanks-data/engines-data/tanks/engines in a
// Node env and compare against Python reference values. Uses a minimal
// `window` polyfill so the IIFE modules register their globals correctly.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const files = [
  'tanks-data.js',
  'engines-data.js',
  'constants.js',
  'tanks.js',
  'engines.js',
];

// Shared sandbox with a fake `window` = globalThis
const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
}

// --- Assertions -------------------------------------------------------------
let fail = 0;
function assert(cond, msg) {
  if (!cond) { fail++; console.log(`  FAIL: ${msg}`); }
  else       { console.log(`  pass: ${msg}`); }
}

const { SOLVER_TANKS, SOLVER_ENGINES } = sandbox;

console.log('\n=== Checkpoint B ===\n');

// Catalog sizes
assert(SOLVER_TANKS.length === 37, `tank DB has 37 entries (got ${SOLVER_TANKS.length})`);
assert(SOLVER_ENGINES.length === 41, `engine DB has 41 entries (got ${SOLVER_ENGINES.length})`);

// Variable tank interpolation: OST 01/X at 350 L
// Python: 235→16kg, 516→29kg, frac=(350-235)/(516-235)=0.4092, mass=16+0.4092×13=21.32
const ost01 = SOLVER_TANKS.find(t => t.manufacturer === 'ArianeGroup' && t.model === 'OST 01/X');
assert(ost01 && ost01.isVariable, 'OST 01/X exists and is variable');
const m350 = ost01 ? ost01.massAtVolume(350) : null;
const expected350 = 16 + ((350 - 235) / (516 - 235)) * (29 - 16);
assert(m350 !== null && Math.abs(m350 - expected350) < 0.01,
  `OST 01/X massAtVolume(350) = ${m350?.toFixed(2)} (expected ${expected350.toFixed(2)})`);

// Edge: below min → clamp to mmin
assert(ost01 && Math.abs(ost01.massAtVolume(100) - 16.0) < 0.001,
  'OST 01/X massAtVolume(100) clamps to 16.0 kg (below range min)');
// Edge: above max → clamp to mmax
assert(ost01 && Math.abs(ost01.massAtVolume(1000) - 29.0) < 0.001,
  'OST 01/X massAtVolume(1000) clamps to 29.0 kg (above range max)');

// Random engine: LEROS-1b
const leros = SOLVER_ENGINES.find(e => e.model.includes('LEROS-1b'));
assert(leros, 'LEROS-1b engine exists');
if (leros) {
  assert(leros.mode === 'BIPROP', `LEROS-1b mode=BIPROP (got ${leros.mode})`);
  assert(Math.abs(leros.thrustN - 400) < 1, `LEROS-1b thrust = 400 N (got ${leros.thrustN})`);
  assert(leros.ispS === 317, `LEROS-1b Isp = 317 (got ${leros.ispS})`);
  assert(leros.fuel === 'MMH', `LEROS-1b fuel = MMH (got ${leros.fuel})`);
  assert(leros.oxidizer === 'MON', `LEROS-1b ox = MON (got ${leros.oxidizer})`);
  assert(Math.abs(leros.mixtureRatio - 1.65) < 0.001, `LEROS-1b MR = 1.65`);
  assert(Math.abs(leros.engineMassKg - 4.5) < 0.01, `LEROS-1b mass = 4.5 kg`);
  assert(leros.isBiprop === true, 'LEROS-1b isBiprop');
}

// New L3Harris entries: R-4D-15 HiPAT with corrected Isp 322
const hipat = SOLVER_ENGINES.find(e => e.model.includes('R-4D-15 HiPAT'));
assert(hipat, 'R-4D-15 HiPAT exists');
if (hipat) {
  assert(hipat.ispS === 322, `HiPAT Isp = 322 (corrected from 328; got ${hipat.ispS})`);
  assert(hipat.itarRestricted === true, 'HiPAT is ITAR-restricted');
}

// Compatibility helper: LEROS-1b fuel tanks
if (leros) {
  const fuelTanks = leros.fuelTanksFor(SOLVER_TANKS);
  assert(fuelTanks.length > 0, `LEROS-1b has ${fuelTanks.length} compatible fuel tanks`);
  // Spot-check: every compatible fuel tank must have MMH in its propellants
  const allMmh = fuelTanks.every(t => t.compatiblePropellants.includes('MMH'));
  assert(allMmh, 'all LEROS-1b fuel tanks are MMH-compatible');
  // And MEOP ≥ feed×0.9
  const allPressureOk = fuelTanks.every(t => t.meopBar >= leros.feedPressureBar * 0.9);
  assert(allPressureOk, 'all LEROS-1b fuel tanks meet 0.9× MEOP margin');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ ' + fail + ' FAIL'}`);
process.exit(fail === 0 ? 0 : 1);
