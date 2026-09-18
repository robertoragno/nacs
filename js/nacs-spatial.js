/* spatial_analysis_functional.qmd: a class selector, an IDW density surface
 * precomputed offline (R/prep_spatial_density.R, see that file's header for
 * why IDW's linearity lets one weight matrix serve every class), and a panel
 * showing each UT's actual recorded total, not the surface's estimate.
 *
 * The interpolated layer never claims more precision than it has: no
 * per-cell hover value (the page's own callout says this is exploratory, not
 * a fitted model, so a tooltip implying an exact reading would contradict
 * it), and every cell's opacity is scaled by its distance-based confidence,
 * fading toward nothing away from any sample rather than inventing a colour
 * there.
 */
(function () {
  "use strict";

  var DATA = window.NACS_SPATIAL_DATA;
  var el = document.getElementById("nacs-spatial-map");
  if (!el || typeof maplibregl === "undefined") return;

  function showError(msg) {
    var host = document.getElementById("spatial-controls");
    if (!host) return;
    var p = host.querySelector(".map-error");
    if (!p) {
      p = document.createElement("p");
      p.className = "map-error";
      host.insertBefore(p, host.firstChild);
    }
    p.textContent = "Analisi spaziale: " + msg;
  }

  if (!DATA || !DATA.lon || !DATA.lon.length) {
    showError("dati mancanti (data/spatial/data.js non caricato?)");
    return;
  }

  // ── Design tokens, same canvas read-back nacs-map.js uses: CSS custom
  // properties are declared in OKLCH, which MapLibre's style parser rejects. ──
  var _c = document.createElement("canvas");
  _c.width = _c.height = 1;
  var _ctx = _c.getContext("2d", { willReadFrequently: true });
  function toHex(cssColor, fallback) {
    var v = (cssColor || "").trim();
    if (!v) return fallback;
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
    try {
      _ctx.clearRect(0, 0, 1, 1);
      _ctx.fillStyle = "#000";
      _ctx.fillStyle = v;
      _ctx.fillRect(0, 0, 1, 1);
      var d = _ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] === 0) return fallback;
      return "#" + [d[0], d[1], d[2]].map(function (n) { return ("0" + n.toString(16)).slice(-2); }).join("");
    } catch (e) { return fallback; }
  }
  var css = getComputedStyle(document.documentElement);
  function tok(n, fb) { return toHex((css.getPropertyValue(n) || "").trim(), fb) || fb; }

  var RULE_STRONG = tok("--rule-strong", "#998A84");
  var RAMP = [
    tok("--density-0", "#F5F4F1"),
    tok("--density-1", "#C9DADC"),
    tok("--density-2", "#7FADB2"),
    tok("--density-3", "#4C7F86"),
    tok("--density-4", "#2E545A")
  ];

  // ── Basemap (duplicated from nacs-map.js rather than shared: three small,
  // independent per-page map modules already exist on this site, and this
  // is the same handful of lines each carries, not new architecture). ──
  var BASES = {
    mappa: { kind: "style", url: "https://tiles.openfreemap.org/styles/positron" },
    satellite: {
      kind: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Esri, Maxar, Earthstar Geographics"
    }
  };
  function styleFor(which) {
    var b = BASES[which];
    if (b.kind === "style") return b.url;
    return {
      version: 8,
      sources: { base: { type: "raster", tiles: b.tiles, tileSize: 256, attribution: b.attribution } },
      layers: [{ id: "base", type: "raster", source: "base" }]
    };
  }

  var map = new maplibregl.Map({
    container: "nacs-spatial-map",
    style: styleFor("mappa"),
    center: [15.92, 41.60],
    zoom: 12.3,
    attributionControl: false,
    cooperativeGestures: true
  });
  window.__nacsspatial = map;

  // Both top corners already carry a floating panel (#spatial-controls,
  // #spatial-panel), unlike nacs-map.js's page; the zoom control moves to
  // bottom-right, stacking above the attribution control there, rather than
  // colliding with the results panel the way top-right would.
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
  // Same corner as the two controls above (native MapLibre controls sharing
  // a corner stack automatically) rather than top-right, which is already
  // #spatial-panel's corner. iOS Safari never implemented the Fullscreen API
  // for arbitrary elements (only <video>), so offering a button that would
  // silently do nothing there is worse than not offering one; this is the
  // same guard js/nacs-map.js uses, which is what makes it "web only".
  if (document.fullscreenEnabled) {
    map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
  }

  // ── The grid, built client-side from cell centres + a fixed size ───────────
  // Squares are approximated in degrees from the metric cell size using a
  // local metres-per-degree conversion: adequate for a 90 m cell (the error
  // is a fraction of a metre over this latitude range), and it avoids
  // shipping a second, redundant geometry file when the compact numeric
  // arrays already say everything needed to build it.
  var M_PER_DEG_LAT = 111320;
  function gridFeatureCollection() {
    var half = DATA.cell_m / 2;
    var feats = new Array(DATA.lon.length);
    for (var i = 0; i < DATA.lon.length; i++) {
      var lon = DATA.lon[i], lat = DATA.lat[i];
      var mPerDegLon = M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180);
      var dLon = half / mPerDegLon, dLat = half / M_PER_DEG_LAT;
      feats[i] = {
        type: "Feature", id: i, properties: { i: i },
        geometry: { type: "Polygon", coordinates: [[
          [lon - dLon, lat - dLat], [lon + dLon, lat - dLat],
          [lon + dLon, lat + dLat], [lon - dLon, lat + dLat],
          [lon - dLon, lat - dLat]
        ]] }
      };
    }
    return { type: "FeatureCollection", features: feats };
  }

  // ── Class taxonomy, read from the same metadata the R script embedded ──────
  var GROUP_ORDER = ["Aggregati pesati", "Materiale edile", "Materiale artigianale", "Vasellame", "Altro materiale fittile"];
  var byGroup = {};
  Object.keys(DATA.classes).forEach(function (key) {
    var c = DATA.classes[key];
    (byGroup[c.group] = byGroup[c.group] || []).push({ key: key, label: c.label, unit: c.unit });
  });

  // Aggregate presets (e.g. "ceramica_peso_kg"): the __count/__kg pair that
  // clears the minimum-sample bar in R. Selecting one is mutually exclusive
  // with picking that aggregate's own sub-classes individually, so a count
  // is never silently doubled.
  var AGGREGATES = (byGroup["Aggregati pesati"] || []).reduce(function (acc, c) {
    var base = c.key.replace(/__(count|kg)$/, "");
    acc[base] = acc[base] || {};
    acc[base][c.unit] = c.key;
    acc[base].label = c.label;
    return acc;
  }, {});

  // ── Selection state ─────────────────────────────────────────────────────
  var state = { keys: [], unit: "count", selectedUT: null };

  function isAggregateSelection() {
    var bases = Object.keys(AGGREGATES);
    for (var i = 0; i < bases.length; i++) {
      var a = AGGREGATES[bases[i]];
      if (state.keys.length === 1 && state.keys[0] === a[state.unit]) return a;
    }
    return null;
  }

  function combinedValues() {
    var n = DATA.lon.length;
    var out = new Float64Array(n);
    state.keys.forEach(function (k) {
      var arr = DATA.values[k];
      if (!arr) return;
      for (var i = 0; i < n; i++) out[i] += arr[i];
    });
    return out;
  }

  var _confSet = false;
  function ensureConfidenceState() {
    if (_confSet || !map.getSource("density")) return;
    for (var i = 0; i < DATA.confidence.length; i++) {
      map.setFeatureState({ source: "density", id: i }, { conf: DATA.confidence[i] });
    }
    _confSet = true;
  }

  function applySelection() {
    if (!map.getSource("density")) return;
    ensureConfidenceState();
    var vals = combinedValues();
    var max = 0;
    for (var i = 0; i < vals.length; i++) { if (vals[i] > max) max = vals[i]; }
    // The 4th ramp stop sits at the 90th percentile of what's on screen
    // rather than the true max, so one exceptional cell doesn't wash out
    // every other one to the same pale colour; the last stop still covers
    // it, just compressed into "very high" rather than owning most of the
    // ramp's range on its own.
    var sorted = Array.prototype.slice.call(vals).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    var p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
    var domainTop = Math.max(p90, max * 0.01, 1e-6);

    for (var j = 0; j < vals.length; j++) {
      map.setFeatureState({ source: "density", id: j }, { v: vals[j] });
    }

    var stops = [0, domainTop * 0.25, domainTop * 0.5, domainTop * 0.75, domainTop];
    var colorExpr = ["interpolate", ["linear"], ["coalesce", ["feature-state", "v"], 0]];
    stops.forEach(function (s, i) { colorExpr.push(s, RAMP[i]); });
    map.setPaintProperty("density-fill", "fill-color", colorExpr);
    map.setPaintProperty("density-fill", "fill-opacity", [
      "case", ["==", ["coalesce", ["feature-state", "v"], 0], 0], 0,
      ["*", 0.85, ["coalesce", ["feature-state", "conf"], 0]]
    ]);

    updateLegend(max, domainTop);
    updatePanel();
  }

  // ── Layers ──────────────────────────────────────────────────────────────
  var _added = false;
  function addLayers() {
    if (!map.getSource("density")) {
      map.addSource("density", { type: "geojson", data: gridFeatureCollection(), promoteId: "i" });
    }
    if (!map.getLayer("density-fill")) {
      map.addLayer({
        id: "density-fill", source: "density", type: "fill",
        paint: { "fill-color": RAMP[0], "fill-opacity": 0 }
      });
    }
    _confSet = false;

    // Geographic reference only, always on: the Roman city perimeters (so a
    // reader can place the density surface relative to ancient Sipontum) and
    // the Mascherone survey grid (site-scale detail inside UR 62, loaded from
    // data/map/site/data.js). Neither has a checkbox: they orient the map,
    // they are not something to analyse here.
    var romanCities = window.NACS_MAP_DATA && window.NACS_MAP_DATA.roman_cities;
    if (romanCities) {
      if (!map.getSource("roman_cities")) map.addSource("roman_cities", { type: "geojson", data: romanCities });
      if (!map.getLayer("roman_cities-fill")) map.addLayer({
        id: "roman_cities-fill", source: "roman_cities", type: "fill",
        paint: { "fill-color": "#EDEDE9", "fill-opacity": 0.75 }
      });
      if (!map.getLayer("roman_cities-line")) map.addLayer({
        id: "roman_cities-line", source: "roman_cities", type: "line",
        paint: { "line-color": "#4A4140", "line-width": 1 }
      });
      if (!map.getLayer("roman_cities-label")) map.addLayer({
        id: "roman_cities-label", source: "roman_cities", type: "symbol",
        layout: { "text-field": ["get", "Nome"], "text-font": ["Noto Sans Italic"], "text-size": 13 },
        paint: { "text-color": tok("--ink", "#2C201C"), "text-halo-color": "#fff", "text-halo-width": 1.4 }
      });
    }

    // Digitised magnetometry anomaly traces inside UR 62 (12 lines: probable
    // walls, a modern pipe, a road, per each feature's own "interpret"
    // field), a more informative reference layer over Villa Mascherone than
    // the empty collection grid would have been. Solid, not dashed: most of
    // these traces are the villa's own walls, and a dashed line reads as
    // "uncertain boundary" rather than "structure," working against the
    // one thing this layer is for, letting a reader recognise the plan.
    // Same neutral tone as the Roman city perimeters below, not the accent:
    // both are orientation/reference geometry, not something to analyse, and
    // the accent's red pulled the eye there over the actual density surface.
    var geomagn = window.NACS_MAP_DATA && window.NACS_MAP_DATA.mascherone_geomagn;
    if (geomagn) {
      if (!map.getSource("mascherone_geomagn")) map.addSource("mascherone_geomagn", { type: "geojson", data: geomagn });
      if (!map.getLayer("mascherone_geomagn-line")) map.addLayer({
        id: "mascherone_geomagn-line", source: "mascherone_geomagn", type: "line",
        paint: { "line-color": "#4A4140", "line-width": 1.6 }
      });
    }

    var utData = window.NACS_MAP_DATA && window.NACS_MAP_DATA.ut;
    if (utData) {
      if (!map.getSource("ut")) map.addSource("ut", { type: "geojson", data: utData });
      if (!map.getLayer("ut-fill")) map.addLayer({
        id: "ut-fill", source: "ut", type: "fill",
        paint: { "fill-color": "#000", "fill-opacity": 0 }   // hit target only
      });
      if (!map.getLayer("ut-line")) map.addLayer({
        id: "ut-line", source: "ut", type: "line",
        paint: { "line-color": RULE_STRONG, "line-width": 1, "line-opacity": 0.8 }
      });
      if (!map.getLayer("ut-selected")) map.addLayer({
        id: "ut-selected", source: "ut", type: "line",
        filter: ["==", ["get", "UT"], -1],
        paint: { "line-color": tok("--accent", "#99281F"), "line-width": 2.5 }
      });
    }

    if (!_added) {
      _added = true;
      map.on("mousemove", "ut-fill", function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "ut-fill", function () { map.getCanvas().style.cursor = ""; });
      map.on("click", "ut-fill", function (e) {
        var f = e.features[0];
        state.selectedUT = String(f.properties.UT);
        map.setFilter("ut-selected", ["==", ["get", "UT"], f.properties.UT]);
        updatePanel();
      });

      // The one field each anomaly trace carries ("interpret": the
      // geophysicist's own reading, e.g. "strutture", "tubo moderno") would
      // otherwise be invisible data; a plain click popup is enough for 12
      // features, no dedicated panel needed.
      if (map.getLayer("mascherone_geomagn-line")) {
        map.on("mousemove", "mascherone_geomagn-line", function () { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "mascherone_geomagn-line", function () { map.getCanvas().style.cursor = ""; });
        map.on("click", "mascherone_geomagn-line", function (e) {
          var label = e.features[0].properties.interpret || "anomalia non interpretata";
          new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
            .setLngLat(e.lngLat)
            .setHTML('<dl class="map-popup"><dt>Anomalia magnetometrica</dt><dd>' + label + "</dd></dl>")
            .addTo(map);
        });
      }
    }

    if (state.keys.length) applySelection();
  }
  map.on("load", addLayers);
  map.on("style.load", function () { if (map.isStyleLoaded()) addLayers(); });

  // ── Panel ───────────────────────────────────────────────────────────────
  function fmtNum(v, digits) {
    if (v === undefined || v === null) return "n.d.";
    var d = digits === undefined ? 2 : digits;
    return v.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: d });
  }

  function selectionLabel() {
    var agg = isAggregateSelection();
    if (agg) return agg.label;
    if (!state.keys.length) return null;
    return state.keys.map(function (k) { return (DATA.classes[k] || {}).label || k; }).join(", ");
  }

  function updatePanel() {
    var panel = document.getElementById("spatial-panel");
    if (!panel) return;
    var label = selectionLabel();

    if (!label) {
      panel.innerHTML = '<p class="spatial-panel-hint">Seleziona una o più classi per vedere la superficie di densità' +
        (state.selectedUT ? "" : " e i totali per UT.") + "</p>";
      return;
    }
    if (!state.selectedUT) {
      panel.innerHTML = '<p class="spatial-panel-hint">Classe selezionata: <strong>' + label +
        '</strong>. Clicca una UT sulla mappa per il suo totale registrato.</p>';
      return;
    }
    var tot = DATA.ut_totals[state.selectedUT];
    if (!tot) {
      panel.innerHTML = '<p class="spatial-panel-hint">Nessun dato per la UT ' + state.selectedUT + ".</p>";
      return;
    }
    var value = 0;
    state.keys.forEach(function (k) { value += (tot[k] || 0); });
    var unit = state.unit === "kg" ? "kg" : (value === 1 ? "reperto" : "reperti");
    var perHa = tot.area_ha ? value / tot.area_ha : null;

    panel.innerHTML =
      '<p class="spatial-panel-ut">UT ' + state.selectedUT + '<span class="unit">Campo ' + (tot.field_id != null ? tot.field_id : "n.d.") + "</span></p>" +
      '<p class="spatial-panel-value">' + fmtNum(value) + '<span class="unit">' + unit + " registrati, " + label + "</span></p>" +
      (perHa !== null ? '<p class="spatial-panel-density">' + fmtNum(perHa) + '<span class="unit">' + (state.unit === "kg" ? "kg/ha" : "conteggio/ha") + "</span></p>" : "") +
      '<p class="spatial-panel-link"><a href="ut.html?ut=' + encodeURIComponent(state.selectedUT) + '">Vai alla scheda completa</a></p>';
  }

  function updateLegend(max, domainTop) {
    var host = document.getElementById("spatial-legend");
    if (!host) return;
    var label = selectionLabel();
    if (!label) { host.innerHTML = ""; host.hidden = true; return; }
    host.hidden = false;
    var unitLabel = state.unit === "kg" ? "kg/ha" : "conteggio/ha";
    var swatches = RAMP.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join("");
    host.innerHTML =
      '<p class="spatial-legend-label">' + label + " &middot; " + unitLabel + "</p>" +
      '<div class="spatial-legend-ramp">' + swatches + "</div>" +
      '<div class="spatial-legend-scale"><span>0</span><span>' + fmtNum(domainTop, 1) + (max > domainTop ? "+" : "") + "</span></div>" +
      '<p class="spatial-legend-note">Superficie interpolata (IDW), non un valore misurato: più chiara e trasparente dove non ci sono UT campionate nelle vicinanze.</p>';
  }

  // ── Controls: grouped checkboxes + count/kg toggle ─────────────────────────
  // ── Info dialog ─────────────────────────────────────────────────────────
  // The page opens straight on the map now, with no lead-in paragraph, so
  // this is the only explanation offered before a reader starts ticking
  // classes. A native <dialog>, the same mechanism the UT photo lightbox
  // already uses on this site, but styled as a bounded sheet-card here
  // rather than that lightbox's full-bleed dark treatment: this is closable
  // reference content, not an immersive viewer.
  var _dialog = null;
  function buildDialog() {
    _dialog = document.createElement("dialog");
    _dialog.className = "spatial-info-dialog";
    _dialog.innerHTML =
      '<button type="button" class="spatial-info-close" aria-label="Chiudi">×</button>' +
      "<h2>Come funziona questa mappa</h2>" +
      "<ul>" +
      "<li>Seleziona una o più classi di materiale nel pannello a sinistra: la mappa mostra una superficie di densità interpolata (IDW) fra le UT campionate.</li>" +
      "<li>Il colore è più intenso dove la densità stimata è più alta, e sfuma verso il trasparente lontano da qualunque UT campionata.</li>" +
      "<li>Clicca una UT sulla mappa per il suo totale davvero registrato, non stimato, per la classe selezionata.</li>" +
      "</ul>" +
      '<p><a href="#note-metodologiche" class="spatial-info-notes-link">Leggi le note metodologiche &darr;</a></p>';
    document.body.appendChild(_dialog);
    _dialog.querySelector(".spatial-info-close").addEventListener("click", function () { _dialog.close(); });
    _dialog.addEventListener("click", function (e) { if (e.target === _dialog) _dialog.close(); });
    _dialog.querySelector(".spatial-info-notes-link").addEventListener("click", function (e) {
      e.preventDefault();
      _dialog.close();
      var target = document.getElementById("note-metodologiche");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function buildControls() {
    var host = document.getElementById("spatial-controls");
    if (!host) return;

    var header = document.createElement("div");
    header.className = "spatial-controls-header";
    var title = document.createElement("span");
    title.textContent = "Classi di materiale";
    var infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "spatial-info-btn";
    infoBtn.textContent = "?";
    infoBtn.setAttribute("aria-label", "Come funziona questa mappa");
    infoBtn.title = "Come funziona questa mappa";
    infoBtn.addEventListener("click", function () {
      if (!_dialog) buildDialog();
      if (typeof _dialog.showModal === "function") _dialog.showModal();
    });
    header.appendChild(title);
    header.appendChild(infoBtn);
    host.appendChild(header);

    var wrap = document.createElement("div");
    wrap.className = "spatial-classes";

    GROUP_ORDER.forEach(function (group) {
      var members = byGroup[group];
      if (!members || !members.length) return;

      var details = document.createElement("details");
      details.className = "taxonomy-family";
      if (group === "Aggregati pesati") details.open = true;
      var summary = document.createElement("summary");
      var label = document.createElement("span");
      label.className = "taxonomy-family-label";
      label.textContent = group;
      summary.appendChild(label);
      details.appendChild(summary);

      var body = document.createElement("div");
      body.className = "taxonomy-family-body spatial-class-list";

      members.forEach(function (m) {
        if (group === "Aggregati pesati" && m.unit === "kg") return; // paired with its count row below
        var row = document.createElement("label");
        row.className = "spatial-class-row";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = m.key;
        var isAgg = group === "Aggregati pesati";
        cb.addEventListener("change", function () {
          if (isAgg) {
            // Exclusive with every other checkbox: an aggregate stands in for
            // all its own sub-classes, so ticking it alongside them, or
            // alongside a different class, would double- or mis-count.
            wrap.querySelectorAll('input[type="checkbox"]').forEach(function (o) { if (o !== cb) o.checked = false; });
            state.keys = cb.checked ? [m.key] : [];
            var toggle = document.getElementById("spatial-unit-toggle");
            if (toggle) toggle.hidden = !cb.checked;
          } else {
            wrap.querySelectorAll(".spatial-class-row input").forEach(function (o) {
              var k = o.value, agg = AGGREGATES[k.replace(/__(count|kg)$/, "")];
              if (agg && (agg.count === k || agg.kg === k)) o.checked = false;
            });
            state.unit = "count";
            var toggle2 = document.getElementById("spatial-unit-toggle");
            if (toggle2) toggle2.hidden = true;
            state.keys = Array.prototype.slice.call(wrap.querySelectorAll('.spatial-class-list input:checked'))
              .map(function (o) { return o.value; })
              .filter(function (k) { var b = k.replace(/__(count|kg)$/, ""); return !AGGREGATES[b] || AGGREGATES[b].count !== k; });
          }
          applySelection();
        });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(" " + m.label));
        body.appendChild(row);
      });

      details.appendChild(body);
      wrap.appendChild(details);
    });

    host.appendChild(wrap);

    // Count/ha vs kg/ha: only ever relevant for the exclusive aggregate
    // selections above (the only ones with both an interpolated count AND a
    // matching weighed surface); hidden otherwise rather than shown-disabled,
    // since there is nothing to explain until an aggregate is picked.
    var toggle = document.createElement("div");
    toggle.id = "spatial-unit-toggle";
    toggle.className = "map-basegroup spatial-unit-toggle";
    toggle.hidden = true;
    ["count", "kg"].forEach(function (u) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = u === "count" ? "Conteggio/ha" : "kg/ha";
      b.setAttribute("aria-pressed", String(u === "count"));
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-pressed") === "true") return;
        var agg = isAggregateSelection();
        state.unit = u;
        if (agg) state.keys = [agg[u]];
        toggle.querySelectorAll("button").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        applySelection();
      });
      toggle.appendChild(b);
    });
    host.appendChild(toggle);

    var legend = document.createElement("div");
    legend.id = "spatial-legend";
    legend.className = "spatial-legend";
    legend.hidden = true;
    host.appendChild(legend);
  }

  buildControls();
  updatePanel();

  map.on("error", function (e) {
    console.error("[nacs-spatial] error event:", e);
    showError((e && e.error && e.error.message) || "errore imprevisto (vedi console)");
  });
})();
