// Mk 1 — vertical ISA-5.1 P&ID
// Compact thumbnail (buildPID) for landing, detailed version (buildPIDDetailed) for dedicated page.

// ═══════════════════════════════════════════════════════════════
//   COMPACT THUMBNAIL — simplified schematic for landing hero
// ═══════════════════════════════════════════════════════════════
window.buildPID = function(cfg) {
  const isBiprop = cfg.oxTank !== null;
  const eng = cfg.engine;
  const ft = cfg.fuelTank;
  const ot = cfg.oxTank;
  const pr = cfg.press;

  const W = 520, H = 460;
  const cx = W / 2;

  const C = {
    stroke: '#8a96a0', dim: '#5a6670', faint: '#3a434a',
    fuel: '#6ee06a', ox: '#f5b041', press: '#c86ccc', eng: '#4fd5ff',
    text: '#d7dee4', tDim: '#8a96a0', tFaint: '#6b757d',
    bg: '#0d1214', bg2: '#11161a', warn: '#ff4a4a',
  };
  const mono = `font-family="JetBrains Mono, ui-monospace, monospace"`;
  const font = `font-family="Barlow Condensed, JetBrains Mono, monospace"`;
  const p = [];

  p.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`);
  p.push(`<defs><pattern id="pgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a2128" stroke-width="0.5"/></pattern></defs>`);
  p.push(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#pgrid)"/>`);

  // corner ticks
  const tk = (x,y,dx,dy) => `<path d="M ${x} ${y+dy} L ${x} ${y} L ${x+dx} ${y}" stroke="${C.dim}" stroke-width="0.75" fill="none"/>`;
  p.push(tk(8,8,12,12)); p.push(tk(W-8,8,-12,12)); p.push(tk(8,H-8,12,-12)); p.push(tk(W-8,H-8,-12,-12));

  // Y bands
  const Y_PRESS=60, Y_REG=125, Y_FILT=160, Y_CHECK=200, Y_TANK=260, Y_LATCH=340, Y_ENG=370;
  const fx = isBiprop ? cx-70 : cx;
  const oxx = isBiprop ? cx+70 : null;

  // Lines
  const hp = (x1,y1,x2,y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.press}" stroke-width="1.5" opacity="0.9"/>`;
  const fp = (x1,y1,x2,y2,c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c||C.fuel}" stroke-width="1.25" opacity="0.9"/>`;
  const dot = (x,y,c) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${c||C.dim}"/>`;

  // Pressurant
  const prR = 28;
  p.push(`<circle cx="${cx}" cy="${Y_PRESS}" r="${prR}" fill="${C.bg2}" stroke="${C.press}" stroke-width="1.5"/>`);
  p.push(`<text x="${cx}" y="${Y_PRESS+5}" text-anchor="middle" ${font} font-size="16" font-weight="500" fill="${C.press}">${pr.gas}</text>`);
  p.push(`<text x="${cx}" y="${Y_PRESS-prR-6}" text-anchor="middle" ${mono} font-size="8" fill="${C.tDim}" letter-spacing="0.14em">TK-1 · ${pr.storeP}b</text>`);
  p.push(hp(cx, Y_PRESS+prR, cx, Y_REG-12));

  // Regulator
  p.push(`<g transform="translate(${cx}, ${Y_REG})">
    <rect x="-16" y="-10" width="32" height="20" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1"/>
    <path d="M -12 -6 L 0 0 L -12 6 Z" fill="none" stroke="${C.stroke}" stroke-width="1"/>
    <path d="M 12 -6 L 0 0 L 12 6 Z" fill="none" stroke="${C.stroke}" stroke-width="1"/>
  </g>`);
  p.push(`<text x="${cx+22}" y="${Y_REG+3}" ${mono} font-size="8" fill="${C.tFaint}">REG · ${pr.feedP.toFixed(1)}b</text>`);
  p.push(hp(cx, Y_REG+10, cx, Y_FILT-8));

  // Filter
  p.push(`<g transform="translate(${cx}, ${Y_FILT})">
    <rect x="-11" y="-7" width="22" height="14" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1"/>
    <line x1="-8" y1="-5" x2="8" y2="5" stroke="${C.stroke}" stroke-width="0.75"/>
    <line x1="-8" y1="5" x2="8" y2="-5" stroke="${C.stroke}" stroke-width="0.75"/>
  </g>`);
  p.push(hp(cx, Y_FILT+7, cx, Y_CHECK-18));

  // T-split + checks
  if (isBiprop) {
    p.push(hp(fx, Y_CHECK-18, oxx, Y_CHECK-18));
    p.push(dot(cx, Y_CHECK-18, C.press));
    p.push(hp(fx, Y_CHECK-18, fx, Y_CHECK-8));
    p.push(hp(oxx, Y_CHECK-18, oxx, Y_CHECK-8));
    [fx, oxx].forEach(x => {
      p.push(`<g transform="translate(${x}, ${Y_CHECK})"><circle r="8" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1"/><path d="M -4 -3 L 4 0 L -4 3 Z" fill="${C.stroke}" opacity="0.7"/></g>`);
    });
    p.push(hp(fx, Y_CHECK+8, fx, Y_TANK-32));
    p.push(hp(oxx, Y_CHECK+8, oxx, Y_TANK-32));
  } else {
    p.push(`<g transform="translate(${cx}, ${Y_CHECK})"><circle r="8" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1"/><path d="M -4 -3 L 4 0 L -4 3 Z" fill="${C.stroke}" opacity="0.7"/></g>`);
    p.push(hp(cx, Y_CHECK-18, cx, Y_CHECK-8));
    p.push(hp(cx, Y_CHECK+8, cx, Y_TANK-32));
  }

  // Tanks
  const tank = (tx,ty,color,letter,ti) => {
    const tw = isBiprop ? 74 : 96, th = 64;
    const out = [];
    out.push(`<rect x="${tx-tw/2}" y="${ty-th/2}" width="${tw}" height="${th}" rx="${tw/2}" fill="${C.bg2}" stroke="${color}" stroke-width="1.5"/>`);
    if (ti.type==='Diaphragm') {
      out.push(`<path d="M ${tx-tw/2+6} ${ty} Q ${tx} ${ty-18} ${tx+tw/2-6} ${ty}" fill="none" stroke="${color}" stroke-width="0.75" opacity="0.5"/>`);
    } else if (ti.type==='PMD') {
      for (let a=0;a<6;a++) { const ang=(a/6)*Math.PI*2; out.push(`<line x1="${tx+5*Math.cos(ang)}" y1="${ty+5*Math.sin(ang)}" x2="${tx+(Math.min(tw,th)/2-8)*Math.cos(ang)}" y2="${ty+(Math.min(tw,th)/2-8)*Math.sin(ang)}" stroke="${color}" stroke-width="0.5" opacity="0.45"/>`); }
    }
    out.push(`<text x="${tx}" y="${ty+5}" text-anchor="middle" ${font} font-size="18" font-weight="500" fill="${color}">${letter}</text>`);
    out.push(`<text x="${tx}" y="${ty+th/2+12}" text-anchor="middle" ${mono} font-size="8" fill="${C.tDim}">${ti.volL}L · ${ti.meop}b</text>`);
    return out.join('');
  };
  if (isBiprop) { p.push(tank(fx, Y_TANK, C.fuel, 'F', ft)); p.push(tank(oxx, Y_TANK, C.ox, 'O', ot)); }
  else p.push(tank(cx, Y_TANK, C.fuel, 'P', ft));

  // Tank → latch → engine
  const branch = (x, color) => {
    const out = [];
    out.push(fp(x, Y_TANK+32, x, Y_LATCH-8, color));
    out.push(`<g transform="translate(${x}, ${Y_LATCH})"><path d="M -8 -6 L 0 0 L -8 6 Z" fill="${C.bg2}" stroke="${color}" stroke-width="1"/><path d="M 8 -6 L 0 0 L 8 6 Z" fill="${C.bg2}" stroke="${color}" stroke-width="1"/></g>`);
    out.push(fp(x, Y_LATCH+6, x, Y_ENG, color));
    return out.join('');
  };
  if (isBiprop) {
    p.push(branch(fx, C.fuel));
    p.push(branch(oxx, C.ox));
    p.push(fp(fx, Y_ENG, oxx, Y_ENG, C.stroke));
    p.push(dot(cx, Y_ENG, C.stroke));
    p.push(fp(cx, Y_ENG, cx, Y_ENG+10, C.stroke));
  } else {
    p.push(branch(cx, C.fuel));
  }

  // Engine
  const eW=50, eH=24, nW=38, nH=40;
  p.push(`<g>
    <rect x="${cx-eW/2}" y="${Y_ENG+10}" width="${eW}" height="${eH}" fill="${C.bg2}" stroke="${C.eng}" stroke-width="1.5"/>
    <polygon points="${cx-eW/2},${Y_ENG+10+eH} ${cx+eW/2},${Y_ENG+10+eH} ${cx+nW},${Y_ENG+10+eH+nH} ${cx-nW},${Y_ENG+10+eH+nH}" fill="${C.bg2}" stroke="${C.eng}" stroke-width="1.5"/>
    <text x="${cx}" y="${Y_ENG+10+eH/2+4}" text-anchor="middle" ${mono} font-size="9" fill="${C.eng}" font-weight="600">E-1</text>
  </g>`);
  // Engine label right
  p.push(`<text x="${cx+nW+12}" y="${Y_ENG+20}" ${mono} font-size="9" fill="${C.text}">${eng.mfr}</text>`);
  p.push(`<text x="${cx+nW+12}" y="${Y_ENG+32}" ${mono} font-size="9" fill="${C.text}">${eng.model}</text>`);
  p.push(`<text x="${cx+nW+12}" y="${Y_ENG+44}" ${mono} font-size="8" fill="${C.tDim}">${eng.thrust}N · ${eng.isp}s</text>`);

  // Exhaust
  for (let i=0;i<3;i++) {
    const y0 = Y_ENG+10+eH+nH;
    p.push(`<line x1="${cx-8+i*8}" y1="${y0}" x2="${cx-14+i*14}" y2="${y0+18}" stroke="#ff8a5c" stroke-width="1" stroke-dasharray="3 2" opacity="0.6"/>`);
  }

  // Feed-margin (corner)
  const margin = ft.meop > 0 && eng.feedP > 0 ? ((ft.meop - eng.feedP) / eng.feedP) : 0;
  const mCol = margin < 0.1 ? C.warn : margin < 0.3 ? C.ox : C.fuel;
  p.push(`<g transform="translate(18, ${H-58})">
    <rect x="0" y="0" width="126" height="42" fill="${C.bg2}" stroke="${C.dim}" stroke-width="0.5"/>
    <text x="8" y="13" ${mono} font-size="7.5" fill="${C.tFaint}" letter-spacing="0.14em">FEED MARGIN</text>
    <text x="8" y="30" ${mono} font-size="15" fill="${mCol}">${(margin*100).toFixed(0)}%</text>
    <text x="56" y="24" ${mono} font-size="7.5" fill="${C.tFaint}">tk ${ft.meop}b</text>
    <text x="56" y="34" ${mono} font-size="7.5" fill="${C.tFaint}">eng ${eng.feedP.toFixed(1)}b</text>
  </g>`);

  // "Click to expand" hint
  p.push(`<g transform="translate(${W-150}, ${H-28})">
    <text x="0" y="0" ${mono} font-size="8" fill="${C.tFaint}" letter-spacing="0.14em">▶ OPEN DETAILED P&amp;ID</text>
  </g>`);

  p.push(`</svg>`);
  return p.join('');
};


