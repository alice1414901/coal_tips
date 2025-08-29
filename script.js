const mapData = {}; // global object
let scroller;
let isMobileMode = window.innerWidth < 481;
let lastIsMobile = isMobileMode;

// load data, create svg, base map and tips
function setUpMap() {
  return Promise.all([
    d3.json("processed_data/WLAs.topojson"),
    d3.json("processed_data/tips_processed.geojson"),
  ]).then(([WLA_topo, tips]) => {
    const geo = topojson.feature(WLA_topo, WLA_topo.objects.wales_local_authorities); //convert from topo to geoJSON
    
  // saving variables to mapData
    mapData.map = geo;
    mapData.tips = tips;

    const mapContainer = document.getElementById("map");
    const width = mapContainer.clientWidth;
    const height = mapContainer.clientHeight;

    const svg = d3.select("#map")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const projection = d3.geoMercator().fitSize([width, height - 25], geo);
    const path = d3.geoPath().projection(projection);

    // g.boundaries
    svg.append("g").attr("class", "boundaries")
      .selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", path)
      .attr("fill", "#eee")
      .attr("stroke", "#333");

    // g.tips
    svg.append("g").attr("class", "tips")
      .selectAll("circle")
      .data(tips.features.filter(d => d.geometry && d.geometry.coordinates))
      .join("circle")
      .attr("cx", d => projection(d.geometry.coordinates)[0])
      .attr("cy", d => projection(d.geometry.coordinates)[1])
      .attr("r", 3)
      .attr("fill", "#888")
      .attr("opacity", 0);

    // saving variables to mapData
    mapData.projection = projection;
    mapData.path = path;
    mapData.svg = svg;
  }).catch(err => console.error("Error loading data:", err));
}

// functions for zoom logic 
function desktopZoom(width, height) {
  const southWalesFeatures = mapData.map.features.filter(d => [
    "Blaenau Gwent","Bridgend","Caerphilly","Cardiff","Merthyr Tydfil",
    "Neath Port Talbot","Rhondda Cynon Taf","Swansea","Vale of Glamorgan"
  ].includes(d.properties.LAD25NMW));

  if (!southWalesFeatures.length) return {scale: 1, translate: [0, 0]};

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  southWalesFeatures.forEach(f => {
    const b = mapData.path.bounds(f);
    x0 = Math.min(x0, b[0][0]);
    y0 = Math.min(y0, b[0][1]);
    x1 = Math.max(x1, b[1][0]);
    y1 = Math.max(y1, b[1][1]);
  });

  const dx = x1 - x0;
  const dy = y1 - y0;
  let scale = Math.min(width / dx, height / dy) * 0.5;
  let translateX = width / 2 - (x0 + dx / 2) * scale;
  translateX += 80; //offset
  let translateY = height / 2 - (y0 + dy / 2) * scale;

  if (!isFinite(scale) || !isFinite(translateX) || !isFinite(translateY)) {
    scale = 1;
    translateX = 0;
    translateY = 0;
  }

  return { scale, translate: [translateX, translateY] };
}

function mobileZoom(path, width, height) {
  const southWalesFeatures = mapData.map.features.filter(d => [
    "Blaenau Gwent","Bridgend","Caerphilly","Cardiff","Merthyr Tydfil",
    "Neath Port Talbot","Rhondda Cynon Taf","Swansea","Vale of Glamorgan"
  ].includes(d.properties.LAD25NMW));

  if (!southWalesFeatures.length) return { scale: 1, translate: [0, 0] };

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  southWalesFeatures.forEach(f => {
    const b = path.bounds(f);
    x0 = Math.min(x0, b[0][0]);
    y0 = Math.min(y0, b[0][1]);
    x1 = Math.max(x1, b[1][0]);
    y1 = Math.max(y1, b[1][1]);
  });

  const dx = x1 - x0;
  const dy = y1 - y0;
  let scale = Math.min(width / dx, height / dy) * 0.5;
  let translateX = width / 2 - (x0 + dx / 2) * scale;
  translateX += 30; //tweaking
  let translateY = height / 2 - (y0 + dy / 2) * scale;

  if (!isFinite(scale) || !isFinite(translateX) || !isFinite(translateY)) {
    scale = 1;
    translateX = 0;
    translateY = 0;
  }

  return {scale, translate: [translateX, translateY]};
}

