/* NACS per-record locator map — replaces the static per-UT/per-field PNGs.
 *
 * Reuses the same data/map/*.json bundle (loaded via data.js/<script src>,
 * so it also works under file://) already built for the homepage map.
 * Renders lazily: a mini-map is only created once its container actually
 * appears in the DOM (reactable inserts row-detail HTML on expand), and is
 * torn down when that DOM node is removed, so expanding/collapsing many
 * rows in one session doesn't exhaust the browser's WebGL context limit.
 */
(function () {
  "use strict";
  if (typeof maplibregl === "undefined") return;

  var STYLE = "https://tiles.openfreemap.org/styles/positron";

  // Same OKLCH -> hex resolution nacs-map.js uses, duplicated minimally
  // rather than shared, since this file must also work standalone.
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
      return "#" + [d[0], d[1], d[2]].map(function (n) {
        return ("0" + n.toString(16)).slice(-2);
      }).join("");
    } catch (e) { return fallback; }
  }
  function accentColor() {
    var css = getComputedStyle(document.documentElement);
    return toHex((css.getPropertyValue("--accent") || "").trim(), "#99281F");
  }

  function walkCoords(coords, bounds) {
    if (typeof coords[0] === "number") bounds.extend(coords);
    else coords.forEach(function (c) { walkCoords(c, bounds); });
  }

  var live = new WeakMap();   // container element -> maplibregl.Map instance

  function build(el) {
    el.dataset.mmReady = "1";
    var kind = el.dataset.kind;               // "ut" | "field"
    var id   = Number(el.dataset.id);
    var data = window.NACS_MAP_DATA;
    if (!data || !data.fields || !data.ut) {
      el.textContent = "Mappa non disponibile.";
      return;
    }

    var map = new maplibregl.Map({
      container: el, style: STYLE, attributionControl: false,
      interactive: true, cooperativeGestures: true
    });
    live.set(el, map);

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("style.load", function () {
      var accent = accentColor();

      // Context: every field, using the same colouring as the main map.
      map.addSource("fields", { type: "geojson", data: data.fields });
      map.addLayer({
        id: "ctx-fields-fill", type: "fill", source: "fields",
        paint: {
          "fill-color": ["case", ["==", ["get", "survey_status"], "TRUE"], "#94AE89", "#B3B3B3"],
          "fill-opacity": 0.35
        }
      });
      map.addLayer({
        id: "ctx-fields-line", type: "line", source: "fields",
        paint: {
          "line-color": ["case", ["==", ["get", "survey_status"], "TRUE"], "#94AE89", "#B3B3B3"],
          "line-width": 0.5
        }
      });

      // The record itself, highlighted. UT records also draw the UT source
      // so their own (usually much smaller) boundary is visible over the
      // field context, matching what the static maps used to show.
      var idField, hlSource;
      if (kind === "ut") {
        map.addSource("ut", { type: "geojson", data: data.ut });
        idField = "UT"; hlSource = "ut";
      } else {
        idField = "UR"; hlSource = "fields";
      }
      var filter = ["==", ["get", idField], id];
      map.addLayer({
        id: "hl-fill", type: "fill", source: hlSource, filter: filter,
        paint: { "fill-color": accent, "fill-opacity": 0.55 }
      });
      map.addLayer({
        id: "hl-line", type: "line", source: hlSource, filter: filter,
        paint: { "line-color": accent, "line-width": 2 }
      });

      var feats = (data[hlSource].features || []).filter(function (f) {
        return Number(f.properties[idField]) === id;
      });
      if (!feats.length) {
        el.insertAdjacentHTML("beforeend",
          '<p class="mini-map-note">Geometria non trovata per ' + kind.toUpperCase() + " " + id + ".</p>");
        return;
      }
      var bounds = new maplibregl.LngLatBounds();
      feats.forEach(function (f) { walkCoords(f.geometry.coordinates, bounds); });
      map.fitBounds(bounds, { padding: 50, maxZoom: 17, duration: 0 });
    });
  }

  function destroy(el) {
    var map = live.get(el);
    if (map) { try { map.remove(); } catch (e) { /* already gone */ } live.delete(el); }
  }

  function scanFor(root, fn) {
    if (root.nodeType !== 1) return;
    if (root.matches && root.matches(".mini-map")) fn(root);
    if (root.querySelectorAll) root.querySelectorAll(".mini-map").forEach(fn);
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        scanFor(n, function (el) { if (!el.dataset.mmReady) build(el); });
      });
      m.removedNodes.forEach(function (n) { scanFor(n, destroy); });
    });
  }).observe(document.body, { childList: true, subtree: true });

  // Anything already on the page at load time (no expand interaction needed).
  scanFor(document.body, function (el) { if (!el.dataset.mmReady) build(el); });
})();
