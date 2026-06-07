(function () {
  const ROOT_ID = "scene-3-chart";
  const TOOLTIP_ID = "scene-3-tooltip";
  const SCENE3_WIDTH = 940;
  const SCENE3_HEIGHT = 380;
  const MARGIN = { top: 30, right: 24, bottom: 56, left: 108 };
  const SUMMARY_GUTTER = 150;

  const TRIP_ORDER = [
    "Short (<50 km)",
    "Medium (50–200 km)",
    "Long (200–400 km)",
    "Very Long (>400 km)",
  ];

  const TRIP_META = {
    "Short (<50 km)": {
      kicker: "Short trips",
      title: "Stop-and-go driving makes mileage harder to hold steady.",
      description: "This is the city baseline. Stop-and-go conditions make fuel efficiency less consistent across vehicles.",
    },
    "Medium (50–200 km)": {
      kicker: "Medium trips",
      title: "With more distance, mileage begins to stabilize on medium-length trips.",
      description: "Use this view to compare how each fuel begins to stabilize.",
    },
    "Long (200–400 km)": {
      kicker: "Long trips",
      title: "Longer drives make the separation between fuels easier to compare.",
      description: "The center and spread of each row show how mileage holds over longer runs.",
    },
    "Very Long (>400 km)": {
      kicker: "Very long trips",
      title: "Road-trip mileage can look very different from everyday mileage.",
      description: "By the end of the road, you can compare which fuels still hold strong mileage.",
    },
  };

  const FUEL_ORDER = ["Petrol", "Diesel", "Hybrid"];
  const FUEL_COLORS = {
    Petrol: "#d67b34",
    Diesel: "#4f87b2",
    Hybrid: "#68a36f",
  };
  const EFFICIENCY_COLORS = {
    Poor: "#c95f44",
    Average: "#d8c27a",
    Good: "#7dbb6d",
    Excellent: "#4f8fc8",
  };

  const state = {
    activeTripCategory: "Long (200–400 km)",
    orderedTrips: [],
    allSceneData: [],
    xExtent: [0, 1],
  };

  let stepObserver = null;

  const root = d3.select(`#${ROOT_ID}`);
  if (root.empty()) return;

  buildSceneShell();
  const tooltip = d3
    .select("body")
    .selectAll(`#${TOOLTIP_ID}`)
    .data([null])
    .join("div")
    .attr("id", TOOLTIP_ID);

  const svg = d3
    .select("#scene3-svg-root")
    .append("svg")
    .attr("viewBox", `0 0 ${SCENE3_WIDTH} ${SCENE3_HEIGHT}`)
    .attr("width", SCENE3_WIDTH)
    .attr("height", SCENE3_HEIGHT)
    .attr("role", "img")
    .attr("aria-label", "Mileage comparison by fuel type for the active trip length")
    .style("display", "block")
    .style("width", "100%")
    .style("height", "auto");

  const innerWidth = SCENE3_WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = SCENE3_HEIGHT - MARGIN.top - MARGIN.bottom;
  const plotAreaWidth = innerWidth - SUMMARY_GUTTER;

  const plot = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  const gridLayer = plot.append("g").attr("class", "scene3-grid");
  const laneLayer = plot.append("g").attr("class", "scene3-lanes");
  const summaryLayer = plot.append("g").attr("class", "scene3-summaries");
  const dotLayer = plot.append("g").attr("class", "scene3-dots");

  const xScale = d3.scaleLinear().range([0, plotAreaWidth]);
  const yScale = d3.scaleBand().domain(FUEL_ORDER).range([0, innerHeight]).paddingInner(0.3);

  const xAxisGroup = plot
    .append("g")
    .attr("class", "scene3-axis scene3-x-axis")
    .attr("transform", `translate(0,${innerHeight})`);

  const yAxisGroup = plot.append("g").attr("class", "scene3-axis scene3-y-axis");

  plot
    .append("text")
    .attr("class", "scene3-axis-label")
    .attr("x", plotAreaWidth / 2)
    .attr("y", innerHeight + 48)
    .attr("text-anchor", "middle")
    .text("Observed mileage (km/L)");

  plot
    .append("text")
    .attr("class", "scene3-annotation")
    .attr("x", 0)
    .attr("y", -10);

  renderLegend();

  function syncFromState(sharedState) {
    if (!sharedState.allData || !sharedState.allData.length) return;

    state.allSceneData = sharedState.allData.filter(
      (d) =>
        TRIP_ORDER.includes(d.trip_category) &&
        FUEL_ORDER.includes(d.fuel_type) &&
        Number.isFinite(d.actual_mileage_kmpl)
    );

    const primaryTrip = sharedState.tripCategory || "Long (200–400 km)";
    state.orderedTrips = [primaryTrip, ...TRIP_ORDER.filter((trip) => trip !== primaryTrip)];
    state.activeTripCategory = state.orderedTrips[0];
    state.xExtent = d3.extent(state.allSceneData, (d) => d.actual_mileage_kmpl);

    xScale.domain(state.xExtent).nice();
    drawAxes();
    renderScrollSteps();
    setupStepObserver();
    renderActiveTrip();
  }

  window.onStateReady(syncFromState);

  if (window.STATE && window.STATE.allData && window.STATE.allData.length) {
    syncFromState(window.STATE);
  }

  function buildSceneShell() {
    root.html(`
      <div class="scene3-road-stage">
        <div class="scene3-road-surface" aria-hidden="true">
          <div class="scene3-road-line"></div>
          <div class="scene3-road-line"></div>
          <div class="scene3-road-line"></div>
        </div>
        <div class="scene3-layout">
          <section class="scene3-panel">
            <div class="scene3-copy">
              <p class="scene3-kicker" id="scene3-kicker">The journey</p>
              <h3 class="scene3-title" id="scene3-title">As the road continues, trip length changes what efficiency looks like.</h3>
              <p class="scene3-description" id="scene3-description">
                Your chosen trip length appears first. As the road moves beneath you, the graph updates to the remaining trip lengths.
              </p>
            </div>
            <div class="scene3-legend" id="scene3-legend" aria-hidden="true"></div>
            <div class="scene3-svg-root" id="scene3-svg-root"></div>
          </section>
          <div class="scene3-scroll-track" id="scene3-scroll-track"></div>
        </div>
      </div>
    `);
  }

  function drawAxes() {
    gridLayer
      .call(d3.axisBottom(xScale).ticks(6).tickSize(innerHeight).tickFormat(""))
      .attr("transform", "translate(0,0)");
    gridLayer.select(".domain").remove();

    xAxisGroup.call(d3.axisBottom(xScale).ticks(6));
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup
      .selectAll("text")
      .attr("fill", (d) => FUEL_COLORS[d])
      .style("font-weight", 700)
      .style("font-size", "20px");
  }

  function renderScrollSteps() {
    const track = d3.select("#scene3-scroll-track");
    const steps = track
      .selectAll("section.scene3-step")
      .data(state.orderedTrips, (d) => d)
      .join((enter) => {
        const step = enter.append("section").attr("class", "scene3-step");
        step.append("div").attr("class", "scene3-step-card");
        return step;
      })
      .attr("data-trip-category", (d) => d);

    steps.select(".scene3-step-card").html((tripCategory, index) => {
      const meta = TRIP_META[tripCategory] || TRIP_META["Long (200–400 km)"];
      const label = index === 0 ? "Your trip length" : `Next up: ${shortTripLabel(tripCategory)} trips`;
      return `
        <p class="scene3-step-kicker">${label}</p>
        <h4 class="scene3-step-title">${meta.kicker}</h4>
        <p class="scene3-step-description">${meta.description}</p>
      `;
    });

    updateActiveStep();
  }

  function setupStepObserver() {
    if (stepObserver) {
      stepObserver.disconnect();
    }

    stepObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const tripCategory = entry.target.dataset.tripCategory;
          if (!tripCategory || tripCategory === state.activeTripCategory) return;
          state.activeTripCategory = tripCategory;
          renderActiveTrip();
        });
      },
      {
        root: null,
        rootMargin: "-42% 0px -42% 0px",
        threshold: 0,
      }
    );

    document
      .querySelectorAll("#scene3-scroll-track .scene3-step")
      .forEach((step) => stepObserver.observe(step));
  }

  function renderActiveTrip() {
    const tripData = preparePlotData(
      state.allSceneData.filter((d) => d.trip_category === state.activeTripCategory)
    );
    const summaries = d3.rollup(
      tripData,
      (rows) => ({
        count: rows.length,
        avgMileage: d3.mean(rows, (d) => d.actual_mileage_kmpl),
      }),
      (d) => d.fuel_type
    );
    const meta = TRIP_META[state.activeTripCategory] || TRIP_META["Long (200–400 km)"];

    d3.select("#scene3-kicker").text(meta.kicker);
    d3.select("#scene3-title").text(meta.title);
    d3.select("#scene3-description").text(meta.description);

    plot
      .select(".scene3-annotation")
      .text(`${shortTripLabel(state.activeTripCategory)} trips: farther right means better mileage within this trip context.`);

    // Redraw the active trip from scratch so the sticky chart stays reliable.
    laneLayer.selectAll("*").remove();
    summaryLayer.selectAll("*").remove();
    dotLayer.selectAll("*").remove();

    laneLayer
      .selectAll("rect.scene3-lane-band")
      .data(FUEL_ORDER)
      .enter()
      .append("rect")
      .attr("class", "scene3-lane-band")
      .attr("x", 0)
      .attr("y", (d) => yScale(d))
      .attr("width", innerWidth)
      .attr("height", yScale.bandwidth());

    summaryLayer
      .selectAll("text.scene3-lane-summary")
      .data(FUEL_ORDER)
      .enter()
      .append("text")
      .attr("class", "scene3-lane-summary")
      .attr("x", innerWidth - 8)
      .attr("y", (d) => yScale(d) + 18)
      .attr("text-anchor", "end")
      .text((d) => {
        const summary = summaries.get(d);
        if (!summary) return "n=0";
        return `n=${summary.count}, avg=${summary.avgMileage.toFixed(1)} km/L`;
      });

    dotLayer
      .selectAll("circle.scene3-dot")
      .data(tripData, dotKey)
      .enter()
      .append("circle")
      .attr("class", "scene3-dot")
      .attr("r", 7)
      .attr("cx", (d) => d.plotX)
      .attr("cy", (d) => d.plotY)
      .attr("fill", (d) => EFFICIENCY_COLORS[d.efficiency_band] || "#999")
      .attr("opacity", 0.92)
      .on("mouseenter", function (event, d) {
        d3.select(this).classed("is-hovered", true).attr("opacity", 1);
        tooltip
          .style("display", "block")
          .html(
            `<strong>${d.car_name}</strong>
            ${d.fuel_type} | ${shortTripLabel(d.trip_category)}<br>
            Mileage: ${d.actual_mileage_kmpl.toFixed(2)} km/L<br>
            Efficiency band: ${d.efficiency_band}`
          );
        moveTooltip(event, this);
      })
      .on("mousemove", function (event) {
        moveTooltip(event, this);
      })
      .on("mouseleave", function () {
        d3.select(this).classed("is-hovered", false).attr("opacity", 0.92);
        tooltip.style("display", "none");
      });

    updateActiveStep();
  }

  function preparePlotData(data) {
    const counts = new Map();
    return data.map((d) => {
      const index = counts.get(d.fuel_type) || 0;
      counts.set(d.fuel_type, index + 1);
      const laneTop = yScale(d.fuel_type);
      const laneHeight = yScale.bandwidth();
      const jitterY = ((index % 7) - 3) * 6.5;

      return {
        ...d,
        plotX: xScale(d.actual_mileage_kmpl),
        plotY: laneTop + laneHeight / 2 + jitterY,
      };
    });
  }

  function updateActiveStep() {
    d3.selectAll("#scene3-scroll-track .scene3-step").classed(
      "is-active",
      function () {
        return this.dataset.tripCategory === state.activeTripCategory;
      }
    );
  }

  function renderLegend() {
    const legend = d3.select("#scene3-legend");
    legend.html("");
    legend.append("div").attr("class", "scene3-legend-title").text("Efficiency band");
    Object.entries(EFFICIENCY_COLORS).forEach(([band, fill]) => {
      const row = legend.append("div").attr("class", "scene3-legend-row");
      row.append("span").attr("class", "scene3-legend-swatch").style("background", fill);
      row.append("span").text(band);
    });
  }

  function shortTripLabel(label) {
    const shortLabels = {
      "Short (<50 km)": "Short",
      "Medium (50–200 km)": "Medium",
      "Long (200–400 km)": "Long",
      "Very Long (>400 km)": "Very Long",
    };
    return shortLabels[label] || label;
  }

  function dotKey(d, index) {
    return d.trip_id || `${d.trip_category}|${d.fuel_type}|${d.car_name}|${d.actual_mileage_kmpl}|${index}`;
  }

  function moveTooltip(event) {
    const offsetX = 16;
    const offsetY = 12;
    const tooltipNode = tooltip.node();
    if (!tooltipNode) return;
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const anchorX = event.clientX;
    const anchorY = event.clientY;

    let nextLeft = anchorX + offsetX;
    let nextTop = anchorY - tooltipRect.height - offsetY;

    if (nextLeft + tooltipRect.width > window.innerWidth - 12) {
      nextLeft = anchorX - tooltipRect.width - offsetX;
    }

    if (nextTop < 12) {
      nextTop = anchorY + offsetY;
    }

    tooltip
      .style("left", `${Math.max(12, nextLeft)}px`)
      .style("top", `${Math.max(12, nextTop)}px`);
  }
})();
