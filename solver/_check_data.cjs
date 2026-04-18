// Verify data.js loads correctly after the solver stack and exposes the
// globals app.jsx depends on: CONFIGS, BASELINE, recalcForDV, solveMission.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.dirname(__dirname);
const SOLVER = __dirname;
const MODULES = [
  path.join(SOLVER, 'tanks-data.js'),
  path.join(SOLVER, 'engines-data.js'),
  path.join(SOLVER, 'constants.js'),
  path.join(SOLVER, 'tanks.js'),
  path.join(SOLVER, 'engines.js'),
  path.join(SOLVER, 'pressurant.js'),
  path.join(SOLVER, 'sizer.js'),
  path.join(SOLVER, 'tradeStudy.js'),
  path.join(SOLVER, 'adapter.js'),
  path.join(ROOT, 'data.js'),
];

const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
vm.createContext(sandbox);
for (const f of MODULES) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: path.basename(f) });
}

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('  FAIL: ' + msg); } else console.log('  pass: ' + msg); };

console.log('\n=== data.js load check ===\n');

ok(Array.isArray(sandbox.CONFIGS), 'window.CONFIGS is an array');
ok(sandbox.CONFIGS.length > 0, `CONFIGS has ${sandbox.CONFIGS.length} entries (nonzero)`);
ok(sandbox.BASELINE && sandbox.BASELINE.dryMass === 500, 'BASELINE.dryMass === 500');
ok(sandbox.BASELINE && sandbox.BASELINE.deltaV === 300, 'BASELINE.deltaV === 300');
ok(typeof sandbox.recalcForDV === 'function', 'recalcForDV is a function');
ok(typeof sandbox.solveMission === 'function', 'solveMission is a function');
ok(sandbox.SOLVER_META !== undefined, 'SOLVER_META populated from initial run');

// Sanity: CONFIGS shape matches what app.jsx reads
const c = sandbox.CONFIGS[0];
ok(c.engine && c.engine.mfr && c.engine.model, 'config.engine has mfr+model');
ok(c.fuelTank && typeof c.fuelTank.count === 'number', 'config.fuelTank.count is a number');
ok(c.press && typeof c.press.totalKg === 'number', 'config.press.totalKg is a number');
ok(c.budget && typeof c.budget.wet === 'number', 'config.budget.wet is a number');
ok(typeof c.pareto === 'boolean', 'config.pareto is a bool');
ok(Array.isArray(c.warnings), 'config.warnings is an array');

// recalcForDV against the initial CONFIG at BASELINE should reproduce its wet mass
const r = sandbox.recalcForDV(c, sandbox.BASELINE.deltaV, sandbox.BASELINE.dryMass);
const wetDelta = Math.abs(r.wet - c.budget.wet);
ok(wetDelta < 0.01, `recalcForDV at baseline reproduces wet mass (Δ = ${wetDelta.toFixed(4)} kg)`);

// solveMission at baseline should return the same CONFIGS
const res = sandbox.solveMission({ dryMass: 500, deltaV: 300 }, {});
ok(res.configs.length === sandbox.CONFIGS.length,
   `solveMission returns ${res.configs.length} configs (matches CONFIGS count)`);
ok(res.meta && res.meta.runtimeMs >= 0, 'solveMission returns meta with runtime');

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ ' + fail + ' FAIL'}`);
process.exit(fail === 0 ? 0 : 1);