// draw chart (desktop)
function drawChart(stepIndex) {
  const {svg, map} = mapData;
  if (!svg) return;

  const g = svg.selectAll("g.boundaries, g.tips");

  // reset transform for steps 0 and 1
  if (stepIndex === 0 || stepIndex === 1) {
    g.transition()
      .duration(1000)
      .attr("transform", "translate(0,0) scale(1)");
  }

  switch (stepIndex) {
    case 0:
      svg.selectAll("g.tips circle")
        .transition()
        .duration(500)
        .attr("opacity", 0.2)
        .attr("fill", "blue");
      break;

    case 1:
      svg.selectAll("g.tips circle")
        .transition()
        .duration(500)
        .attr("opacity", 0.6)
        .attr("fill", d => {
          const cat = d.properties.cat?.toUpperCase();
          return cat === "C" ? "orange" : cat === "D" ? "red" : "gray";
        });
      break;

    case 2: {
      const {scale, translate} = desktopZoom(+svg.attr("width"), +svg.attr("height"));
      g.transition()
        .duration(1500)
        .attrTween("transform", function() {
          const current = this.getAttribute("transform") || "translate(0,0) scale(1)";
          return d3.interpolateTransformSvg(current, `translate(${translate}) scale(${scale})`);
        });

      svg.selectAll("g.tips circle")
        .transition()
        .duration(1500)
        .attr("opacity", 0.6)
        .attr("stroke-width", 0.6)
        .attr("fill", d => {
          const cat = d.properties.cat?.toUpperCase();
          return cat === "C" ? "orange" : cat === "D" ? "red" : "gray";
        });
      break;
    }

    case 3: {
      const { scale, translate } = desktopZoom(+svg.attr("width"), +svg.attr("height"));
      g.transition()
        .duration(1500)
        .attrTween("transform", function() {
          const current = this.getAttribute("transform") || "translate(0,0) scale(1)";
          return d3.interpolateTransformSvg(current, `translate(${translate}) scale(${scale})`);
        });

      svg.selectAll("g.tips circle")
        .transition()
        .duration(100)
        .attr("opacity", d => d.properties.authority_english === "Rhondda Cynon Taf" ? 0.6 : 0)
        .attr("fill", d => {
          const cat = d.properties.cat?.toUpperCase();
          return cat === "C" ? "orange" : cat === "D" ? "red" : "gray";
        });
      break;
    }

    default:
      break;
  }
}

// mobile chart
function drawChartMobile(stepIndex, container) {
  const {map, tips} = mapData;

  // clear previous chart if exists
  d3.select(container).selectAll("svg").remove();

  const width = container.clientWidth;
  const height = 300; // fixed height for mobile

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const projection = d3.geoMercator().fitSize([width, height], map);
  const path = d3.geoPath().projection(projection);

  // draw boundaries
  const gBoundaries = svg.append("g").attr("class", "boundaries");
  gBoundaries.selectAll("path")
    .data(map.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "#eee")
    .attr("stroke", "#333")
    .attr("stroke-width", 1);

  // draw tips
  const gTips = svg.append("g").attr("class", "tips");
  gTips.selectAll("circle")
    .data(tips.features.filter(d => d.geometry && d.geometry.coordinates))
    .join("circle")
    .attr("cx", d => projection(d.geometry.coordinates)[0])
    .attr("cy", d => projection(d.geometry.coordinates)[1])
    .attr("r", 2)
    .attr("fill", "#888")
    .attr("opacity", 0);

    //steps
  switch (stepIndex) {
    case 0:
      gTips.selectAll("circle")
        .attr("opacity", 0.2)
        .attr("fill", "blue");
      break;

    case 1:
      gTips.selectAll("circle")
        .attr("opacity", 0.6)
        .attr("fill", d => {
          const cat = d.properties.cat?.toUpperCase();
          return cat === "C" ? "orange" : cat === "D" ? "red" : "gray";
        });
      break;

    case 2: {
const {scale, translate} = mobileZoom(path, width, height);
gBoundaries.attr("transform", `translate(${translate}) scale(${scale})`);
gTips.attr("transform", `translate(${translate}) scale(${scale})`);

      gTips.selectAll("circle")
        .attr("r", 1)
        .attr("opacity", 0.6)
        .attr("fill", d => {
          const cat = d.properties.cat?.toUpperCase();
          return cat === "C" ? "orange" : cat === "D" ? "red" : "gray";
        });
      break;
    }

    case 3: {
const {scale, translate} = mobileZoom(path, width, height);
gBoundaries.attr("transform", `translate(${translate}) scale(${scale})`);
gTips.attr("transform", `translate(${translate}) scale(${scale})`);

      gTips.selectAll("circle")
        .attr("r", 1)
      .attr("opacity", d => d.properties.authority_english === "Rhondda Cynon Taf" ? 0.6 : 0)
        .attr("fill", d => {
          const cat = d.properties.cat?.toUpperCase();
          return cat === "C" ? "orange" : cat === "D" ? "red" : "gray";
        });
      break;
    }
  }
}

// scrollama setup
function setupScroll() {
  const isMobile = window.innerWidth < 481;
  const steps = document.querySelectorAll(".step");

  if (!isMobile) {
    scroller = scrollama();
    scroller.setup({
      step: ".step",
      offset: 0.75,
      debug: false,
    }).onStepEnter((response) => {
      steps.forEach((step, i) => step.classList.toggle("is-active", i === response.index));
      drawChart(response.index);
    });
  } else {
    steps.forEach((step, i) => {
      const container = step.querySelector(".map-container");
      drawChartMobile(i, container);
    });
  }
}

// resize
// track previous mode for breakpoint reload
lastIsMobile = window.innerWidth < 481;

window.addEventListener("resize", () => {
  const isMobileNow = window.innerWidth < 481;

  // reload the page if switching desktop and mobile
  if (isMobileNow !== lastIsMobile) {
    window.location.reload();
  }

  lastIsMobile = isMobileNow;

  // only update map if it exists and no reload
  if (!mapData.svg) return;

  const container = document.getElementById("map");
  const width = container.clientWidth;
  const height = container.clientHeight;

  mapData.projection.fitSize([width, height - 25], mapData.map);
  mapData.svg.attr("width", width).attr("height", height);
  mapData.svg.selectAll("path").attr("d", mapData.path);
  mapData.svg.selectAll("circle")
    .attr("cx", d => mapData.projection(d.geometry.coordinates)[0])
    .attr("cy", d => mapData.projection(d.geometry.coordinates)[1]);

  if (scroller) scroller.resize();
});

// init
setUpMap().then(() => {
  setupScroll();
});








