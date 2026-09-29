/* Paleo-lagoon phases (data/map/laguna, built by R/prep_map.R), shared by the
 * homepage map and the Sites map. One source, one phase shown at a time via a
 * filter; the ~2.5 MB bundle loads only the first time a phase is asked for,
 * through <script src> so it also works under file://. */
window.NACSLaguna = (function () {
  "use strict";

  var PHASES = [
    { label: "Tardo Nordgrippiano", dates: "3250–2250 a.C." },
    { label: "Megalaiano iniziale", dates: "2250–450 a.C." },
    { label: "Megalaiano finale",   dates: "450 a.C. – età romana" },
    { label: "Medioevo",            dates: "" }
  ];

  // Colours from the QGIS project's Laguna group.
  var KINDS = [
    { kind: "acqua",      label: "Laguna / area umida", fill: "rgba(165,191,221,0.75)", line: "#6498D2" },
    { kind: "dune",       label: "Cordoni dunali",      fill: "rgba(240,215,150,0.71)", line: "#BE9650" },
    { kind: "idrografia", label: "Idrografia",          line: "#1E6EC8" },
    { kind: "paleodune",  label: "Paleodune",           line: "#AA783C" }
  ];

  var loading = null;
  function load() {
    if (window.NACS_MAP_DATA && window.NACS_MAP_DATA.laguna) return Promise.resolve();
    if (!loading) loading = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = "data/map/laguna/data.js";
      s.onload = ok;
      s.onerror = function () { loading = null; fail(new Error("data/map/laguna/data.js non caricato")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function match(prop, fallback) {
    var m = ["match", ["get", "kind"]];
    KINDS.forEach(function (k) { if (k[prop]) m.push(k.kind, k[prop]); });
    m.push(fallback);
    return m;
  }

  // beforeId: the lowest survey layer, so the lagoon sits under the data.
  function attach(map, beforeId) {
    var phase = 0;

    function filters() {
      var p = ["==", ["get", "phase"], phase];
      if (map.getLayer("laguna-fill")) map.setFilter("laguna-fill",
        ["all", p, ["in", ["get", "kind"], ["literal", ["acqua", "dune"]]]]);
      if (map.getLayer("laguna-line")) map.setFilter("laguna-line",
        ["all", p, ["in", ["get", "kind"], ["literal", ["idrografia", "paleodune"]]]]);
    }

    function addLayers() {
      var gj = window.NACS_MAP_DATA && window.NACS_MAP_DATA.laguna;
      if (!gj || (map.getLayer("laguna-fill") && map.getLayer("laguna-line"))) return;
      if (!map.getSource("laguna")) map.addSource("laguna", { type: "geojson", data: gj });
      var before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
      if (!map.getLayer("laguna-fill")) map.addLayer({
        id: "laguna-fill", source: "laguna", type: "fill",
        paint: { "fill-color": match("fill", "rgba(0,0,0,0)"), "fill-outline-color": match("line", "#6498D2") }
      }, before);
      if (!map.getLayer("laguna-line")) map.addLayer({
        id: "laguna-line", source: "laguna", type: "line",
        paint: { "line-color": match("line", "#1E6EC8"), "line-width": 1.2 }
      }, before);
      filters();
    }

    // A basemap switch (setStyle, applied as a diff) drops these layers
    // without a style.load, so re-add on any style change. addSource throws
    // while a style is mid-swap; the next styledata retries.
    function tryAdd() { try { addLayers(); } catch (e) { /* retried on styledata */ } }
    map.on("styledata", tryAdd);

    return {
      show: function (p) {
        phase = p;
        if (p === 0) { filters(); return Promise.resolve(); }
        return load().then(function () { tryAdd(); filters(); });
      }
    };
  }

  function legendHTML() {
    return KINDS.map(function (k) {
      var sw = k.fill
        ? "background:" + k.fill + ";border:1px solid " + k.line
        : "height:0;border-top:2px solid " + k.line;
      return '<span class="laguna-key"><span class="laguna-swatch" style="' + sw + '"></span>' + k.label + "</span>";
    }).join("");
  }

  return { PHASES: PHASES, attach: attach, legendHTML: legendHTML };
})();