// ═══════════════════════════════════════════════════════════════
//   DETAILED — full ISA-5.1 schematic for dedicated page
// ═══════════════════════════════════════════════════════════════
window.buildPIDDetailed = function(cfg) {
  const isBiprop = cfg.oxTank !== null;
  const eng = cfg.engine;
  const ft = cfg.fuelTank;
  const ot = cfg.oxTank;
  const pr = cfg.press;

  const W = 480, H = 960;
  const cx = W / 2;

  const C = {
    stroke: '#8a96a0',
    dim: '#5a6670',
    faint: '#3a434a',
    fuel: '#6ee06a',
    ox:   '#f5b041',
    press: '#c86ccc',
    eng:  '#4fd5ff',
    text: '#d7dee4',
    tDim: '#8a96a0',
    tFaint: '#6b757d',
    bg:   '#0d1214',
    bg2:  '#11161a',
    warn: '#ff4a4a',
    zone: '#2a3238',
  };

  const font = `font-family="Barlow Condensed, JetBrains Mono, ui-monospace, monospace"`;
  const monoFont = `font-family="JetBrains Mono, ui-monospace, monospace"`;
  const p = [];

  p.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`);

  // Grid
  p.push(`<defs>
    <pattern id="pgrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a2128" stroke-width="0.5"/>
    </pattern>
  </defs>`);
  p.push(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#pgrid)"/>`);

  // Corner ticks
  const tick = (x,y,dx,dy) => `<path d="M ${x} ${y+dy} L ${x} ${y} L ${x+dx} ${y}" stroke="${C.dim}" stroke-width="0.75" fill="none"/>`;
  p.push(tick(10,10,14,14));
  p.push(tick(W-10,10,-14,14));
  p.push(tick(10,H-10,14,-14));
  p.push(tick(W-10,H-10,-14,-14));

  // Header strip — thin, single line
  p.push(`<text x="14" y="22" ${monoFont} font-size="9" fill="${C.tDim}" letter-spacing="0.14em">PID-${cfg.id}-R01 · ${isBiprop?'BIPROP':'MONO'} · REGULATED</text>`);
  p.push(`<text x="${W-14}" y="22" ${monoFont} font-size="9" fill="${eng.itar?C.warn:C.tFaint}" letter-spacing="0.14em" text-anchor="end">${eng.itar?'ITAR · 9A004':'EAR-99'}</text>`);

  // ═══════════════════════════════════════════════════════════════
  //                      PRIMITIVES
  // ═══════════════════════════════════════════════════════════════

  const valve = (x,y,tag,label,color,opts={}) => {
    const {hand=false, state='open'} = opts;
    const col = color || C.stroke;
    const closed = state === 'closed';
    const g = [];
    g.push(`<g transform="translate(${x}, ${y})">`);
    g.push(`<path d="M -10 -7 L 0 0 L -10 7 Z" fill="${closed?col:C.bg2}" stroke="${col}" stroke-width="1.1" opacity="${closed?0.6:1}"/>`);
    g.push(`<path d="M 10 -7 L 0 0 L 10 7 Z" fill="${closed?col:C.bg2}" stroke="${col}" stroke-width="1.1" opacity="${closed?0.6:1}"/>`);
    if (hand) {
      g.push(`<line x1="0" y1="0" x2="0" y2="-11" stroke="${col}" stroke-width="1"/>`);
      g.push(`<line x1="-5" y1="-11" x2="5" y2="-11" stroke="${col}" stroke-width="1"/>`);
    }
    g.push(`</g>`);
    if (tag) g.push(`<text x="${x+15}" y="${y-3}" ${monoFont} font-size="8.5" fill="${C.tDim}" letter-spacing="0.08em">${tag}</text>`);
    if (label) g.push(`<text x="${x+15}" y="${y+7}" ${monoFont} font-size="7.5" fill="${C.tFaint}">${label}</text>`);
    return g.join('');
  };

  const pyro = (x,y,tag,state,color) => {
    const g = [];
    const armed = state === 'armed' || state === 'fired';
    const col = state === 'fired' ? C.fuel : armed ? '#f5b041' : (color||C.stroke);
    g.push(`<g transform="translate(${x}, ${y})">`);
    g.push(`<rect x="-9" y="-9" width="18" height="18" fill="${C.bg2}" stroke="${col}" stroke-width="1.1"/>`);
    g.push(`<path d="M -9 -9 L 9 9 L 9 -9 Z" fill="${col}" opacity="${state==='fired'?0.5:0.22}"/>`);
    g.push(`<text x="0" y="3" text-anchor="middle" ${monoFont} font-size="7.5" fill="${col}" font-weight="600">PV</text>`);
    g.push(`</g>`);
    if (tag) g.push(`<text x="${x+15}" y="${y-3}" ${monoFont} font-size="8.5" fill="${C.tDim}" letter-spacing="0.08em">${tag}</text>`);
    g.push(`<text x="${x+15}" y="${y+7}" ${monoFont} font-size="7.5" fill="${C.tFaint}" letter-spacing="0.08em">${state.toUpperCase()}</text>`);
    return g.join('');
  };

  const check = (x,y,tag) => {
    const g = [];
    g.push(`<g transform="translate(${x}, ${y})">`);
    g.push(`<circle r="9" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1.1"/>`);
    g.push(`<path d="M -5 -4 L 5 0 L -5 4 Z" fill="${C.stroke}" opacity="0.75"/>`);
    g.push(`<line x1="5" y1="-5" x2="5" y2="5" stroke="${C.stroke}" stroke-width="1.1"/>`);
    g.push(`</g>`);
    if (tag) g.push(`<text x="${x+14}" y="${y+3}" ${monoFont} font-size="8.5" fill="${C.tDim}" letter-spacing="0.08em">${tag}</text>`);
    return g.join('');
  };

  const regulator = (x,y,tag,label) => {
    const g = [];
    g.push(`<g transform="translate(${x}, ${y})">`);
    g.push(`<rect x="-18" y="-12" width="36" height="24" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1.1"/>`);
    g.push(`<path d="M -14 -7 L 0 0 L -14 7 Z" fill="none" stroke="${C.stroke}" stroke-width="1.1"/>`);
    g.push(`<path d="M 14 -7 L 0 0 L 14 7 Z" fill="none" stroke="${C.stroke}" stroke-width="1.1"/>`);
    // spring
    g.push(`<path d="M 0 -12 L 0 -18" stroke="${C.stroke}" stroke-width="1"/>`);
    g.push(`<path d="M -5 -18 L 5 -20 L -5 -22 L 5 -24 L -5 -26" fill="none" stroke="${C.stroke}" stroke-width="0.75"/>`);
    g.push(`<path d="M -5 -26 L 5 -26" stroke="${C.stroke}" stroke-width="1"/>`);
    g.push(`</g>`);
    if (tag) g.push(`<text x="${x+24}" y="${y-3}" ${monoFont} font-size="8.5" fill="${C.tDim}" letter-spacing="0.08em">${tag}</text>`);
    if (label) g.push(`<text x="${x+24}" y="${y+8}" ${monoFont} font-size="7.5" fill="${C.tFaint}">${label}</text>`);
    return g.join('');
  };

  const relief = (x,y,tag,setP) => {
    const g = [];
    g.push(`<g transform="translate(${x}, ${y})">`);
    g.push(`<rect x="-7" y="-5" width="14" height="10" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1"/>`);
    g.push(`<path d="M 7 0 L 15 -7" stroke="${C.stroke}" stroke-width="1"/>`);
    g.push(`<path d="M 11 -10 L 15 -7 L 19 -10" fill="none" stroke="${C.stroke}" stroke-width="1"/>`);
    g.push(`<path d="M 0 -5 L 0 -9" stroke="${C.stroke}" stroke-width="1"/>`);
    g.push(`<path d="M -3 -9 L 3 -11 L -3 -13 L 3 -15" fill="none" stroke="${C.stroke}" stroke-width="0.75"/>`);
    g.push(`</g>`);
    if (tag) g.push(`<text x="${x+22}" y="${y-5}" ${monoFont} font-size="7.5" fill="${C.tFaint}" letter-spacing="0.08em">${tag}</text>`);
    if (setP) g.push(`<text x="${x+22}" y="${y+4}" ${monoFont} font-size="7.5" fill="${C.tFaint}">set ${setP}b</text>`);
    return g.join('');
  };

  const filter = (x,y,tag) => {
    const g = [];
    g.push(`<g transform="translate(${x}, ${y})">`);
    g.push(`<rect x="-13" y="-9" width="26" height="18" fill="${C.bg2}" stroke="${C.stroke}" stroke-width="1.1"/>`);
    g.push(`<line x1="-10" y1="-6" x2="10" y2="6" stroke="${C.stroke}" stroke-width="0.75"/>`);
    g.push(`<line x1="-10" y1="0" x2="10" y2="0" stroke="${C.stroke}" stroke-width="0.75" stroke-dasharray="1 1"/>`);
    g.push(`<line x1="-10" y1="6" x2="10" y2="-6" stroke="${C.stroke}" stroke-width="0.75"/>`);
    g.push(`</g>`);
    if (tag) g.push(`<text x="${x+18}" y="${y+3}" ${monoFont} font-size="8.5" fill="${C.tDim}" letter-spacing="0.08em">${tag}</text>`);
    return g.join('');
  };

  const instrument = (x,y,type,num,val,opts={}) => {
    const {anchor='right'} = opts;
    const g = [];
    g.push(`<circle cx="${x}" cy="${y}" r="12" fill="${C.bg}" stroke="${C.stroke}" stroke-width="0.9"/>`);
    g.push(`<line x1="${x-12}" y1="${y}" x2="${x+12}" y2="${y}" stroke="${C.stroke}" stroke-width="0.5"/>`);
    g.push(`<text x="${x}" y="${y-2}" text-anchor="middle" ${monoFont} font-size="7.5" fill="${C.text}" font-weight="600">${type}</text>`);
    g.push(`<text x="${x}" y="${y+9}" text-anchor="middle" ${monoFont} font-size="7.5" fill="${C.tDim}">${num}</text>`);
    if (val) {
      const vx = anchor==='right' ? x+18 : x-18;
      const va = anchor==='right' ? 'start' : 'end';
      g.push(`<text x="${vx}" y="${y+3}" text-anchor="${va}" ${monoFont} font-size="10" fill="${C.fuel}" font-weight="500">${val}</text>`);
    }
    return g.join('');
  };

  const hp = (x1,y1,x2,y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.press}" stroke-width="1.75" opacity="0.9"/>`;
  const fp = (x1,y1,x2,y2,color) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color||C.fuel}" stroke-width="1.35" opacity="0.9"/>`;
  const sig = (x1,y1,x2,y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.dim}" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.8"/>`;
  const dot = (x,y,color) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${color||C.dim}"/>`;

  // ═══════════════════════════════════════════════════════════════
  //                      LAYOUT
  // ═══════════════════════════════════════════════════════════════

  const fx = isBiprop ? cx - 60 : cx;
  const oxx = isBiprop ? cx + 60 : null;

  // Vertical bands
  const Y_HDR    = 50;
  const Y_PRESS  = 120;
  const Y_FDV1   = Y_PRESS;
  const Y_PYRO1  = 210;
  const Y_REGA   = 255;
  const Y_REGB   = 305;
  const Y_FILT   = 355;
  const Y_TSPLIT = 395;
  const Y_CHECK  = 425;
  const Y_TANK   = 545;
  const Y_PYRO2  = 645;
  const Y_LATCH  = 685;
  const Y_ENG_PT = 725;
  const Y_MANI   = 750;
  const Y_ENG    = 770;

  // Zone labels (no boxes — just tagged on the left rail)
  const zoneLabel = (y, label) => `<g>
    <line x1="14" y1="${y}" x2="32" y2="${y}" stroke="${C.zone}" stroke-width="0.75"/>
    <line x1="14" y1="${y}" x2="14" y2="${y+70}" stroke="${C.zone}" stroke-width="0.75"/>
    <text x="18" y="${y-4}" ${monoFont} font-size="7" fill="${C.tFaint}" letter-spacing="0.18em">${label}</text>
  </g>`;
  p.push(zoneLabel(Y_HDR+20, 'ZONE 1 · PRESSURANT'));
  p.push(zoneLabel(Y_TSPLIT-20, 'ZONE 2 · PROPELLANT'));
  p.push(zoneLabel(Y_PYRO2-30, 'ZONE 3 · TCA'));

  // ═══════════════════════════════════════════════════════════════
  //                      PRESSURANT
  // ═══════════════════════════════════════════════════════════════

  const prR = 38;
  p.push(`<g>
    <circle cx="${cx}" cy="${Y_PRESS}" r="${prR}" fill="${C.bg2}" stroke="${C.press}" stroke-width="1.5"/>
    <ellipse cx="${cx}" cy="${Y_PRESS}" rx="${prR-5}" ry="11" fill="none" stroke="${C.press}" stroke-width="0.5" opacity="0.45"/>
    <ellipse cx="${cx}" cy="${Y_PRESS}" rx="11" ry="${prR-5}" fill="none" stroke="${C.press}" stroke-width="0.5" opacity="0.45"/>
    <text x="${cx}" y="${Y_PRESS+6}" text-anchor="middle" ${font} font-size="22" font-weight="500" fill="${C.press}">${pr.gas}</text>
  </g>`);
  p.push(`<text x="${cx}" y="${Y_PRESS-prR-12}" text-anchor="middle" ${monoFont} font-size="9" fill="${C.tDim}" letter-spacing="0.14em">TK-1 · PRESSURANT · COPV</text>`);
  p.push(`<text x="${cx}" y="${Y_PRESS-prR-2}" text-anchor="middle" ${monoFont} font-size="8" fill="${C.tFaint}">${pr.tankL.toFixed(1)}L · ${pr.storeP}b MEOP · ${pr.tankKg.toFixed(2)}kg</text>`);

  // PT-1 / TT-1 — right side
  p.push(instrument(cx+prR+28, Y_PRESS-14, 'PT', '1', `${pr.storeP}b`));
  p.push(sig(cx+prR, Y_PRESS-14, cx+prR+16, Y_PRESS-14));
  p.push(instrument(cx+prR+28, Y_PRESS+14, 'TT', '1', '+18°C'));
  p.push(sig(cx+prR, Y_PRESS+14, cx+prR+16, Y_PRESS+14));

  // FDV-1 — left side
  p.push(valve(cx-prR-20, Y_PRESS, 'FDV-1', 'fill/vent', C.stroke, {hand:true}));
  p.push(hp(cx-prR-10, Y_PRESS, cx-prR, Y_PRESS));

  // Relief off top
  p.push(relief(cx-prR+8, Y_PRESS-prR+6, 'RV-1', pr.storeP+30));
  p.push(hp(cx-prR+14, Y_PRESS-prR+14, cx-prR+8, Y_PRESS-prR+6));

  // Line to Pyro-1
  p.push(hp(cx, Y_PRESS+prR, cx, Y_PYRO1-10));
  p.push(pyro(cx, Y_PYRO1, 'PV-1', 'armed', C.press));

  // Line to Reg A
  p.push(hp(cx, Y_PYRO1+10, cx, Y_REGA-12));
  p.push(regulator(cx, Y_REGA, 'REG-A', `set ${pr.feedP.toFixed(1)}b`));

  // Reg A → Reg B
  p.push(hp(cx, Y_REGA+12, cx, Y_REGB-12));
  p.push(regulator(cx, Y_REGB, 'REG-B', `set ${(pr.feedP+0.3).toFixed(1)}b (bu)`));

  // PT-2 between regs
  p.push(instrument(cx-60, Y_REGA+25, 'PT', '2', `${pr.feedP.toFixed(1)}b`, {anchor:'left'}));
  p.push(sig(cx-18, Y_REGA+25, cx-48, Y_REGA+25));

  // Reg B → Filter
  p.push(hp(cx, Y_REGB+12, cx, Y_FILT-9));
  p.push(filter(cx, Y_FILT, 'FL-1 · 10µ'));

  // ═══════════════════════════════════════════════════════════════
  //                      PROPELLANT FEED
  // ═══════════════════════════════════════════════════════════════

  if (isBiprop) {
    p.push(hp(cx, Y_FILT+9, cx, Y_TSPLIT));
    p.push(hp(fx, Y_TSPLIT, oxx, Y_TSPLIT));
    p.push(dot(cx, Y_TSPLIT, C.press));
    p.push(hp(fx, Y_TSPLIT, fx, Y_CHECK-9));
    p.push(hp(oxx, Y_TSPLIT, oxx, Y_CHECK-9));
    // paired check valves
    p.push(check(fx-10, Y_CHECK, ''));
    p.push(check(fx+10, Y_CHECK, 'CK-1F'));
    p.push(hp(fx-10, Y_CHECK-9, fx+10, Y_CHECK-9));
    p.push(hp(fx-10, Y_CHECK+9, fx+10, Y_CHECK+9));
    p.push(check(oxx-10, Y_CHECK, ''));
    p.push(check(oxx+10, Y_CHECK, 'CK-1O'));
    p.push(hp(oxx-10, Y_CHECK-9, oxx+10, Y_CHECK-9));
    p.push(hp(oxx-10, Y_CHECK+9, oxx+10, Y_CHECK+9));
    // to tanks
    p.push(hp(fx, Y_CHECK+9, fx, Y_TANK-44));
    p.push(hp(oxx, Y_CHECK+9, oxx, Y_TANK-44));
  } else {
    p.push(hp(cx, Y_FILT+9, cx, Y_CHECK-9));
    p.push(check(cx-10, Y_CHECK, ''));
    p.push(check(cx+10, Y_CHECK, 'CK-1'));
    p.push(hp(cx-10, Y_CHECK-9, cx+10, Y_CHECK-9));
    p.push(hp(cx-10, Y_CHECK+9, cx+10, Y_CHECK+9));
    p.push(hp(cx, Y_CHECK+9, cx, Y_TANK-44));
  }

  // Tanks
  const drawTank = (tx,ty,color,letter,label,ti,isMono) => {
    const tw = isMono ? 120 : 90;
    const th = 90;
    const rxr = tw/2;
    const g = [];
    g.push(`<rect x="${tx-tw/2}" y="${ty-th/2}" width="${tw}" height="${th}" rx="${rxr}" fill="${C.bg2}" stroke="${color}" stroke-width="1.5"/>`);
    if (ti.type==='Diaphragm') {
      g.push(`<path d="M ${tx-tw/2+8} ${ty} Q ${tx} ${ty-24} ${tx+tw/2-8} ${ty}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>`);
    } else if (ti.type==='PMD') {
      for (let a=0;a<8;a++) {
        const ang=(a/8)*Math.PI*2, r1=8, r2=Math.min(tw,th)/2-12;
        g.push(`<line x1="${tx+r1*Math.cos(ang)}" y1="${ty+r1*Math.sin(ang)}" x2="${tx+r2*Math.cos(ang)}" y2="${ty+r2*Math.sin(ang)}" stroke="${color}" stroke-width="0.5" opacity="0.45"/>`);
      }
      g.push(`<circle cx="${tx}" cy="${ty}" r="6" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.45"/>`);
    } else if (ti.type==='Surface Tension') {
      for (let i=0;i<4;i++) {
        g.push(`<line x1="${tx-tw/2+10}" y1="${ty+8+i*4}" x2="${tx+tw/2-10}" y2="${ty+8+i*4}" stroke="${color}" stroke-width="0.4" opacity="0.45"/>`);
      }
    }
    g.push(`<text x="${tx}" y="${ty+7}" text-anchor="middle" ${font} font-size="26" font-weight="500" fill="${color}">${letter}</text>`);
    g.push(`<text x="${tx}" y="${ty-th/2-9}" text-anchor="middle" ${monoFont} font-size="9" fill="${C.tDim}" letter-spacing="0.14em">${label} · TK-${letter==='F'?'2':letter==='P'?'2':'3'}</text>`);
    g.push(`<text x="${tx}" y="${ty+th/2+14}" text-anchor="middle" ${monoFont} font-size="8.5" fill="${C.tDim}">${ti.mfr} ${ti.model}</text>`);
    g.push(`<text x="${tx}" y="${ty+th/2+24}" text-anchor="middle" ${monoFont} font-size="8" fill="${C.tFaint}">${ti.volL}L · ${ti.dry.toFixed(1)}kg · ${ti.meop}b · ${ti.type}</text>`);
    return g.join('');
  };

  if (isBiprop) {
    p.push(drawTank(fx, Y_TANK, C.fuel, 'F', 'FUEL', ft, false));
    p.push(drawTank(oxx, Y_TANK, C.ox, 'O', 'OXIDIZER', ot, false));
  } else {
    p.push(drawTank(cx, Y_TANK, C.fuel, 'P', 'PROPELLANT', ft, true));
  }

  // Tank instrumentation
  const tankInstr = (tx,ty,tw,color,side,iPT,iTT,iRV,iFDV,ti) => {
    const sg = side==='left' ? -1 : 1;
    const g = [];
    const ix = tx + sg*(tw/2+24);
    g.push(instrument(ix, ty-16, 'PT', iPT, `${ti.meop}b`, {anchor: side==='left'?'left':'right'}));
    g.push(sig(tx+sg*(tw/2), ty-16, ix-sg*12, ty-16));
    g.push(instrument(ix, ty+16, 'TT', iTT, '+20°C', {anchor: side==='left'?'left':'right'}));
    g.push(sig(tx+sg*(tw/2), ty+16, ix-sg*12, ty+16));
    // relief at top
    g.push(relief(tx+sg*(tw/2-8), ty-(90/2+6), iRV, ti.meop+3));
    g.push(fp(tx, ty-(90/2), tx+sg*(tw/2-8), ty-(90/2+6), color));
    return g.join('');
  };

  if (isBiprop) {
    p.push(tankInstr(fx, Y_TANK, 90, C.fuel, 'left',  '3F', '2F', 'RV-2F', 'FDV-2F', ft));
    p.push(tankInstr(oxx, Y_TANK, 90, C.ox,  'right', '3O', '2O', 'RV-2O', 'FDV-2O', ot));
  } else {
    p.push(tankInstr(cx, Y_TANK, 120, C.fuel, 'right', '3', '2', 'RV-2', 'FDV-2', ft));
  }

  // ═══════════════════════════════════════════════════════════════
  //                      ENGINE BRANCH
  // ═══════════════════════════════════════════════════════════════

  const drawBranch = (bx, color, pTag, lTag, ptTag, curFeed) => {
    const g = [];
    g.push(fp(bx, Y_TANK+45, bx, Y_PYRO2-10, color));
    g.push(pyro(bx, Y_PYRO2, pTag, 'armed', color));
    g.push(fp(bx, Y_PYRO2+10, bx, Y_LATCH-8, color));
    g.push(valve(bx, Y_LATCH, lTag, 'latch', color));
    g.push(fp(bx, Y_LATCH+8, bx, Y_ENG_PT, color));
    // engine-inlet PT
    const side = bx < cx ? 'left' : 'right';
    const sg = side==='left' ? -1 : 1;
    g.push(instrument(bx + sg*32, Y_ENG_PT, 'PT', ptTag, `${curFeed}b`, {anchor:side}));
    g.push(sig(bx + sg*12, Y_ENG_PT, bx + sg*20, Y_ENG_PT));
    g.push(fp(bx, Y_ENG_PT+12, bx, Y_MANI, color));
    return g.join('');
  };

  if (isBiprop) {
    p.push(drawBranch(fx, C.fuel, 'PV-2F', 'LV-F', '4F', eng.feedP.toFixed(1)));
    p.push(drawBranch(oxx, C.ox,  'PV-2O', 'LV-O', '4O', eng.feedP.toFixed(1)));
    p.push(fp(fx, Y_MANI, oxx, Y_MANI, C.stroke));
    p.push(fp(cx, Y_MANI, cx, Y_ENG, C.stroke));
    p.push(dot(cx, Y_MANI, C.stroke));
  } else {
    p.push(drawBranch(cx, C.fuel, 'PV-2', 'LV-1', '4', eng.feedP.toFixed(1)));
    p.push(fp(cx, Y_MANI, cx, Y_ENG, C.stroke));
  }

  // Engine
  const eW=62, eH=30, nW=48, nH=52;
  p.push(`<g>
    <rect x="${cx-eW/2}" y="${Y_ENG}" width="${eW}" height="${eH}" fill="${C.bg2}" stroke="${C.eng}" stroke-width="1.5"/>
    <polygon points="${cx-eW/2},${Y_ENG+eH} ${cx+eW/2},${Y_ENG+eH} ${cx+nW},${Y_ENG+eH+nH} ${cx-nW},${Y_ENG+eH+nH}" fill="${C.bg2}" stroke="${C.eng}" stroke-width="1.5"/>
    <line x1="${cx-eW/2+6}" y1="${Y_ENG+eH/2}" x2="${cx+eW/2-6}" y2="${Y_ENG+eH/2}" stroke="${C.eng}" stroke-width="0.5" opacity="0.5"/>
    <text x="${cx}" y="${Y_ENG+eH/2+4}" text-anchor="middle" ${monoFont} font-size="9" fill="${C.eng}" font-weight="600" letter-spacing="0.12em">E-1</text>
  </g>`);

  // Chamber PT (Pc)
  p.push(instrument(cx+nW+22, Y_ENG+eH/2, 'PT', '5', `Pc ${(eng.feedP*0.78).toFixed(1)}b`, {anchor:'right'}));
  p.push(sig(cx+eW/2, Y_ENG+eH/2, cx+nW+10, Y_ENG+eH/2));

  // Engine spec block — on left of engine
  p.push(`<g transform="translate(14, ${Y_ENG-14})">
    <rect x="0" y="0" width="136" height="78" fill="${C.bg2}" stroke="${C.dim}" stroke-width="0.5"/>
    <rect x="0" y="0" width="136" height="14" fill="${C.bg}"/>
    <text x="6" y="10" ${monoFont} font-size="7.5" fill="${C.tDim}" letter-spacing="0.16em">ENGINE · E-1</text>
    <text x="6" y="26" ${monoFont} font-size="9.5" fill="${C.text}" font-weight="500">${eng.mfr}</text>
    <text x="6" y="38" ${monoFont} font-size="9.5" fill="${C.text}" font-weight="500">${eng.model}</text>
    <text x="6" y="52" ${monoFont} font-size="8" fill="${C.tDim}">${eng.thrust}N · ${eng.isp}s Isp</text>
    <text x="6" y="63" ${monoFont} font-size="8" fill="${C.tDim}">feed ${eng.feedP.toFixed(1)}b · ${eng.mass.toFixed(2)}kg</text>
    <text x="6" y="74" ${monoFont} font-size="7.5" fill="${eng.itar?C.warn:C.tFaint}" letter-spacing="0.08em">${eng.itar?'⚠ ITAR 9A004':eng.mode.toUpperCase()+' · COTS'}</text>
  </g>`);

  // Exhaust
  for (let i=0;i<5;i++) {
    const y0 = Y_ENG+eH+nH;
    p.push(`<line x1="${cx-16+i*8}" y1="${y0+3}" x2="${cx-24+i*12}" y2="${y0+26}" stroke="#ff8a5c" stroke-width="1" stroke-dasharray="2 2" opacity="0.55"/>`);
  }

  // Feed-margin callout — bottom-right
  const margin = ft.meop > 0 && eng.feedP > 0 ? ((ft.meop - eng.feedP) / eng.feedP) : 0;
  const mCol = margin < 0.1 ? C.warn : margin < 0.3 ? C.ox : C.fuel;
  p.push(`<g transform="translate(${W-170}, ${Y_ENG+40})">
    <rect x="0" y="0" width="156" height="54" fill="${C.bg2}" stroke="${C.dim}" stroke-width="0.5"/>
    <rect x="0" y="0" width="156" height="14" fill="${C.bg}"/>
    <text x="6" y="10" ${monoFont} font-size="7.5" fill="${C.tDim}" letter-spacing="0.16em">FEED MARGIN</text>
    <text x="6" y="36" ${monoFont} font-size="22" fill="${mCol}" font-weight="500">${(margin*100).toFixed(0)}%</text>
    <text x="64" y="30" ${monoFont} font-size="7.5" fill="${C.tFaint}">tank ${ft.meop}b</text>
    <text x="64" y="41" ${monoFont} font-size="7.5" fill="${C.tFaint}">eng ${eng.feedP.toFixed(1)}b</text>
  </g>`);

  p.push(`</svg>`);
  return p.join('');
};
