// ─── scene2.js ────────────────────────────────────────────────────────────────
// Scene 2: "Hitting the Road"
// Renders a CO₂-per-km vs cost-per-km scatterplot into #scene-2-chart.
// Reads window.STATE (set by scene1.js) via window.onStateReady().
// Re-renders cleanly on every notifyAll() call so quiz changes are reflected.
// ─────────────────────────────────────────────────────────────────────────────

(function () {

  const FUEL_COLORS = {
    Hybrid:  "#3a6b49",   
    Diesel:  "#7a6b3a",   
    Petrol:  "#9b3a2a",   
  };

  // ── Register with the shared state bus ──────────────────────────────────────
  window.onStateReady(function (state) {
    render(state);
  });

  // ── Main render ─────────────────────────────────────────────────────────────
  function render(state) {
    const container = document.getElementById("scene-2-chart");
    if (!container) return;

    // Clear previous render
    container.innerHTML = "";

    const data = state.allData;
    if (!data || data.length === 0) return;

    const chosenClass = state.vehicleClass; // e.g. "SUV" or null before quiz submit

    // ── Dimensions ────────────────────────────────────────────────────────────
    const totalW  = container.getBoundingClientRect().width || 760;
    const totalH  = 420;
    const margin  = { top: 28, right: 32, bottom: 68, left: 72 };
    const innerW  = totalW - margin.left - margin.right;
    const innerH  = totalH - margin.top - margin.bottom;

    // ── SVG ───────────────────────────────────────────────────────────────────
    const svg = d3.select(container)
      .append("svg")
        .attr("width",  totalW)
        .attr("height", totalH);

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "scene2-frontier-arrowhead")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 8)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z")
        .attr("fill", "#8b917e");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // ── Scales ────────────────────────────────────────────────────────────────
    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.co2_per_km)).nice()
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.cost_per_km_usd)).nice()
      .range([innerH, 0]);

    // ── Subtle grid ───────────────────────────────────────────────────────────
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(yScale).ticks(5)
          .tickSize(-innerW)
          .tickFormat("")
      )
      .call(gg => {
        gg.select(".domain").remove();
        gg.selectAll("line")
          .attr("stroke", "#d9cfbf")
          .attr("stroke-dasharray", "0")
          .attr("stroke-width", 0.8);
      });

    // ── Efficiency frontier hint (bottom-left corner label) ───────────────────
    g.append("line")
      .attr("class", "frontier-line")
      .attr("x1", 0)
      .attr("y1", innerH)
      .attr("x2", innerW * 0.28)
      .attr("y2", innerH * 0.18);

    const frontierCallout = g.append("g")
      .attr("class", "frontier-callout")
      .attr("transform", `translate(${innerW * 0.035}, ${innerH * 0.52})`);

    frontierCallout.append("rect")
      .attr("class", "frontier-box")
      .attr("width", 250)
      .attr("height", 30)
      .attr("rx", 8)
      .attr("ry", 8);

    frontierCallout.append("text")
      .attr("class", "frontier-label")
      .attr("x", 12)
      .attr("y", 20)
      .text("better (lower cost + lower emissions)");

    frontierCallout.append("line")
      .attr("class", "frontier-arrow")
      .attr("x1", 155)
      .attr("y1", 30)
      .attr("x2", 100)
      .attr("y2", 78);

    // ── Axes ──────────────────────────────────────────────────────────────────
    // X axis
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(4));

    g.append("text")
      .attr("class", "axis-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 52)
      .attr("text-anchor", "middle")
      .attr("fill", "#5b6658")
      .attr("font-family", "Georgia, serif")
      .attr("font-size", "0.82rem")
      .text("CO₂ emitted per km (kg)");

    // Y axis
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(yScale).ticks(5).tickSize(4));

    g.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(innerH / 2))
      .attr("y", -56)
      .attr("text-anchor", "middle")
      .attr("fill", "#5b6658")
      .attr("font-family", "Georgia, serif")
      .attr("font-size", "0.82rem")
      .text("Fuel cost per km (USD)");

    // ── Dots ──────────────────────────────────────────────────────────────────
    const dots = g.selectAll(".dot")
      .data(data)
      .join("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.co2_per_km))
        .attr("cy", d => yScale(d.cost_per_km_usd))
        .attr("r", 5)
        .attr("fill", d => FUEL_COLORS[d.fuel_type] || "#888")
        .attr("opacity", 0.65)
        .attr("stroke", "rgba(31,42,31,0.2)")
        .attr("stroke-width", 0.8);

    if (chosenClass) {
      const selected = data.filter(d => d.vehicle_type === chosenClass);
      const highlightedTrips = Array.from(
        d3.group(selected, d => d.fuel_type).values(),
        (fuelTrips) => {
          const avgX = d3.mean(fuelTrips, d => d.co2_per_km);
          const avgY = d3.mean(fuelTrips, d => d.cost_per_km_usd);

          return fuelTrips.reduce((closest, trip) => {
            if (!closest) return trip;

            const closestDistance = Math.hypot(
              closest.co2_per_km - avgX,
              closest.cost_per_km_usd - avgY
            );
            const tripDistance = Math.hypot(
              trip.co2_per_km - avgX,
              trip.cost_per_km_usd - avgY
            );

            return tripDistance < closestDistance ? trip : closest;
          }, null);
        }
      ).filter(Boolean);

      dots
        .filter(d => highlightedTrips.includes(d))
        .attr("fill", "#111")
        .attr("opacity", 1)
        .attr("r", 7)
        .attr("stroke", "#f6f0e7")
        .attr("stroke-width", 2.4)
        .raise();
    }

    // ── Tooltip (reuses .tooltip from style.css) ──────────────────────────────
    const tooltip = d3.select("#scene-2-tooltip");

    dots
      .on("mouseover", function (event, d) {
        d3.select(this).attr("r", 8);
        moveCar(d.co2_per_km);

        tooltip
          .attr("hidden", null)
          .style("opacity", "1")
          .html(`
            <strong>${d.car_name || d.vehicle_type}</strong>
            Fuel: ${d.fuel_type}<br>
            Class: ${d.vehicle_type}<br>
            CO₂: ${d.co2_per_km.toFixed(3)} kg/km<br>
            Cost: $${d.cost_per_km_usd.toFixed(4)}/km
          `);
      })
      .on("mousemove", function (event) {
        // Position tooltip relative to #scene-2-chart container
        const rect = container.getBoundingClientRect();
        const ex   = event.clientX - rect.left;
        const ey   = event.clientY - rect.top;
        const tipW = 200;
        const left = ex + 16 + tipW > rect.width ? ex - tipW - 12 : ex + 16;

        tooltip
          .style("left",  left + "px")
          .style("top",   (ey - 32) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("r", 5);
        tooltip.style("opacity", "0").attr("hidden", true);
        carIcon.style("opacity", "0");
      });

    // ── Animated car icon along x-axis ────────────────────────────────────────
    const carIcon = g.append("text")
      .attr("class", "car-icon")
      .attr("text-anchor", "middle")
      .attr("y", innerH + 22)
      .attr("font-size", "18px")
      .text("🚗")
      .style("opacity", "0")
      .style("pointer-events", "none");

    function moveCar(co2Val) {
      carIcon
        .style("opacity", "1")
        .transition().duration(120)
        .attr("x", xScale(co2Val));
    }

    // ── Legend ────────────────────────────────────────────────────────────────
    const legendData  = Object.entries(FUEL_COLORS);
    const legendGroup = svg.append("g")
      .attr("transform", `translate(${margin.left + 8}, ${margin.top + 6})`);

    legendData.forEach(([label, color], i) => {
      const row = legendGroup.append("g")
        .attr("transform", `translate(${i * 88}, 0)`);

      row.append("circle")
        .attr("r", 5)
        .attr("cx", 0).attr("cy", 0)
        .attr("fill", color)
        .attr("opacity", 0.85)
        .attr("stroke", "rgba(31,42,31,0.25)")
        .attr("stroke-width", 1);

      row.append("text")
        .attr("x", 10).attr("y", 4)
        .attr("fill", "#5b6658")
        .attr("font-family", "Georgia, serif")
        .attr("font-size", "0.8rem")
        .text(label);
    });
  }

})();
