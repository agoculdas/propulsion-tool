// Checkpoint D: adapter output shape + warnings + Pareto flags.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOLVER = __dirname;
const MODULES = [
  'tanks-data.js', 'engines-data.js', 'constants.js',
  'tanks.js', 'engines.js', 'pressurant.js', 'sizer.js',
  'tradeStudy.js', 'adapter.js',
];

const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
vm.createContext(sandbox);
for (const f of MODULES) {
  vm.runInContext(fs.readFileSync(path.join(SOLVER, f), 'utf8'), sandbox, { filename: f });
}

let fail = 0;
function assert(cond, msg) {
  if (!cond) { fail++; console.log(`  FAIL: ${msg}`); }
  else       { console.log(`  pass: ${msg}`); }
}

console.log('\n=== Checkpoint D ===\n');

const { CONFIGS, meta } = sandbox.SOLVER_ADAPTER.adaptTradeStudy(
  { dryMass: 500, deltaV: 300 },
  {}
);

console.log(`adapted ${CONFIGS.length} configs in ${meta.runtimeMs.toFixed(1)}ms\n`);

// --- SHAPE CHECK ---
const expectedKeys = ['id','engine','fuelTank','oxTank','press','budget','warnings','pareto','solver','_solver'];
const sample = CONFIGS[0];
for (const k of expectedKeys) {
  assert(k in sample, `config has key "${k}"`);
}

// Engine sub-shape
const engKeys = ['mfr','model','mode','thrust','isp','mass','feedP','heritage','status','itar','cx'];
for (const k of engKeys) assert(k in sample.engine, `engine has key "${k}"`);
assert(['Mono','Biprop','Green'].includes(sample.engine.mode), `engine.mode is frontend string (got "${sample.engine.mode}")`);

// Fuel tank sub-shape
const tkKeys = ['mfr','model','type','count','volL','dry','meop','dia','len','heritage','status','material'];
for (const k of tkKeys) assert(k in sample.fuelTank, `fuelTank has key "${k}"`);

// Press sub-shape
const prKeys = ['gas','storeP','feedP','tankL','tankKg','gasKg','totalKg','tankCount','tankVolEachL'];
for (const k of prKeys) assert(k in sample.press, `press has key "${k}"`);

// Budget sub-shape
const bgKeys = ['dry','eng','fTk','oTk','prs','prop','wet','frac'];
for (const k of bgKeys) assert(k in sample.budget, `budget has key "${k}"`);
assert(sample.budget.dry === 500, `budget.dry threaded from mission (got ${sample.budget.dry})`);

// Slug IDs
const ids = new Set(CONFIGS.map(c => c.id));
assert(ids.size === CONFIGS.length, `all config IDs are unique (${ids.size} unique / ${CONFIGS.length})`);
assert([...ids].every(id => /^[a-z0-9-]+$/.test(id)), 'all IDs match /^[a-z0-9-]+$/');
const sampleIds = [...ids].slice(0, 5);
console.log(`  sample IDs: ${sampleIds.join(', ')}`);

// --- WARNINGS ---
// ITAR engine must get an INFO warning
const l3h = CONFIGS.find(c => c.engine.mfr === 'L3Harris');
assert(l3h !== undefined, 'some L3Harris engine present');
if (l3h) {
  const itarWarn = l3h.warnings.find(w => w.msg.includes('ITAR'));
  assert(itarWarn && itarWarn.sev === 'INFO', 'L3Harris config has ITAR INFO warning');
}

// No Dev-status engines in baseline run (include_dev=false)
const devConfigs = CONFIGS.filter(c => c.engine.status === 'Under Development');
assert(devConfigs.length === 0, `baseline has 0 Dev engines (got ${devConfigs.length})`);

// Force dev_included to get a dev engine with CAUTION
const dev = sandbox.SOLVER_ADAPTER.adaptTradeStudy(
  { dryMass: 500, deltaV: 300 },
  { includeDev: true }
);
const devOne = dev.CONFIGS.find(c => c.engine.status === 'Under Development');
assert(devOne !== undefined, 'dev_included contains a Dev-status engine');
if (devOne) {
  const devWarn = devOne.warnings.find(w => w.msg.includes('Under Development'));
  assert(devWarn && devWarn.sev === 'CAUTION',
    `Dev engine has CAUTION "Under Development" warning`);
}

// --- PARETO FLAGS ---
const paretoCount = CONFIGS.filter(c => c.pareto).length;
const dominated = CONFIGS.filter(c => !c.pareto).length;
console.log(`  pareto flags: ${paretoCount}/${CONFIGS.length} Pareto-optimal (${dominated} dominated)`);
assert(paretoCount >= 1, 'at least one Pareto-optimal config');
assert(paretoCount < CONFIGS.length, 'some configs are dominated (not all Pareto)');

// Spot-check: config with lowest wet mass must be Pareto (nothing dominates it on wet)
const cheapest = CONFIGS.reduce((a, b) => a.budget.wet < b.budget.wet ? a : b);
assert(cheapest.pareto === true,
  `cheapest config (${cheapest.engine.mfr} ${cheapest.engine.model}, ${cheapest.budget.wet.toFixed(1)}kg) is Pareto`);

// Spot-check: config with highest thrust must be Pareto (nothing dominates on thrust)
const strongest = CONFIGS.reduce((a, b) => a.engine.thrust > b.engine.thrust ? a : b);
assert(strongest.pareto === true,
  `highest-thrust config (${strongest.engine.mfr} ${strongest.engine.model}, ${strongest.engine.thrust}N) is Pareto`);

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ ' + fail + ' FAIL'}`);
process.exit(fail === 0 ? 0 : 1);
