const svgWidth = 980;
const svgHeight = 560;
const margin = { top: 36, right: 36, bottom: 72, left: 84 };

const palette = {
  Petrol: "#d07a28",
  Diesel: "#2f6c8f",
  Electric: "#4c9a63",
  Hybrid: "#6e59a5",
};

const chartRoot = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const filterSelect = d3.select("#vehicle-filter");

const svg = chartRoot
  .append("svg")
  .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
  .attr("role", "img")
  .attr("aria-label", "Scatterplot of vehicle mileage versus CO2 emissions");

const plotWidth = svgWidth - margin.left - margin.right;
const plotHeight = svgHeight - margin.top - margin.bottom;

const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear().range([0, plotWidth]);
const yScale = d3.scaleLinear().range([plotHeight, 0]);
const colorScale = d3.scaleOrdinal().range(["#d07a28", "#2f6c8f", "#4c9a63", "#6e59a5", "#9f4d64"]);

const xAxisGroup = plot.append("g").attr("class", "axis").attr("transform", `translate(0,${plotHeight})`);
const yAxisGroup = plot.append("g").attr("class", "axis");

plot
  .append("text")
  .attr("class", "axis-label")
  .attr("x", plotWidth / 2)
  .attr("y", plotHeight + 54)
  .attr("text-anchor", "middle")
  .text("Actual Mileage (km per liter)");

plot
  .append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -plotHeight / 2)
  .attr("y", -56)
  .attr("text-anchor", "middle")
  .text("CO₂ per km");

plot
  .append("text")
  .attr("x", 0)
  .attr("y", -8)
  .attr("font-size", "15px")
  .attr("fill", "#5b6658")
  .text("Better sustainability tends to appear toward the bottom-right.");

d3.csv("data/cars_fuel_efficiency_clean.csv", d3.autoType).then((data) => {
  data.forEach((d) => {
    d.actual_mileage_kmpl = +d.actual_mileage_kmpl;
    d.co2_per_km = +d.co2_per_km;
  });

  const vehicleTypes = [...new Set(data.map((d) => d.vehicle_type))].sort(d3.ascending);
  const fuelTypes = [...new Set(data.map((d) => d.fuel_type))];

  colorScale.domain(fuelTypes);

  filterSelect
    .selectAll("option.vehicle-option")
    .data(vehicleTypes)
    .enter()
    .append("option")
    .attr("class", "vehicle-option")
    .attr("value", (d) => d)
    .text((d) => d);

  xScale.domain(d3.extent(data, (d) => d.actual_mileage_kmpl)).nice();
  yScale.domain(d3.extent(data, (d) => d.co2_per_km)).nice();

  xAxisGroup.call(d3.axisBottom(xScale));
  yAxisGroup.call(d3.axisLeft(yScale));

  drawLegend(fuelTypes);
  render(data);

  filterSelect.on("change", (event) => {
    const selected = event.target.value;
    const filteredData =
      selected === "All" ? data : data.filter((d) => d.vehicle_type === selected);
    render(filteredData);
  });
});

function render(data) {
  const dots = plot.selectAll("circle.dot").data(data, (d) => d.trip_id);

  dots
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "dot")
          .attr("cx", (d) => xScale(d.actual_mileage_kmpl))
          .attr("cy", (d) => yScale(d.co2_per_km))
          .attr("r", 0)
          .attr("fill", (d) => colorScale(d.fuel_type))
          .attr("opacity", 0.8)
          .call((enterSelection) =>
            enterSelection
              .on("mouseenter", function (event, d) {
                d3.select(this).attr("stroke-width", 2.2).attr("opacity", 1);
                tooltip
                  .html(
                    `<strong>${d.car_name}</strong>
                    ${d.vehicle_type} | ${d.fuel_type}<br>
                    Mileage: ${d.actual_mileage_kmpl.toFixed(2)} km/L<br>
                    CO₂ per km: ${d.co2_per_km.toFixed(3)}<br>
                    Trip: ${d.trip_category}`
                  )
                  .attr("hidden", null);
                moveTooltip(event);
              })
              .on("mousemove", moveTooltip)
              .on("mouseleave", function () {
                d3.select(this).attr("stroke-width", 1).attr("opacity", 0.8);
                tooltip.attr("hidden", true);
              })
          )
          .call((enterSelection) =>
            enterSelection
              .transition()
              .duration(450)
              .attr("r", 7)
          ),
      (update) =>
        update.call((updateSelection) =>
          updateSelection
            .transition()
            .duration(350)
            .attr("cx", (d) => xScale(d.actual_mileage_kmpl))
            .attr("cy", (d) => yScale(d.co2_per_km))
            .attr("fill", (d) => colorScale(d.fuel_type))
            .attr("r", 7)
        ),
      (exit) =>
        exit.call((exitSelection) =>
          exitSelection
            .transition()
            .duration(250)
            .attr("r", 0)
            .remove()
        )
    );
}

function drawLegend(fuelTypes) {
  const legend = svg.append("g").attr("class", "legend").attr("transform", "translate(760, 64)");

  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -14)
    .attr("font-size", "14px")
    .text("Fuel type");

  fuelTypes.forEach((fuel, index) => {
    const row = legend.append("g").attr("transform", `translate(0, ${index * 24})`);
    row.append("circle").attr("r", 7).attr("cx", 0).attr("cy", 0).attr("fill", colorScale(fuel));
    row
      .append("text")
      .attr("x", 16)
      .attr("y", 4)
      .attr("font-size", "13px")
      .text(fuel);
  });
}

function moveTooltip(event) {
  tooltip
    .style("left", `${event.pageX + 14}px`)
    .style("top", `${event.pageY - 18}px`);
}
