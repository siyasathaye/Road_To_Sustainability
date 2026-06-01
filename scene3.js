const SCENE3_WIDTH = 980;
const SCENE3_HEIGHT = 510;
const SCENE3_MARGIN = { top: 36, right: 24, bottom: 68, left: 108 };

const TRIP_ORDER = [
  "Short (<50 km)",
  "Medium (50–200 km)",
  "Long (200–400 km)",
  "Very Long (>400 km)",
];

const TRIP_META = {
  "Short (<50 km)": {
    kicker: "Short trips in focus",
    title: "Each row is a fuel type. Each dot is one short trip.",
    description: "This is the stop-and-go baseline. Farther right means better observed mileage.",
  },
  "Medium (50–200 km)": {
    kicker: "Medium trips in focus",
    title: "The same fuels settle into a different rhythm on medium trips.",
    description: "Watch how each row shifts when vehicles get more distance to stabilize.",
  },
  "Long (200–400 km)": {
    kicker: "Long trips in focus",
    title: "Longer drives make the separation between fuels easier to compare.",
    description: "The average position and spread reveal how each fuel holds mileage over longer runs.",
  },
  "Very Long (>400 km)": {
    kicker: "Very long trips in focus",
    title: "Road-trip mileage can look different from everyday mileage.",
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
};

const chartRoot = d3.select("#scene3-chart");
const tooltip = d3.select("#scene3-tooltip");
const chartKicker = d3.select("#chart-kicker");
const chartTitle = d3.select("#chart-title");
const chartDescription = d3.select("#chart-description");
const legendInline = d3.select("#legend-inline");
const roadSteps = d3.selectAll(".road-step");

const svg = chartRoot
  .append("svg")
  .attr("viewBox", `0 0 ${SCENE3_WIDTH} ${SCENE3_HEIGHT}`)
  .attr("role", "img")
  .attr(
    "aria-label",
    "Scrolling dot plot comparing mileage distributions across fuel types as trip length changes"
  );

const plotWidth = SCENE3_WIDTH - SCENE3_MARGIN.left - SCENE3_MARGIN.right;
const plotHeight = SCENE3_HEIGHT - SCENE3_MARGIN.top - SCENE3_MARGIN.bottom;

const plot = svg
  .append("g")
  .attr("transform", `translate(${SCENE3_MARGIN.left},${SCENE3_MARGIN.top})`);

const xScale = d3.scaleLinear().range([0, plotWidth]);
const yScale = d3.scaleBand().domain(FUEL_ORDER).range([0, plotHeight]).paddingInner(0.3);

const gridLayer = plot.append("g").attr("class", "grid");
const bandLayer = plot.append("g").attr("class", "band-layer");
const dotsLayer = plot.append("g").attr("class", "dots-layer");

const xAxisGroup = plot
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${plotHeight})`);

const yAxisGroup = plot.append("g").attr("class", "axis");

plot
  .append("text")
  .attr("class", "axis-label")
  .attr("x", plotWidth / 2)
  .attr("y", plotHeight + 56)
  .attr("text-anchor", "middle")
  .text("Observed mileage for the active trip category (km/L)");

plot
  .append("text")
  .attr("class", "annotation")
  .attr("x", 0)
  .attr("y", -12)
  .text("Farther right means better mileage within the same trip context.");

renderLegend();

d3.csv("data/cars_fuel_efficiency_clean.csv", d3.autoType).then((rawData) => {
  const filtered = rawData.filter(
    (d) => TRIP_ORDER.includes(d.trip_category) && FUEL_ORDER.includes(d.fuel_type)
  );

  xScale.domain(d3.extent(filtered, (d) => d.actual_mileage_kmpl)).nice();
  drawAxes();
  renderScene3(filtered);
  setupScrollSteps(filtered);

  window.updateScene3 = ({ tripCategory, fuelType } = {}) => {
    if (tripCategory && TRIP_ORDER.includes(tripCategory)) {
      state.activeTripCategory = tripCategory;
    }
    renderScene3(filtered);
  };
});

function renderScene3(data) {
  const categoryData = prepareScene3Data(
    data.filter((d) => d.trip_category === state.activeTripCategory)
  );

  updateChartCopy();
  updateRoadSteps();
  drawLaneBands(categoryData);
  drawDots(categoryData);
}

function prepareScene3Data(data) {
  const counts = new Map();

  return data.map((d) => {
    const key = d.fuel_type;
    const index = counts.get(key) || 0;
    counts.set(key, index + 1);

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

function drawAxes() {
  const tickValues = xScale.ticks(6);

  gridLayer
    .call(d3.axisBottom(xScale).tickValues(tickValues).tickSize(plotHeight).tickFormat(""))
    .attr("transform", "translate(0,0)");

  gridLayer.select(".domain").remove();

  xAxisGroup.call(d3.axisBottom(xScale).ticks(6));
  yAxisGroup.call(d3.axisLeft(yScale));
  yAxisGroup
    .selectAll("text")
    .attr("fill", (d) => FUEL_COLORS[d])
    .style("font-weight", 700)
    .style("font-size", "18px");
}

function drawLaneBands(data) {
  const summaries = d3.rollup(
    data,
    (rows) => ({
      count: rows.length,
      avgMileage: d3.mean(rows, (d) => d.actual_mileage_kmpl),
    }),
    (d) => d.fuel_type
  );

  bandLayer
    .selectAll("rect.lane-band")
    .data(FUEL_ORDER)
    .join("rect")
    .attr("class", "lane-band")
    .attr("x", 0)
    .attr("y", (d) => yScale(d))
    .attr("width", plotWidth)
    .attr("height", yScale.bandwidth());

  bandLayer
    .selectAll("text.lane-summary")
    .data(FUEL_ORDER)
    .join("text")
    .attr("class", "annotation lane-summary")
    .attr("x", plotWidth - 8)
    .attr("y", (d) => yScale(d) + 18)
    .attr("text-anchor", "end")
    .text((d) => {
      const summary = summaries.get(d);
      if (!summary) {
        return "n=0";
      }
      return `n=${summary.count}, avg=${summary.avgMileage.toFixed(1)} km/L`;
    });
}

function drawDots(data) {
  const dots = dotsLayer.selectAll("circle.trip-dot").data(data, (d) => d.trip_id);

  dots
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "trip-dot")
          .attr("cx", (d) => d.plotX)
          .attr("cy", (d) => d.plotY)
          .attr("r", 0)
          .attr("fill", (d) => EFFICIENCY_COLORS[d.efficiency_band] || "#999")
          .attr("opacity", 0.92)
          .call((selection) =>
            selection
              .transition()
              .duration(240)
              .attr("r", 7)
          ),
      (update) =>
        update.call((selection) =>
          selection
            .transition()
            .duration(220)
            .attr("cx", (d) => d.plotX)
            .attr("cy", (d) => d.plotY)
            .attr("fill", (d) => EFFICIENCY_COLORS[d.efficiency_band] || "#999")
            .attr("opacity", 0.92)
            .attr("r", 7)
        ),
      (exit) =>
        exit.call((selection) =>
          selection
            .transition()
            .duration(180)
            .attr("r", 0)
            .remove()
        )
    )
    .classed("is-dimmed", false)
    .on("mouseenter", function (event, d) {
      d3.select(this).classed("active-hover", true).attr("opacity", 1);
      tooltip
        .style("display", "block")
        .html(
          `<strong>${d.car_name}</strong>
          ${d.fuel_type} | ${shortTripLabel(d.trip_category)}<br>
          Mileage: ${d.actual_mileage_kmpl.toFixed(2)} km/L<br>
          Efficiency band: ${d.efficiency_band}`
        );
      moveTooltip(event);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function () {
      d3.select(this).classed("active-hover", false).attr("opacity", 0.92);
      tooltip.style("display", "none");
    });
}

function renderLegend() {
  legendInline.html("");
  legendInline.append("div").attr("class", "legend-title").text("Efficiency band");

  Object.entries(EFFICIENCY_COLORS).forEach(([band, fill]) => {
    const row = legendInline.append("div").attr("class", "legend-row");
    row.append("span").attr("class", "legend-swatch").style("background", fill);
    row.append("span").text(band);
  });
}

function updateChartCopy() {
  const meta = TRIP_META[state.activeTripCategory];
  chartKicker.text(meta.kicker);
  chartTitle.text(meta.title);
  chartDescription.text(meta.description);
}

function setupScrollSteps(data) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const tripCategory = entry.target.dataset.tripCategory;
        if (tripCategory && tripCategory !== state.activeTripCategory) {
          state.activeTripCategory = tripCategory;
          renderScene3(data);
        }
      });
    },
    {
      root: null,
      rootMargin: "-35% 0px -45% 0px",
      threshold: 0.2,
    }
  );

  roadSteps.each(function () {
    observer.observe(this);
  });
}

function updateRoadSteps() {
  roadSteps.classed("is-active", function () {
    return this.dataset.tripCategory === state.activeTripCategory;
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

function moveTooltip(event) {
  const offsetX = 16;
  const offsetY = 18;
  const tooltipNode = tooltip.node();

  if (!tooltipNode) {
    return;
  }

  const rect = tooltipNode.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - 12;
  const maxTop = window.innerHeight - rect.height - 12;
  const nextLeft = Math.min(event.clientX + offsetX, maxLeft);
  const nextTop = Math.min(event.clientY - rect.height - offsetY, maxTop);

  tooltip
    .style("left", `${Math.max(12, nextLeft)}px`)
    .style("top", `${Math.max(12, nextTop)}px`);
}
