// Pareto scatter: thrust (x) vs wet mass (y), Pareto frontier line
window.buildScatter = function(configs, selectedId, pinned) {
  const W = 820, H = 440;
  const PAD = { l: 64, r: 24, t: 20, b: 46 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const col = {
    grid: '#1a2128',
    axis: '#2e3a44',
    text: '#d7dee4',
    dim: '#8a96a0',
    faint: '#5a6670',
    mono: '#4fd5ff',
    biprop: '#f5b041',
    green: '#6ee06a',
    pareto: '#6ee06a',
    sel: '#6ee06a',
    bg: '#11161a',
  };

  const font = 'font-family="JetBrains Mono, ui-monospace, monospace"';

  // Domain
  const xs = configs.map(c => c.engine.thrust);
  const ys = configs.map(c => c.budget.wet);
  const xMin = 1, xMax = 1200;
  const yMin = Math.floor(Math.min(...ys) - 5), yMax = Math.ceil(Math.max(...ys) + 5);

  // Log X scale
  const lx = v => PAD.l + (Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) * innerW;
  const ly = v => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="scatter-svg" preserveAspectRatio="xMidYMid meet">`);

  // Grid lines (log x)
  [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].forEach(t => {
    parts.push(`<line class="grid" x1="${lx(t)}" y1="${PAD.t}" x2="${lx(t)}" y2="${PAD.t + innerH}" stroke="${col.grid}" stroke-width="0.5"/>`);
  });
  // Grid y
  const yStep = 5;
  for (let v = Math.ceil(yMin/yStep)*yStep; v <= yMax; v += yStep) {
    parts.push(`<line class="grid" x1="${PAD.l}" y1="${ly(v)}" x2="${PAD.l + innerW}" y2="${ly(v)}" stroke="${col.grid}" stroke-width="0.5"/>`);
  }

  // Axes
  parts.push(`<line class="axis" x1="${PAD.l}" y1="${PAD.t + innerH}" x2="${PAD.l + innerW}" y2="${PAD.t + innerH}" stroke="${col.axis}"/>`);
  parts.push(`<line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t + innerH}" stroke="${col.axis}"/>`);

  // X ticks
  [1, 10, 100, 1000].forEach(t => {
    parts.push(`<text class="tick-label" x="${lx(t)}" y="${PAD.t + innerH + 14}" text-anchor="middle" ${font} font-size="9.5" fill="${col.faint}">${t}</text>`);
    parts.push(`<line x1="${lx(t)}" y1="${PAD.t + innerH}" x2="${lx(t)}" y2="${PAD.t + innerH + 4}" stroke="${col.axis}"/>`);
  });
  // Y ticks
  for (let v = Math.ceil(yMin/yStep)*yStep; v <= yMax; v += yStep) {
    parts.push(`<text class="tick-label" x="${PAD.l - 8}" y="${ly(v) + 3}" text-anchor="end" ${font} font-size="9.5" fill="${col.faint}">${v}</text>`);
  }

  // Axis labels
  parts.push(`<text x="${PAD.l + innerW/2}" y="${H - 8}" text-anchor="middle" ${font} font-size="10" fill="${col.dim}" letter-spacing="0.14em">THRUST · N (LOG)</text>`);
  parts.push(`<text x="14" y="${PAD.t + innerH/2}" text-anchor="middle" transform="rotate(-90, 14, ${PAD.t + innerH/2})" ${font} font-size="10" fill="${col.dim}" letter-spacing="0.14em">WET MASS · KG</text>`);

  // Pareto frontier: among configs with pareto=true, sort by thrust ascending, draw step line
  const pareto = configs.filter(c => c.pareto).slice().sort((a, b) => a.engine.thrust - b.engine.thrust);
  if (pareto.length > 1) {
    let d = '';
    pareto.forEach((c, i) => {
      const x = lx(c.engine.thrust), y = ly(c.budget.wet);
      d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
    parts.push(`<path class="pareto-line" d="${d}" stroke="${col.pareto}" stroke-width="1" stroke-dasharray="4 3" fill="none" opacity="0.55"/>`);

    // Label
    const last = pareto[pareto.length - 1];
    parts.push(`<text x="${lx(last.engine.thrust) + 10}" y="${ly(last.budget.wet) - 6}" ${font} font-size="9" fill="${col.pareto}" letter-spacing="0.1em">PARETO FRONTIER</text>`);

    // --- MK 2 missile-lock: outer axis-aligned square + inner 45°-rotated square ---
    if (window.MARK_BLOCK && /MK\s*2/i.test(window.MARK_BLOCK)) {
      const best = configs.find(c => c.id === selectedId) || configs.find(c => c.pareto) || configs[0];
      const cx = lx(best.engine.thrust);
      const cy = ly(best.budget.wet);
      const red = '#ff3a2e';
      const outer = 22;           // outer square half-size (axis-aligned)
      const inner = outer; // inner diamond vertices touch outer edges
      const cl = 9;               // corner L-bracket leg length

      parts.push(`<g class="lock-box" style="mix-blend-mode:screen">`);
      // faint fill
      parts.push(`<rect x="${cx-outer}" y="${cy-outer}" width="${outer*2}" height="${outer*2}" fill="${red}" fill-opacity="0.05" stroke="none"/>`);
      // outer axis-aligned square — 4 corner L-brackets
      const corners = [
        [cx-outer, cy-outer, +1, +1],
        [cx+outer, cy-outer, -1, +1],
        [cx-outer, cy+outer, +1, -1],
        [cx+outer, cy+outer, -1, -1],
      ];
      corners.forEach(([ccx, ccy, dx, dy]) => {
        parts.push(`<path d="M ${ccx} ${ccy + dy*cl} L ${ccx} ${ccy} L ${ccx + dx*cl} ${ccy}" stroke="${red}" stroke-width="1.6" fill="none" stroke-linecap="square"/>`);
      });
      // inner 45°-rotated square (diamond) — full outline, thinner
      parts.push(`<polygon points="${cx},${cy-inner} ${cx+inner},${cy} ${cx},${cy+inner} ${cx-inner},${cy}" fill="none" stroke="${red}" stroke-width="0.9" opacity="0.85"/>`);
      // diamond vertex ticks
      parts.push(`<line x1="${cx}" y1="${cy-inner-3}" x2="${cx}" y2="${cy-inner+3}" stroke="${red}" stroke-width="0.8"/>`);
      parts.push(`<line x1="${cx}" y1="${cy+inner-3}" x2="${cx}" y2="${cy+inner+3}" stroke="${red}" stroke-width="0.8"/>`);
      parts.push(`<line x1="${cx-inner-3}" y1="${cy}" x2="${cx-inner+3}" y2="${cy}" stroke="${red}" stroke-width="0.8"/>`);
      parts.push(`<line x1="${cx+inner-3}" y1="${cy}" x2="${cx+inner+3}" y2="${cy}" stroke="${red}" stroke-width="0.8"/>`);
      // label plate — centered on cx so the middle dot lines up with top vertex
      const labelW = 96;
      const labelY = cy - outer - 6;
      const plateX = cx - labelW / 2;
      parts.push(`<g class="lock-label">`);
      parts.push(`<rect x="${plateX}" y="${labelY - 10}" width="${labelW}" height="12" fill="#0a0d0f" stroke="${red}" stroke-width="0.6"/>`);
      parts.push(`<circle cx="${plateX + 6}" cy="${labelY - 4}" r="2" fill="${red}"><animate attributeName="opacity" values="1;0.2;1" dur="0.9s" repeatCount="indefinite"/></circle>`);
      parts.push(`<text x="${cx}" y="${labelY - 1}" ${font} font-size="8.5" fill="${red}" letter-spacing="0.18em" text-anchor="middle">LOCK · ${best.id}</text>`);
      parts.push(`</g>`);
      parts.push(`</g>`);
    }
  }

  // Points
  configs.forEach(c => {
    const x = lx(c.engine.thrust), y = ly(c.budget.wet);
    const color = c.engine.mode === 'Biprop' ? col.biprop : c.engine.mode === 'Green' ? col.green : col.mono;
    const isSel = c.id === selectedId;
    const isPin = pinned.has(c.id);
    const isPar = c.pareto;
    const r = isSel ? 8 : isPin ? 6 : 5;

    parts.push(`<g class="point${isSel ? ' selected' : ''}" data-id="${c.id}">`);
    if (isSel) {
      parts.push(`<circle cx="${x}" cy="${y}" r="${r + 6}" fill="none" stroke="${col.sel}" stroke-width="0.75" opacity="0.5" stroke-dasharray="2 2"/>`);
    }
    if (isPar) {
      parts.push(`<circle cx="${x}" cy="${y}" r="${r + 3}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.5"/>`);
    }
    parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="${isPin || isSel ? 0.9 : 0.55}" stroke="${color}" stroke-width="${isSel ? 2 : 1}"/>`);
    if (isPin) {
      parts.push(`<circle cx="${x}" cy="${y}" r="2" fill="#0a0d0f"/>`);
    }
    // Label (small)
    parts.push(`<text class="point-label" x="${x + r + 4}" y="${y + 3}" ${font} font-size="9.5" fill="${isSel ? col.text : col.dim}">${c.id}</text>`);
    parts.push(`</g>`);
  });

  // Crosshair for selected
  const sel = configs.find(c => c.id === selectedId);
  if (sel) {
    const x = lx(sel.engine.thrust), y = ly(sel.budget.wet);
    parts.push(`<line x1="${PAD.l}" y1="${y}" x2="${x}" y2="${y}" stroke="${col.sel}" stroke-width="0.5" stroke-dasharray="1 3" opacity="0.6"/>`);
    parts.push(`<line x1="${x}" y1="${PAD.t + innerH}" x2="${x}" y2="${y}" stroke="${col.sel}" stroke-width="0.5" stroke-dasharray="1 3" opacity="0.6"/>`);
  }

  parts.push(`</svg>`);
  return parts.join('');
};
