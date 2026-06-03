// ─── scene4.js ────────────────────────────────────────────────────────────────
// Scene 4: The Crossroads
// 1. Animates the crossy-lane divider as a Crossy Road scene — horizontal
//    traffic in three lanes with a crosswalk in the center.
// 2. Renders a slope / parallel-coordinates chart comparing the average
//    CO₂ per km (left axis) vs average cost per km (right axis) for every
//    vehicle class.  The user's Scene 1 choice is traced in orange.
// ─────────────────────────────────────────────────────────────────────────────

(function () {

  const USER_COLOR  = "#d07a28";   // orange — user's pick
  const OTHER_COLOR = "#3a6b49";   // green  — all other classes

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CROSSY ROAD TRANSITION ANIMATION
  // ═══════════════════════════════════════════════════════════════════════════

  function initCrossyRoad() {
    const lane = document.querySelector(".crossy-lane");
    if (!lane) return;

    // ── Lane dividers (horizontal rules between traffic rows) ──────────────
    [0.34, 0.67].forEach(frac => {
      const rule = document.createElement("div");
      rule.style.cssText = `
        position:absolute; left:0; right:0;
        top:${frac * 100}%; height:1px;
        background:rgba(255,255,255,0.13);
        pointer-events:none; z-index:2;
      `;
      lane.appendChild(rule);
    });

    // ── Crosswalk stripes (center third of lane, full height) ──────────────
    const cw = document.createElement("div");
    cw.style.cssText = `
      position:absolute; top:0; bottom:0;
      left:50%; transform:translateX(-50%);
      width:52px;
      background:repeating-linear-gradient(
        180deg,
        rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 8px,
        transparent 8px, transparent 17px
      );
      pointer-events:none; z-index:2;
    `;
    lane.appendChild(cw);

    // ── Vehicle definitions ────────────────────────────────────────────────
    // y: fractional vertical position within the lane (0=top, 1=bottom)
    // dir: +1 = right, -1 = left (emoji will be flipped via scaleX)
    // speed: pixels per second
    // x: initial left pixel position
    const VEHICLES = [
      { emoji: "🚗", y: 0.17, dir:  1, speed: 85,  x: 0   },
      { emoji: "🚙", y: 0.17, dir:  1, speed: 85,  x: 260 },
      { emoji: "🚕", y: 0.17, dir:  1, speed: 85,  x: 520 },
      { emoji: "🚌", y: 0.50, dir: -1, speed: 58,  x: 680 },
      { emoji: "🚑", y: 0.50, dir: -1, speed: 72,  x: 350 },
      { emoji: "🏎",  y: 0.83, dir:  1, speed: 145, x: 110 },
      { emoji: "🚐", y: 0.83, dir:  1, speed: 68,  x: 430 },
    ];

    // Create a DOM span for each vehicle
    const carObjs = VEHICLES.map(v => {
      const el = document.createElement("span");
      el.textContent = v.emoji;
      el.style.cssText = `
        position:absolute;
        font-size:17px; line-height:1;
        top:${v.y * 100}%;
        left:${v.x}px;
        pointer-events:none;
        user-select:none;
        z-index:3;
      `;
      lane.appendChild(el);
      return { el, ...v };
    });

    // ── rAF animation loop — paused when off-screen ────────────────────────
    let lastTs = 0;
    let raf    = null;

    function tick(ts) {
      const dt = Math.min((ts - lastTs) / 1000, 0.05); // cap to 50ms
      lastTs   = ts;
      const W  = lane.clientWidth;

      carObjs.forEach(c => {
        c.x += c.dir * c.speed * dt;
        if (c.dir > 0 && c.x >  W + 40) c.x = -40;
        if (c.dir < 0 && c.x < -40)      c.x = W + 40;
        // translateY centres the emoji on the lane row; scaleX flips left-goers
        c.el.style.transform = `translateY(-50%) scaleX(${c.dir})`;
        c.el.style.left      = c.x + "px";
      });

      raf = requestAnimationFrame(tick);
    }

    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        lastTs = performance.now();
        raf    = requestAnimationFrame(tick);
      } else {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
      }
    }, { threshold: 0.05 });

    obs.observe(lane);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SLOPE CHART  — avg CO₂ vs avg cost per vehicle class
  // ═══════════════════════════════════════════════════════════════════════════

  window.onStateReady(function (state) {
    renderSlopeChart(state);
  });

  function renderSlopeChart(state) {
    const container = document.getElementById("scene-4-chart");
    if (!container) return;
    container.innerHTML = "";

    const data = state.allData;
    if (!data || data.length === 0) return;

    const chosenClass = state.vehicleClass; // null before quiz submit

    // ── Aggregate: mean CO₂ and mean cost per vehicle_type ────────────────
    const byClass = d3.rollups(
      data,
      v => ({
        vehicle_type: v[0].vehicle_type,
        avg_co2:  d3.mean(v, d => d.co2_per_km),
        avg_cost: d3.mean(v, d => d.cost_per_km_usd),
      }),
      d => d.vehicle_type
    ).map(([, v]) => v);

    // ── Dimensions ────────────────────────────────────────────────────────
    const W  = 700, H = 460;
    const m  = { top: 72, right: 138, bottom: 52, left: 138 };
    const pw = W - m.left - m.right;
    const ph = H - m.top  - m.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img")
      .attr("aria-label",
        "Slope chart comparing average CO₂ per km and average cost per km for each vehicle class")
      .style("width", "100%");

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // ── Y scales: lower value = better = closer to top (y=0) ─────────────
    const [co2Min,  co2Max]  = d3.extent(byClass, d => d.avg_co2);
    const [costMin, costMax] = d3.extent(byClass, d => d.avg_cost);
    const co2Pad  = (co2Max  - co2Min)  * 0.12;
    const costPad = (costMax - costMin) * 0.12;

    const yLeft  = d3.scaleLinear()
      .domain([co2Max  + co2Pad,  co2Min  - co2Pad])
      .range([ph, 0]);

    const yRight = d3.scaleLinear()
      .domain([costMax + costPad, costMin - costPad])
      .range([ph, 0]);

    const leftX  = 0;
    const rightX = pw;

    // ── Column headers ─────────────────────────────────────────────────────
    const COLS = [
      { x: leftX,  label: "CO₂ per km (kg)",  hint: "← lower is better" },
      { x: rightX, label: "Cost per km (USD)", hint: "lower is better →"  },
    ];
    COLS.forEach(({ x, label, hint }) => {
      g.append("text")
        .attr("x", x).attr("y", -46)
        .attr("text-anchor", "middle")
        .attr("fill", "#1f2a1f")
        .attr("font-family", "Georgia, serif")
        .attr("font-size", "13px")
        .attr("font-weight", "700")
        .text(label);

      g.append("text")
        .attr("x", x).attr("y", -28)
        .attr("text-anchor", "middle")
        .attr("fill", "#3a6b49")
        .attr("font-family", "Georgia, serif")
        .attr("font-size", "10px")
        .attr("font-style", "italic")
        .text(hint);
    });

    // ── Axis column lines ─────────────────────────────────────────────────
    [leftX, rightX].forEach(x => {
      g.append("line")
        .attr("x1", x).attr("y1", 0)
        .attr("x2", x).attr("y2", ph)
        .attr("stroke", "#b9b09f")
        .attr("stroke-width", 1.5);
    });

    // ── Left axis ticks (CO₂) ─────────────────────────────────────────────
    yLeft.ticks(5).forEach(t => {
      const y = yLeft(t);
      g.append("text")
        .attr("x", leftX - 8).attr("y", y + 4)
        .attr("text-anchor", "end")
        .attr("fill", "#8a9980")
        .attr("font-size", "10px")
        .attr("font-family", "Georgia, serif")
        .text(t.toFixed(3));
      g.append("line")
        .attr("x1", leftX - 4).attr("x2", leftX)
        .attr("y1", y).attr("y2", y)
        .attr("stroke", "#b9b09f").attr("stroke-width", 0.8);
    });

    // ── Right axis ticks (Cost) ───────────────────────────────────────────
    yRight.ticks(5).forEach(t => {
      const y = yRight(t);
      g.append("text")
        .attr("x", rightX + 8).attr("y", y + 4)
        .attr("text-anchor", "start")
        .attr("fill", "#8a9980")
        .attr("font-size", "10px")
        .attr("font-family", "Georgia, serif")
        .text("$" + t.toFixed(4));
      g.append("line")
        .attr("x1", rightX).attr("x2", rightX + 4)
        .attr("y1", y).attr("y2", y)
        .attr("stroke", "#b9b09f").attr("stroke-width", 0.8);
    });

    // ── Draw lines — non-user classes first so user line renders on top ────
    const drawOrder = [...byClass].sort((a, b) => {
      if (a.vehicle_type === chosenClass) return 1;
      if (b.vehicle_type === chosenClass) return -1;
      return 0;
    });

    drawOrder.forEach(cls => {
      const isUser  = cls.vehicle_type === chosenClass;
      const color   = isUser ? USER_COLOR : OTHER_COLOR;
      const sw      = isUser ? 3.5 : 2;
      const lineOp  = isUser ? 0.92 : 0.28;
      const dotOp   = isUser ? 1    : 0.5;
      const lblSize = isUser ? "12px" : "11px";
      const lblWt   = isUser ? "700"  : "400";
      const lblOp   = isUser ? 1      : 0.65;
      const suffix  = isUser ? " ★"   : "";

      const y1 = yLeft(cls.avg_co2);
      const y2 = yRight(cls.avg_cost);

      // Connecting line
      g.append("line")
        .attr("x1", leftX).attr("y1", y1)
        .attr("x2", rightX).attr("y2", y2)
        .attr("stroke", color)
        .attr("stroke-width", sw)
        .attr("stroke-opacity", lineOp)
        .attr("stroke-linecap", "round");

      // Endpoint dots
      [[leftX, y1], [rightX, y2]].forEach(([cx, cy]) => {
        g.append("circle")
          .attr("cx", cx).attr("cy", cy)
          .attr("r", isUser ? 6 : 4)
          .attr("fill", color)
          .attr("fill-opacity", dotOp)
          .attr("stroke", "#fffaf2")
          .attr("stroke-width", 1.5);
      });

      // Left label (CO₂ side)
      g.append("text")
        .attr("x", leftX - 14).attr("y", y1 + 4)
        .attr("text-anchor", "end")
        .attr("fill", isUser ? USER_COLOR : "#5b6658")
        .attr("font-size", lblSize)
        .attr("font-weight", lblWt)
        .attr("font-family", "Georgia, serif")
        .attr("opacity", lblOp)
        .text(cls.vehicle_type + suffix);

      // Right label (cost side)
      g.append("text")
        .attr("x", rightX + 14).attr("y", y2 + 4)
        .attr("text-anchor", "start")
        .attr("fill", isUser ? USER_COLOR : "#5b6658")
        .attr("font-size", lblSize)
        .attr("font-weight", lblWt)
        .attr("font-family", "Georgia, serif")
        .attr("opacity", lblOp)
        .text(cls.vehicle_type + suffix);
    });

    // ── Invisible hit areas for hover tooltip ─────────────────────────────
    // A small HTML tooltip div reused across all lines
    let tipDiv = container.querySelector(".s4-tip");
    if (!tipDiv) {
      tipDiv = document.createElement("div");
      tipDiv.className = "tooltip s4-tip";
      tipDiv.setAttribute("hidden", "");
      container.appendChild(tipDiv);
    }

    drawOrder.forEach(cls => {
      const y1 = yLeft(cls.avg_co2);
      const y2 = yRight(cls.avg_cost);

      g.append("line")
        .attr("x1", leftX).attr("y1", y1)
        .attr("x2", rightX).attr("y2", y2)
        .attr("stroke", "transparent")
        .attr("stroke-width", 16)
        .style("cursor", "pointer")
        .on("mouseover", function (event) {
          const rect  = container.getBoundingClientRect();
          const ex    = event.clientX - rect.left;
          const ey    = event.clientY - rect.top;
          const isUser = cls.vehicle_type === chosenClass;

          tipDiv.innerHTML = `
            <strong>${cls.vehicle_type}${isUser ? " ★ your pick" : ""}</strong>
            Avg CO₂: ${cls.avg_co2.toFixed(4)} kg/km<br>
            Avg cost: $${cls.avg_cost.toFixed(5)}/km
          `;
          tipDiv.removeAttribute("hidden");
          tipDiv.style.opacity  = "1";
          tipDiv.style.left     = (ex + 14) + "px";
          tipDiv.style.top      = (ey - 40) + "px";
        })
        .on("mouseout", function () {
          tipDiv.setAttribute("hidden", "");
          tipDiv.style.opacity = "0";
        });
    });

    // ── Footer annotation ─────────────────────────────────────────────────
    g.append("text")
      .attr("x", pw / 2).attr("y", ph + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#8a9980")
      .attr("font-size", "11px")
      .attr("font-family", "Georgia, serif")
      .attr("font-style", "italic")
      .text(
        "A line sloping down → better on emissions, worse on cost — and vice versa"
      );
  }

  // ── Kick off the crossy road animation once the DOM is ready ──────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCrossyRoad);
  } else {
    initCrossyRoad();
  }

})();
