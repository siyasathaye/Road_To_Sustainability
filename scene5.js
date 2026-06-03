// ─── scene5.js ────────────────────────────────────────────────────────────────
// Scene 5: The Destination — recommendation cards + before/after bar chart.
// Bar chart compares the best individual car within the user's chosen class
// against the top 2–3 alternatives from other classes on the user's stated
// priority (emissions or cost).
// ─────────────────────────────────────────────────────────────────────────────

(function () {

  window.onStateReady(function (state) {
    const { byCarAll, vehicleClass, priority } = state;
    if (!byCarAll || !vehicleClass || !priority) return;

    renderBars(byCarAll, vehicleClass, priority);
    renderCards(byCarAll, vehicleClass, priority);
  });

  // ── Before / after bar chart ───────────────────────────────────────────────
  function renderBars(byCarAll, vehicleClass, priority) {
    const container = document.getElementById("scene-5-bars");
    container.innerHTML = "";

    const metricKey   = priority === "emissions" ? "avg_co2"  : "avg_cost";
    const metricLabel = priority === "emissions"
      ? "Avg CO₂ per km (kg)"
      : "Avg cost per km (USD)";
    const fmt = priority === "emissions"
      ? d => d.toFixed(4)
      : d => "$" + d.toFixed(4);

    // Best car in user's class (byCarAll is sorted ascending by priority metric)
    const userCar = byCarAll.find(d => d.vehicle_type === vehicleClass);
    if (!userCar) return;

    // Top alternatives from other classes that beat the user's best car
    const alternatives = byCarAll
      .filter(d => d.vehicle_type !== vehicleClass &&
                   d[metricKey] < userCar[metricKey])
      .slice(0, 3);

    // If no alternatives beat user's pick, show the global top 3 from other classes
    const altsToShow = alternatives.length
      ? alternatives
      : byCarAll.filter(d => d.vehicle_type !== vehicleClass).slice(0, 3);

    const barData = [
      {
        label: userCar.car_name,
        sublabel: vehicleClass,
        value: userCar[metricKey],
        isUser: true,
      },
      ...altsToShow.map(d => ({
        label: d.car_name,
        sublabel: d.vehicle_type,
        value: d[metricKey],
        isUser: false,
      })),
    ];

    // ── SVG setup ────────────────────────────────────────────────────────────
    const W = 660, H = 56 * barData.length + 90;
    const m = { top: 32, right: 24, bottom: 52, left: 210 };
    const pw = W - m.left - m.right;
    const ph = H - m.top  - m.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img")
      .attr("aria-label", `Bar chart: ${metricLabel} comparison`)
      .style("width", "100%");

    const plot = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // ── Scales ───────────────────────────────────────────────────────────────
    const xMax = d3.max(barData, d => d.value) * 1.18;
    const xScale = d3.scaleLinear().domain([0, xMax]).range([0, pw]);

    const yScale = d3.scaleBand()
      .domain(barData.map(d => d.label))
      .range([0, ph])
      .padding(0.35);

    // ── Grid lines ───────────────────────────────────────────────────────────
    plot.append("g")
      .call(d3.axisBottom(xScale).ticks(5).tickSize(ph).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line")
        .attr("stroke", "#e8e0d4")
        .attr("stroke-dasharray", "3 3"));

    // ── Bars ─────────────────────────────────────────────────────────────────
    plot.selectAll("rect.bar")
      .data(barData)
      .join("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.label))
        .attr("height", yScale.bandwidth())
        .attr("width", 0)
        .attr("rx", 5)
        .attr("fill",    d => d.isUser ? "#d07a28" : "#3a6b49")
        .attr("opacity", 0.88)
      .transition().duration(700).delay((d, i) => i * 130)
        .attr("width", d => xScale(d.value));

    // ── Value labels ──────────────────────────────────────────────────────────
    plot.selectAll("text.val")
      .data(barData)
      .join("text")
        .attr("class", "val")
        .attr("x", d => xScale(d.value) + 7)
        .attr("y", d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
        .attr("font-size", "12px")
        .attr("font-family", "Georgia, serif")
        .attr("fill", "#5b6658")
        .text(d => fmt(d.value))
        .attr("opacity", 0)
      .transition().delay((d, i) => i * 130 + 620).duration(280)
        .attr("opacity", 1);

    // ── Y axis with two-line labels ───────────────────────────────────────────
    const yAxis = plot.append("g").attr("class", "axis")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(g => g.select(".domain").remove());

    yAxis.selectAll("text").remove(); // rebuild manually for two lines

    barData.forEach(d => {
      const y = yScale(d.label) + yScale.bandwidth() / 2;

      plot.append("text")
        .attr("x", -10).attr("y", y - 5)
        .attr("text-anchor", "end")
        .attr("font-size", d.isUser ? "13px" : "12px")
        .attr("font-weight", d.isUser ? "700" : "400")
        .attr("font-family", "Georgia, serif")
        .attr("fill", d.isUser ? "#d07a28" : "#1f2a1f")
        .text(d.label);

      plot.append("text")
        .attr("x", -10).attr("y", y + 9)
        .attr("text-anchor", "end")
        .attr("font-size", "10px")
        .attr("font-family", "Georgia, serif")
        .attr("fill", "#8a9980")
        .text(d.sublabel + (d.isUser ? " — your pick" : ""));
    });

    // ── X axis ───────────────────────────────────────────────────────────────
    plot.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${ph})`)
      .call(d3.axisBottom(xScale).ticks(5));

    plot.append("text")
      .attr("x", pw / 2).attr("y", ph + 40)
      .attr("text-anchor", "middle")
      .attr("font-family", "Georgia, serif")
      .attr("font-size", "12px")
      .attr("fill", "#5b6658")
      .text(metricLabel);

    // ── "Your pick" annotation ────────────────────────────────────────────────
    const ud = barData[0];
    plot.append("text")
      .attr("x", xScale(ud.value) - 8)
      .attr("y", yScale(ud.label) - 5)
      .attr("font-size", "11px")
      .attr("font-family", "Georgia, serif")
      .attr("fill", "#d07a28")
      .attr("font-weight", "600")
      .attr("opacity", 0)
      .attr("text-anchor", "end")
      .text("your current pick →")
      .transition().delay(700 + barData.length * 130).duration(300)
      .attr("opacity", 1);
  }

  // ── Recommendation cards ───────────────────────────────────────────────────
  function renderCards(byCarAll, vehicleClass, priority) {
    const container = document.getElementById("rec-cards");
    container.innerHTML = "";

    const metricKey   = priority === "emissions" ? "avg_co2"  : "avg_cost";
    const metricLabel = priority === "emissions" ? "CO₂/km"   : "Cost/km";
    const fmt = priority === "emissions"
      ? v => v.toFixed(4) + " kg"
      : v => "$" + v.toFixed(4);

    const userCar = byCarAll.find(d => d.vehicle_type === vehicleClass);

    // Top alternatives from other classes that beat the user's best car
    const alts = byCarAll
      .filter(d => d.vehicle_type !== vehicleClass &&
                   d[metricKey] < (userCar ? userCar[metricKey] : Infinity))
      .slice(0, 3);

    if (!alts.length) {
      container.innerHTML =
        `<p class="rec-empty">Great choice — your selected class is already
         among the best for your stated priority!</p>`;
      return;
    }

    // Update the scene description
    const desc = document.getElementById("s5-desc");
    if (desc) {
      const word = priority === "emissions" ? "lower CO₂ emissions" : "lower fuel cost";
      desc.textContent =
        `You chose a ${vehicleClass} and care about ${word}. ` +
        `The best ${vehicleClass} in the dataset is the ${userCar ? userCar.car_name : vehicleClass}. ` +
        `Here are alternatives that would save you more.`;
    }

    const BAND_CLASS = { Good: "band-good", Average: "band-avg", Poor: "band-poor" };

    alts.forEach((car, i) => {
      const saving = userCar
        ? ((userCar[metricKey] - car[metricKey]) / userCar[metricKey] * 100).toFixed(1)
        : null;

      const band = BAND_CLASS[car.efficiency_band] || "band-avg";

      const card = document.createElement("div");
      card.className = `rec-card${i === 0 ? " rec-best" : ""}`;
      card.innerHTML = `
        <div class="rec-rank">${i === 0 ? "⭐ Best match" : `#${i + 2}`}</div>
        <div class="rec-name">${car.car_name}</div>
        <div class="rec-meta">${car.vehicle_type} · ${car.fuel_type}</div>
        <div class="rec-stats">
          <span title="${metricLabel}">
            ${priority === "emissions" ? "💨" : "💵"} ${fmt(car[metricKey])}
          </span>
          <span title="Avg mileage">🛣 ${car.avg_mileage.toFixed(1)} km/L</span>
          ${saving ? `<span class="rec-saving">↓ ${saving}% vs your pick</span>` : ""}
        </div>
        <span class="rec-band ${band}">${car.efficiency_band || "—"}</span>
      `;
      container.appendChild(card);
    });
  }

})();
