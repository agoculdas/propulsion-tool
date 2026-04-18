// Propulsion System Trade Tool — mock trade study data
// Hardware pulled from agoculdas/Spacecraft tank_selector.py
// Each config is a full optimizer output: engine + tanks + pressurant + mass budget
// for a nominal 500 kg dry mass / 300 m/s delta-V mission.

window.CONFIGS = [
  { id: 'C01', engine: { mfr:'MOOG', model:'MONARC-22', mode:'Mono', thrust:22, isp:229, mass:0.60, feedP:7.0, heritage:'Worldview, Landsat 8', status:'COTS', itar:true, cx:1 },
    fuelTank:{ mfr:'MT Aerospace', model:'PTD-96', type:'Diaphragm', count:1, volL:96, dry:8.2, meop:24.0, dia:545, len:685, heritage:'Seastar, Goktürk, EnMap', status:'Delta', material:'Ti-6Al-4V' },
    oxTank:null,
    press:{ gas:'He', storeP:310, feedP:7.0, tankL:0.9, tankKg:0.6, gasKg:0.10, totalKg:0.70 },
    budget:{ dry:500, eng:0.60, fTk:8.2, oTk:0, prs:0.70, prop:67.8, wet:577.30, frac:0.134 },
    warnings:[{sev:'INFO', msg:'Engine is ITAR / export restricted.'}], pareto:true },

  { id: 'C02', engine: { mfr:'ArianeGroup', model:'CHT-20N', mode:'Mono', thrust:20, isp:228, mass:0.65, feedP:22.0, heritage:'Eurostar, MSG, CosmoSkyMed', status:'COTS', itar:false, cx:2 },
    fuelTank:{ mfr:'MT Aerospace', model:'PTD-96', type:'Diaphragm', count:1, volL:96, dry:8.2, meop:24.0, dia:545, len:685, heritage:'Seastar, Goktürk, EnMap', status:'Delta', material:'Ti-6Al-4V' },
    oxTank:null,
    press:{ gas:'He', storeP:310, feedP:22.0, tankL:3.4, tankKg:1.9, gasKg:0.19, totalKg:2.09 },
    budget:{ dry:500, eng:0.65, fTk:8.2, oTk:0, prs:2.09, prop:68.6, wet:579.54, frac:0.137 },
    warnings:[{sev:'CAUTION', msg:'Feed pressure margin 9% — below 10%. Risk of regulator droop.'}], pareto:true },

  { id: 'C03', engine: { mfr:'ArianeGroup', model:'CHT-400N', mode:'Mono', thrust:400, isp:230, mass:1.80, feedP:22.0, heritage:'Ariane 5 RCS (170+ units)', status:'COTS', itar:false, cx:2 },
    fuelTank:{ mfr:'MT Aerospace', model:'PTD-177', type:'Diaphragm', count:1, volL:177, dry:15.5, meop:24.0, dia:655, len:827, heritage:'Herschel, Sentinel 3, Euclid', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:null,
    press:{ gas:'He', storeP:310, feedP:22.0, tankL:3.2, tankKg:1.8, gasKg:0.18, totalKg:1.98 },
    budget:{ dry:500, eng:1.80, fTk:15.5, oTk:0, prs:1.98, prop:68.1, wet:587.38, frac:0.149 },
    warnings:[], pareto:true },

  { id: 'C04', engine: { mfr:'MOOG', model:'MONARC-445', mode:'Mono', thrust:445, isp:234, mass:2.50, feedP:14.0, heritage:'Curiosity Sky Crane, LCROSS', status:'COTS', itar:true, cx:2 },
    fuelTank:{ mfr:'MT Aerospace', model:'PTD-177', type:'Diaphragm', count:1, volL:177, dry:15.5, meop:24.0, dia:655, len:827, heritage:'Herschel, Sentinel 3, Euclid', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:null,
    press:{ gas:'He', storeP:310, feedP:14.0, tankL:5.8, tankKg:2.6, gasKg:0.27, totalKg:2.87 },
    budget:{ dry:500, eng:2.50, fTk:15.5, oTk:0, prs:2.87, prop:66.9, wet:587.77, frac:0.150 },
    warnings:[{sev:'INFO', msg:'Engine is ITAR / export restricted.'}], pareto:true },

  { id: 'C05', engine: { mfr:'ArianeGroup', model:'S400-15', mode:'Biprop', thrust:420, isp:318, mass:3.60, feedP:15.5, heritage:'Eurostar 3000, Alphabus', status:'COTS', itar:false, cx:3 },
    fuelTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    press:{ gas:'He', storeP:310, feedP:15.5, tankL:12.8, tankKg:4.6, gasKg:0.52, totalKg:5.12 },
    budget:{ dry:500, eng:3.60, fTk:16.0, oTk:16.0, prs:5.12, prop:49.6, wet:590.32, frac:0.153 },
    warnings:[], pareto:true },

  { id: 'C06', engine: { mfr:'L3Harris', model:'HiPAT', mode:'Biprop', thrust:445, isp:328, mass:5.20, feedP:17.0, heritage:'MESSENGER, Dawn', status:'COTS', itar:true, cx:3 },
    fuelTank:{ mfr:'ArianeGroup', model:'OST 21/0', type:'PMD', count:1, volL:235, dry:16.0, meop:22.0, dia:750, len:850, heritage:'AMOS', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:{ mfr:'ArianeGroup', model:'OST 21/0', type:'PMD', count:1, volL:235, dry:16.0, meop:22.0, dia:750, len:850, heritage:'AMOS', status:'COTS', material:'Ti-6Al-4V' },
    press:{ gas:'He', storeP:310, feedP:17.0, tankL:11.4, tankKg:4.2, gasKg:0.48, totalKg:4.68 },
    budget:{ dry:500, eng:5.20, fTk:16.0, oTk:16.0, prs:4.68, prop:47.9, wet:589.78, frac:0.152 },
    warnings:[{sev:'INFO', msg:'Engine is ITAR / export restricted.'}], pareto:true },

  { id: 'C07', engine: { mfr:'Nammo', model:'LEROS-1b', mode:'Biprop', thrust:400, isp:317, mass:4.50, feedP:15.5, heritage:'Mars Express, Rosetta, ExoMars TGO', status:'COTS', itar:false, cx:3 },
    fuelTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    press:{ gas:'He', storeP:310, feedP:15.5, tankL:12.8, tankKg:4.6, gasKg:0.52, totalKg:5.12 },
    budget:{ dry:500, eng:4.50, fTk:16.0, oTk:16.0, prs:5.12, prop:49.8, wet:591.42, frac:0.155 },
    warnings:[], pareto:false },

  { id: 'C08', engine: { mfr:'L3Harris', model:'R-4D-11', mode:'Biprop', thrust:490, isp:312, mass:3.80, feedP:14.0, heritage:'Apollo SPS heritage, Orion ESM', status:'COTS', itar:true, cx:3 },
    fuelTank:{ mfr:'ArianeGroup', model:'OST 21/0', type:'PMD', count:1, volL:235, dry:16.0, meop:22.0, dia:750, len:850, heritage:'AMOS', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:{ mfr:'ArianeGroup', model:'OST 21/0', type:'PMD', count:1, volL:235, dry:16.0, meop:22.0, dia:750, len:850, heritage:'AMOS', status:'COTS', material:'Ti-6Al-4V' },
    press:{ gas:'He', storeP:310, feedP:14.0, tankL:10.3, tankKg:3.9, gasKg:0.43, totalKg:4.33 },
    budget:{ dry:500, eng:3.80, fTk:16.0, oTk:16.0, prs:4.33, prop:50.8, wet:590.93, frac:0.154 },
    warnings:[{sev:'INFO', msg:'Engine is ITAR / export restricted.'}], pareto:false },

  { id: 'C09', engine: { mfr:'IHI', model:'BT-4', mode:'Biprop', thrust:450, isp:326, mass:4.20, feedP:16.9, heritage:'US GEO, Japanese platforms', status:'COTS', itar:true, cx:4 },
    fuelTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    press:{ gas:'He', storeP:310, feedP:16.9, tankL:12.1, tankKg:4.4, gasKg:0.50, totalKg:4.90 },
    budget:{ dry:500, eng:4.20, fTk:16.0, oTk:16.0, prs:4.90, prop:48.3, wet:589.40, frac:0.152 },
    warnings:[{sev:'CAUTION', msg:'Non-standard N2H4/MON combination — reduced flight heritage.'},
              {sev:'INFO', msg:'Engine is ITAR / export restricted.'}], pareto:true },

  { id: 'C10', engine: { mfr:'Bradford', model:'22N HPGP', mode:'Green', thrust:22, isp:252, mass:1.10, feedP:22.0, heritage:'In qualification (LMP-103S)', status:'COTS', itar:false, cx:5 },
    fuelTank:{ mfr:'MT Aerospace', model:'PTD-96', type:'Diaphragm', count:1, volL:96, dry:8.2, meop:24.0, dia:545, len:685, heritage:'Seastar, Goktürk, EnMap', status:'Delta', material:'Ti-6Al-4V' },
    oxTank:null,
    press:{ gas:'He', storeP:310, feedP:22.0, tankL:3.2, tankKg:1.8, gasKg:0.18, totalKg:1.98 },
    budget:{ dry:500, eng:1.10, fTk:8.2, oTk:0, prs:1.98, prop:62.0, wet:573.28, frac:0.128 },
    warnings:[{sev:'CAUTION', msg:'Green monoprop — ADN-based, special material compat required.'}], pareto:true },

  { id: 'C11', engine: { mfr:'ArianeGroup', model:'S22-01', mode:'Biprop', thrust:22, isp:295, mass:0.65, feedP:15.0, heritage:'ATV, Eurostar, MSG', status:'COTS', itar:false, cx:3 },
    fuelTank:{ mfr:'ArianeGroup', model:'OST 31/0', type:'PMD', count:1, volL:177, dry:6.85, meop:24.6, dia:500, len:500, heritage:'Globalstar', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    press:{ gas:'He', storeP:310, feedP:15.0, tankL:11.5, tankKg:4.2, gasKg:0.48, totalKg:4.68 },
    budget:{ dry:500, eng:0.65, fTk:6.85, oTk:16.0, prs:4.68, prop:53.2, wet:581.38, frac:0.140 },
    warnings:[{sev:'CAUTION', msg:'Asymmetric tank pair — fuel and oxidizer mass capacities differ.'}], pareto:true },

  { id: 'C12', engine: { mfr:'MOOG', model:'MONARC-90', mode:'Mono', thrust:90, isp:226, mass:1.00, feedP:14.0, heritage:'Orbital mnvr / deorbit', status:'COTS', itar:true, cx:2 },
    fuelTank:{ mfr:'MT Aerospace', model:'PTD-96', type:'Diaphragm', count:1, volL:96, dry:8.2, meop:24.0, dia:545, len:685, heritage:'Seastar, Goktürk, EnMap', status:'Delta', material:'Ti-6Al-4V' },
    oxTank:null,
    press:{ gas:'He', storeP:310, feedP:14.0, tankL:5.8, tankKg:2.6, gasKg:0.27, totalKg:2.87 },
    budget:{ dry:500, eng:1.00, fTk:8.2, oTk:0, prs:2.87, prop:69.3, wet:581.37, frac:0.140 },
    warnings:[{sev:'INFO', msg:'Engine is ITAR / export restricted.'}], pareto:false },

  { id: 'C13', engine: { mfr:'Nammo', model:'LEROS-4', mode:'Biprop', thrust:1000, isp:323, mass:6.00, feedP:17.0, heritage:'ESA planetary (under qual)', status:'Dev', itar:false, cx:5 },
    fuelTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    oxTank:{ mfr:'ArianeGroup', model:'OST 01/X 235L', type:'PMD', count:1, volL:235, dry:16.0, meop:19.5, dia:750, len:766, heritage:'TV-Sat, TDF', status:'COTS', material:'Ti-6Al-4V' },
    press:{ gas:'He', storeP:310, feedP:17.0, tankL:13.2, tankKg:4.8, gasKg:0.55, totalKg:5.35 },
    budget:{ dry:500, eng:6.00, fTk:16.0, oTk:16.0, prs:5.35, prop:48.9, wet:592.25, frac:0.156 },
    warnings:[{sev:'CAUTION', msg:'Engine status: Under Development — qualification not complete.'}], pareto:false },
];

// Baseline mission params
window.BASELINE = { dryMass: 500, deltaV: 300, g0: 9.80665 };

// Sensitivity: how wet mass scales with ΔV at fixed dry + Isp
// Δm_prop/m_wet depends on Isp; compute reactive budget for slider
window.recalcForDV = function(cfg, newDV, dryMassOverride) {
  const g0 = 9.80665;
  const ve = cfg.engine.isp * g0;
  const baseDry = (dryMassOverride != null ? dryMassOverride : cfg.budget.dry);
  const dry = baseDry + cfg.budget.eng + cfg.budget.fTk + cfg.budget.oTk + cfg.budget.prs;
  const mp = dry * (Math.exp(newDV / ve) - 1);
  const wet = dry + mp;
  return { prop: mp, wet: wet, frac: (cfg.budget.eng + cfg.budget.fTk + cfg.budget.oTk + cfg.budget.prs + mp) / wet, dry: baseDry };
};
