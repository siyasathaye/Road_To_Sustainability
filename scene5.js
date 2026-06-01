// ─── scene5.js ────────────────────────────────────────────────────────────────
// Owns: recommendation cards + before/after bar chart in Scene 5.
// Runs when STATE is updated (user submits quiz).
// ─────────────────────────────────────────────────────────────────────────────

(function () {

  window.onStateReady(function (state) {
    const { byCarAll, byCarFiltered, vehicleClass, priority } = state;
    if (!byCarAll || !vehicleClass) return;

    renderBars(byCarAll, vehicleClass, priority);
    renderCards(byCarAll, vehicleClass, priority);

    // scroll into view after a short delay so bars animate in
    setTimeout(() => {
      document.getElementById("scene-5").scrollIntoView({ behavior: "smooth" });
    }, 2400);
  });

  // ── Before/after bar chart ─────────────────────────────────────────────────
  function renderBars(byCarAll, vehicleClass, priority) {
    const container = document.getElementById("scene-5-bars");
    container.innerHTML = "";

    const metricKey   = priority === "emissions" ? "avg_co2"  : "avg_cost";
    const metricLabel = priority === "emissions" ? "Avg CO₂ per km" : "Avg cost per km (USD)";
    const fmt         = priority === "emissions"
      ? d => d.toFixed(3)
      : d => "$" + d.toFixed(3);

    // user's class average vs top 3 alternatives
    const userCars = byCarAll.filter(d => d.vehicle_type === vehicleClass);
    const userAvg  = d3.mean(userCars, d => d[metricKey]);

    // top 3 cars outside user's class that are better
    const alternatives = byCarAll
      .filter(d => d.vehicle_type !== vehicleClass)
      .slice(0, 3);

    const barData = [
      { label: `Your pick\n(${vehicleClass})`, value: userAvg, isUser: true },
      ...alternatives.map(d => ({ label: d.car_name, value: d[metricKey], isUser: false })),
    ];

    const W = 640, H = 260;
    const m = { top: 28, right: 20, bottom: 48, left: 200 };
    const pw = W - m.left - m.right;
    const ph = H - m.top  - m.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .style("width", "100%");

    const plot = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(barData, d => d.value) * 1.15])
      .range([0, pw]);

    const yScale = d3.scaleBand()
      .domain(barData.map(d => d.label))
      .range([0, ph])
      .padding(0.32);

    // gridlines
    plot.append("g").attr("class", "grid")
      .call(d3.axisBottom(xScale).ticks(5).tickSize(ph).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").attr("stroke", "#e8e0d4").attr("stroke-dasharray", "3 3"));

    // bars
    plot.selectAll("rect.bar")
      .data(barData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", d => yScale(d.label))
      .attr("height", yScale.bandwidth())
      .attr("width", 0)
      .attr("rx", 5)
      .attr("fill", d => d.isUser ? "#d07a28" : "#3a6b49")
      .attr("opacity", 0.85)
      .transition().duration(700).delay((d, i) => i * 120)
      .attr("width", d => xScale(d.value));

    // value labels
    plot.selectAll("text.val")
      .data(barData)
      .enter()
      .append("text")
      .attr("class", "val")
      .attr("x", d => xScale(d.value) + 6)
      .attr("y", d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
      .attr("font-size", "12px")
      .attr("fill", "#5b6658")
      .text(d => fmt(d.value))
      .attr("opacity", 0)
      .transition().delay((d, i) => i * 120 + 600).duration(300)
      .attr("opacity", 1);

    // y axis
    plot.append("g").attr("class", "axis")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .attr("font-size", "12px")
      .attr("fill", "#5b6658")
      .each(function () {
        // wrap long labels
        const el = d3.select(this);
        const words = el.text().split("\n");
        if (words.length > 1) {
          el.text(words[0]);
          el.append("tspan")
            .attr("x", -8).attr("dy", "1.1em")
            .attr("font-size", "10px").attr("fill", "#8a9980")
            .text(words[1]);
        }
      });

    // x axis
    plot.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${ph})`)
      .call(d3.axisBottom(xScale).ticks(5));

    // axis label
    plot.append("text").attr("class", "axis-label")
      .attr("x", pw / 2).attr("y", ph + 40)
      .attr("text-anchor", "middle")
      .text(metricLabel);

    // annotation arrow on user bar
    const userD = barData[0];
    const arrowX = xScale(userD.value) + 12;
    const arrowY = yScale(userD.label) + yScale.bandwidth() / 2;
    plot.append("text")
      .attr("x", arrowX + 36).attr("y", arrowY - 10)
      .attr("font-size", "11px").attr("fill", "#d07a28").attr("font-weight", "600")
      .text("← your current pick");
  }

  // ── Recommendation cards ───────────────────────────────────────────────────
  function renderCards(byCarAll, vehicleClass, priority) {
    const container = document.getElementById("rec-cards");
    container.innerHTML = "";

    const metricKey   = priority === "emissions" ? "avg_co2"  : "avg_cost";
    const metricLabel = priority === "emissions" ? "CO₂/km"   : "Cost/km";
    const fmt         = priority === "emissions"
      ? v => v.toFixed(3) + " g"
      : v => "$" + v.toFixed(3);

    // user's best car
    const userBest = byCarAll.find(d => d.vehicle_type === vehicleClass);

    // top 3 alternatives that beat the user's class on their priority
    const alts = byCarAll
      .filter(d => d.vehicle_type !== vehicleClass &&
                   d[metricKey] < (userBest ? userBest[metricKey] : Infinity))
      .slice(0, 3);

    if (!alts.length) {
      container.innerHTML = `<p class="rec-empty">Great news — your chosen class is already among the best for your priority!</p>`;
      return;
    }

    // update description
    const desc = document.getElementById("s5-desc");
    if (desc) {
      const priorityWord = priority === "emissions" ? "lower CO₂ emissions" : "lower fuel cost";
      desc.textContent = `You chose a ${vehicleClass} and care about ${priorityWord}. Here's how alternatives stack up.`;
    }

    alts.forEach((car, i) => {
      const saving = userBest
        ? ((userBest[metricKey] - car[metricKey]) / userBest[metricKey] * 100).toFixed(1)
        : null;

      const bandClass = {
        Good: "band-good", Average: "band-avg", Poor: "band-poor"
      }[car.efficiency_band] || "band-avg";

      const card = document.createElement("div");
      card.className = `rec-card${i === 0 ? " rec-best" : ""}`;
      card.innerHTML = `
        <div class="rec-rank">${i === 0 ? "⭐ Best match" : `#${i + 2}`}</div>
        <div class="rec-name">${car.car_name}</div>
        <div class="rec-meta">${car.vehicle_type} · ${car.fuel_type}</div>
        <div class="rec-stats">
          <span title="${metricLabel}">${priority === "emissions" ? "💨" : "💵"} ${fmt(car[metricKey])}</span>
          <span title="Avg mileage">🛣 ${car.avg_mileage.toFixed(1)} km/L</span>
          ${saving ? `<span class="rec-saving">↓ ${saving}% vs your pick</span>` : ""}
        </div>
        <span class="rec-band ${bandClass}">${car.efficiency_band || "—"}</span>
      `;
      container.appendChild(card);
    });
  }

})();
