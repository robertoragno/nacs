/* siti.qmd: renders the site-typology specimen list from js/nacs-site-types.js,
 * then builds the "mappa dei siti" (317 Legacy + NACS sites, period slider,
 * family/type filters). The two halves share one vocabulary (NACS_SITE_FAMILIES/
 * NACS_SITE_TYPES) so a click in the taxonomy can filter the map directly.
 */
(function () {
  "use strict";

  var FAMILIES = window.NACS_SITE_FAMILIES;
  var TYPES = window.NACS_SITE_TYPES;
  if (!FAMILIES || !TYPES) return;

  var TYPE_BY_KEY = {};
  TYPES.forEach(function (t) { TYPE_BY_KEY[t.type] = t; });

  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function ddRow(label, value) {
    if (value === null || value === undefined || value === "") {
      return "<dt>" + label + "</dt><dd class=\"is-empty\">Non disponibile</dd>";
    }
    return "<dt>" + label + "</dt><dd>" + esc(value) + "</dd>";
  }

  // ── Taxonomy specimen list ─────────────────────────────────────────────────

  function glyph(fam, size) {
    var f = FAMILIES[fam] || {};
    var style = 'style="--glyph-color:var(' + (f.token || "--ink-faint") + ')' +
      (size ? ";--glyph-size:" + size : "") + '"';
    return '<span class="type-glyph" data-shape="' + (f.shape || "circle") + '" ' + style + '></span>';
  }

  function renderTaxonomy(host) {
    var byFam = {};
    TYPES.forEach(function (t) { (byFam[t.fam] = byFam[t.fam] || []).push(t); });

    var html = Object.keys(FAMILIES).map(function (famKey) {
      var fam = FAMILIES[famKey];
      var members = byFam[famKey] || [];
      if (!members.length) return "";

      var types = members.map(function (t) {
        var detail = '<dl>' +
          ddRow("Definizione", t.descrizione) +
          ddRow("Evidenza di superficie", t.evidenza) +
          ddRow("Confronti · dati editi (Legacy data)", t.legacy) +
          ddRow("Confronti · fonti scritte", t.fontiScritte) +
          '</dl>';
        return (
          '<article class="taxonomy-type" id="tipo-' + esc(t.type.replace(/[^a-z0-9]+/gi, "-")) + '">' +
            '<div class="taxonomy-type-header">' +
              glyph(t.fam) +
              (t.rank ? '<span class="type-rank">' + t.rank + '</span>' : '') +
              '<h3>' + esc(t.name) + '</h3>' +
              '<button type="button" class="taxonomy-locate" data-type="' + esc(t.type) + '">Vedi sulla mappa</button>' +
            '</div>' +
            '<p class="taxonomy-blurb">' + esc(t.blurb) + '</p>' +
            '<details class="taxonomy-detail"><summary>Definizione, evidenza e confronti</summary>' + detail + '</details>' +
          '</article>'
        );
      }).join("");

      return (
        '<details class="taxonomy-family" data-fam="' + esc(famKey) + '">' +
          '<summary>' +
            glyph(famKey, "1.15rem") +
            '<span class="taxonomy-family-label">' + esc(fam.label) + '</span>' +
            '<span class="taxonomy-family-blurb">' + esc(fam.blurb) + '</span>' +
            '<span class="taxonomy-family-count" data-fam-count="' + esc(famKey) + '"></span>' +
          '</summary>' +
          '<div class="taxonomy-family-body">' + types + '</div>' +
        '</details>'
      );
    }).join("");

    host.innerHTML = html;
  }

  // A type entry lives inside a collapsed <details class="taxonomy-family">;
  // opening it is the shared last step for both the diagram and "Vedi sulla
  // mappa" navigating down into the list.
  function revealType(type) {
    var article = document.getElementById("tipo-" + type.replace(/[^a-z0-9]+/gi, "-"));
    if (!article) return;
    var family = article.closest(".taxonomy-family");
    if (family) family.open = true;
    var detail = article.querySelector(".taxonomy-detail");
    if (detail) detail.open = true;
    article.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── Progression diagram (interactive) ───────────────────────────────────────

  function wireDiagram() {
    var svg = document.getElementById("type-diagram");
    var caption = document.getElementById("diagram-caption");
    if (!svg || !caption) return;
    var defaultCaption = caption.textContent;

    function preview(node) {
      var type = node.getAttribute("data-type");
      var t = TYPE_BY_KEY[type];
      if (!t) return;
      caption.textContent = t.name + " — " + t.blurb;
      svg.querySelectorAll(".diagram-node").forEach(function (n) { n.classList.remove("is-active"); });
      node.classList.add("is-active");
    }
    function reset() {
      caption.textContent = defaultCaption;
      svg.querySelectorAll(".diagram-node").forEach(function (n) { n.classList.remove("is-active"); });
    }

    svg.querySelectorAll(".diagram-node").forEach(function (node) {
      node.addEventListener("mouseenter", function () { preview(node); });
      node.addEventListener("focus", function () { preview(node); });
      node.addEventListener("mouseleave", reset);
      node.addEventListener("blur", reset);
      node.addEventListener("click", function () { revealType(node.getAttribute("data-type")); });
      node.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); revealType(node.getAttribute("data-type")); }
      });
    });
  }

  // ── Map ──────────────────────────────────────────────────────────────────

  function initMap() {
    var el = document.getElementById("nacs-sites-map-canvas");
    var data = window.NACS_SITES_DATA;
    if (!el || typeof maplibregl === "undefined" || !data) return;

    var PERIODS = data.periods || [];
    var PERIODS_SHORT = data.periodsShort || PERIODS;

    var css = getComputedStyle(document.documentElement);
    var _c = document.createElement("canvas");
    _c.width = _c.height = 1;
    var _ctx = _c.getContext("2d", { willReadFrequently: true });
    function tok(name, fallback) {
      var v = (css.getPropertyValue(name) || "").trim();
      if (!v) return fallback;
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

    var SHAPE_POLY = {
      square:          [[0.06,0.06],[0.94,0.06],[0.94,0.94],[0.06,0.94]],
      "triangle-down": [[0.05,0.08],[0.95,0.08],[0.5,0.94]],
      "triangle-up":   [[0.5,0.06],[0.95,0.92],[0.05,0.92]],
      diamond:         [[0.5,0.02],[0.98,0.5],[0.5,0.98],[0.02,0.5]],
      hexagon:         [[0.25,0.05],[0.75,0.05],[0.98,0.5],[0.75,0.95],[0.25,0.95],[0.02,0.5]],
      pentagon:        [[0.5,0.02],[0.98,0.38],[0.82,0.98],[0.18,0.98],[0.02,0.38]],
      cross: [[0.34,0.02],[0.66,0.02],[0.66,0.34],[0.98,0.34],[0.98,0.66],[0.66,0.66],
              [0.66,0.98],[0.34,0.98],[0.34,0.66],[0.02,0.66],[0.02,0.34],[0.34,0.34]]
    };

    var ICON_SIZE = 48;
    function makeIcon(famKey) {
      var fam = FAMILIES[famKey];
      var color = tok(fam.token, "#7D6D67");
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = ICON_SIZE;
      var ctx = canvas.getContext("2d");
      var s = ICON_SIZE;

      if (fam.shape === "circle") {
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      } else if (fam.shape === "ring") {
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
        ctx.lineWidth = s * 0.14;
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        var poly = SHAPE_POLY[fam.shape];
        ctx.beginPath();
        poly.forEach(function (p, i) {
          var x = p[0] * s, y = p[1] * s;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
      // A thin ground-coloured halo so markers stay legible over both the
      // light basemap and each other where sites cluster tightly.
      ctx.globalCompositeOperation = "destination-over";
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.49, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();

      return ctx.getImageData(0, 0, s, s);
    }

    // Same two basemaps as the homepage map (js/nacs-map.js), keyless and
    // static-host-friendly.
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
      container: el,
      style: styleFor("mappa"),
      center: [15.90, 41.55],
      zoom: 9.3,
      attributionControl: false,
      cooperativeGestures: true
    });
    window.__nacssitesmap = map;   // debug handle, matches js/nacs-map.js's __nacsmap
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");

    var enabledFams = {};
    Object.keys(FAMILIES).forEach(function (f) { enabledFams[f] = true; });
    var typeFilter = null;   // set by "Vedi sulla mappa"; overrides nothing, narrows further
    var periodIndex = 0;     // 0 = tutti i periodi; 1..N = PERIODS[0..N-1]

    function famFilterExpr() {
      var on = Object.keys(enabledFams).filter(function (f) { return enabledFams[f]; });
      return ["in", ["get", "fam"], ["literal", on]];
    }
    function applyFilter() {
      var f = famFilterExpr();
      if (typeFilter) f = ["all", f, ["==", ["get", "type"], typeFilter]];
      // MapLibre's GeoJSON source flattens array-valued properties to a JSON
      // string once tiled, so a style expression can't test `p` (an array)
      // directly; prep_sites.R also emits one flat boolean p0..pN per period
      // for exactly this reason.
      if (periodIndex > 0) f = ["all", f, ["==", ["get", "p" + (periodIndex - 1)], 1]];
      if (map.getLayer("sites-pt")) map.setFilter("sites-pt", f);
      updateCounts();
    }

    function siteVisible(props) {
      if (!enabledFams[props.fam]) return false;
      if (typeFilter && props.type !== typeFilter) return false;
      if (periodIndex > 0 && props.p.indexOf(periodIndex - 1) === -1) return false;
      return true;
    }
    function updateCounts() {
      var total = 0;
      var perFam = {};
      data.features.forEach(function (f) {
        var p = f.properties;
        if (!siteVisible(p)) return;
        total++;
        perFam[p.fam] = (perFam[p.fam] || 0) + 1;
      });
      Object.keys(FAMILIES).forEach(function (f) {
        var el2 = document.querySelector('[data-fam-count="' + f + '"]');
        if (el2) {
          var n = data.features.filter(function (ft) { return ft.properties.fam === f; }).length;
          el2.textContent = n + (n === 1 ? " sito" : " siti");
        }
        var legendCount = document.querySelector('[data-legend-count="' + f + '"]');
        if (legendCount) legendCount.textContent = String(perFam[f] || 0);
      });
      var countEl = document.getElementById("sites-count");
      if (countEl) {
        countEl.textContent = periodIndex === 0
          ? total + " siti visibili"
          : total + " siti in " + PERIODS_SHORT[periodIndex - 1];
      }
    }

    // A feature read back off the map (click, queryRenderedFeatures) has had
    // its array-valued properties JSON-stringified by MapLibre's GeoJSON
    // source ("[1,3]", not [1,3]); parse before use. The panel logic never
    // hits this path since it reads window.NACS_SITES_DATA.features directly.
    function parseArrayProp(v) {
      if (Array.isArray(v)) return v;
      if (typeof v !== "string") return [];
      try { var parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; }
      catch (e) { return []; }
    }

    function popupHTML(props) {
      var t = TYPE_BY_KEY[props.type];
      var typeLabel = t ? t.name : props.type;
      var spec = parseArrayProp(props.spec);
      var p = parseArrayProp(props.p);
      var periodLabel = spec.length ? spec.join(", ")
        : p.length ? p.map(function (i) { return PERIODS_SHORT[i]; }).join(", ")
        : null;
      var rows = ddRow("Tipo", typeLabel) +
        ddRow("Periodo", periodLabel) +
        ddRow("Descrizione", props.desc);
      var srcBadge = '<span class="sites-src-badge" data-src="' + esc(props.src) + '">' + esc(props.src) + '</span>';
      return '<dl class="map-popup">' + rows + '</dl>' +
        '<p class="map-popup-src">' + srcBadge + '</p>';
    }

    // Overlapping markers (dense clusters around Manfredonia/Siponto) are
    // otherwise ambiguous to click: this lists every site under the pointer
    // instead of silently opening only the topmost one.
    function chooserHTML(feats) {
      var rows = feats.map(function (f) {
        var t = TYPE_BY_KEY[f.properties.type];
        return '<button type="button" class="sites-chooser-item" data-id="' + esc(f.properties.id) + '">' +
          '<strong>' + esc(f.properties.name) + '</strong>' +
          '<span>' + esc(t ? t.name : f.properties.type) + '</span></button>';
      }).join("");
      return '<p class="sites-chooser-hint">' + feats.length + ' siti in questo punto</p>' +
        '<div class="sites-chooser-list">' + rows + '</div>';
    }

    // Switching basemap (map.setStyle) wipes every custom image/source/layer,
    // so this needs to run again after that, not just on the map's first
    // "load" — guarded the same way js/nacs-map.js's addData() is, so a
    // repeat call is a no-op for whatever's already there.
    var _sitesWired = false;
    function addSitesLayer() {
      if (!map.getSource("sites")) {
        Object.keys(FAMILIES).forEach(function (f) {
          if (!map.hasImage(f)) map.addImage(f, makeIcon(f), { pixelRatio: 2 });
        });
        map.addSource("sites", { type: "geojson", data: data });
      }
      if (!map.getLayer("sites-pt")) map.addLayer({
        id: "sites-pt",
        source: "sites",
        type: "symbol",
        layout: {
          "icon-image": ["get", "fam"],
          "icon-size": ["interpolate", ["linear"], ["to-number", ["coalesce", ["get", "rank"], 2.5]],
                        1, 0.34, 6, 0.8],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true
        }
      });
      applyFilter();

      if (_sitesWired) return;
      _sitesWired = true;
      map.on("mousemove", "sites-pt", function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "sites-pt", function () { map.getCanvas().style.cursor = ""; });
      map.on("click", "sites-pt", function (e) {
        var seen = {};
        var feats = e.features.filter(function (f) {
          if (seen[f.properties.id]) return false;
          seen[f.properties.id] = true;
          return true;
        });
        var popup = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
          .setLngLat(e.lngLat);
        if (feats.length === 1) {
          popup.setHTML(popupHTML(feats[0].properties)).addTo(map);
          return;
        }
        popup.setHTML(chooserHTML(feats)).addTo(map);
        var el = popup.getElement();
        el.querySelectorAll(".sites-chooser-item").forEach(function (btn, i) {
          btn.addEventListener("click", function () {
            popup.setHTML(popupHTML(feats[i].properties));
          });
        });
      });
    }
    map.on("load", addSitesLayer);

    var baseToggle = document.getElementById("sites-base-toggle");
    if (baseToggle) {
      var baseWrap = document.createElement("div");
      baseWrap.className = "map-basegroup";
      ["mappa", "satellite"].forEach(function (k, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = k === "mappa" ? "Mappa" : "Satellite";
        b.setAttribute("aria-pressed", String(i === 0));
        b.addEventListener("click", function () {
          if (b.getAttribute("aria-pressed") === "true") return;
          map.setStyle(styleFor(k));
          map.once("styledata", addSitesLayer);
          baseWrap.querySelectorAll("button").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
        });
        baseWrap.appendChild(b);
      });
      baseToggle.appendChild(baseWrap);
    }

    // ── Dashboard panel ────────────────────────────────────────────────────
    var panel = document.getElementById("sites-panel");
    if (panel) {
      var legend = document.createElement("div");
      legend.className = "sites-legend";
      Object.keys(FAMILIES).forEach(function (famKey) {
        var fam = FAMILIES[famKey];
        var id = "sites-fam-" + famKey.replace(/[^a-z0-9]+/gi, "-");
        var label = document.createElement("label");
        label.htmlFor = id;
        var cb = document.createElement("input");
        cb.type = "checkbox"; cb.id = id; cb.checked = true;
        cb.addEventListener("change", function () {
          enabledFams[famKey] = cb.checked;
          applyFilter();
        });
        label.appendChild(cb);
        label.insertAdjacentHTML("beforeend", glyph(famKey));
        label.appendChild(document.createTextNode(fam.label));
        var count = document.createElement("span");
        count.className = "sites-legend-count";
        count.setAttribute("data-legend-count", famKey);
        label.appendChild(count);
        legend.appendChild(label);
      });

      var legendSection = document.createElement("div");
      legendSection.className = "sites-panel-section";
      legendSection.innerHTML = "<h2>Tipologia</h2>";
      legendSection.appendChild(legend);

      var chipSection = document.createElement("div");
      chipSection.className = "sites-panel-section";
      chipSection.innerHTML = '<p class="sites-count" id="sites-count"></p><div id="sites-chip-host"></div>';

      panel.appendChild(legendSection);
      panel.appendChild(chipSection);

      function showChip(type) {
        var t = TYPE_BY_KEY[type];
        var host = document.getElementById("sites-chip-host");
        if (!t || !host) return;
        host.innerHTML = '<span class="sites-filter-chip">Filtro: ' + esc(t.name) +
          ' <button type="button" aria-label="Rimuovi filtro">×</button></span>';
        host.querySelector("button").addEventListener("click", function () {
          typeFilter = null;
          host.innerHTML = "";
          applyFilter();
        });
      }

      window.__nacsSitesMap = {
        filterType: function (type) {
          typeFilter = type;
          var fam = TYPE_BY_KEY[type] && TYPE_BY_KEY[type].fam;
          if (fam) {
            enabledFams[fam] = true;
            var cb = document.getElementById("sites-fam-" + fam.replace(/[^a-z0-9]+/gi, "-"));
            if (cb) cb.checked = true;
          }
          showChip(type);
          applyFilter();
          flyToType(type);
        }
      };
    }

    // Bounds-fit instead of a single site's coordinates: a type can match
    // anywhere from 1 to 145 sites, so "Vedi sulla mappa" frames all of the
    // currently-matching ones rather than an arbitrary one of them.
    function flyToType(type) {
      var matching = data.features.filter(function (f) { return f.properties.type === type; });
      if (!matching.length) return;
      var bounds = new maplibregl.LngLatBounds();
      matching.forEach(function (f) { bounds.extend(f.geometry.coordinates); });
      map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 900 });
    }

    // ── Timeline (full-width, bottom of map) ────────────────────────────────
    var timeline = document.getElementById("sites-timeline");
    if (timeline) {
      // Native <input list> tick marks: cheap, keyboard/AT-friendly, and the
      // one place a plain slider can show "here is where the data actually
      // is" without hand-drawn markup.
      var ticks = PERIODS.map(function (_, i) {
        return '<option value="' + (i + 1) + '" label="' + esc(PERIODS_SHORT[i]) + '"></option>';
      }).join("");
      timeline.innerHTML =
        '<span class="sites-timeline-label" id="sites-period-label">Tutti i periodi</span>' +
        '<input type="range" id="sites-period" min="0" max="' + PERIODS.length +
          '" value="0" step="1" list="sites-period-ticks">' +
        '<datalist id="sites-period-ticks"><option value="0" label="Tutti"></option>' + ticks + '</datalist>';

      var slider = document.getElementById("sites-period");
      var sliderLabel = document.getElementById("sites-period-label");
      slider.addEventListener("input", function () {
        periodIndex = Number(slider.value);
        sliderLabel.textContent = periodIndex === 0 ? "Tutti i periodi" : PERIODS[periodIndex - 1];
        applyFilter();
      });
    }

    updateCounts();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var host = document.getElementById("taxonomy-list");
    if (host) renderTaxonomy(host);

    initMap();

    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".taxonomy-locate");
      if (!btn) return;
      var type = btn.getAttribute("data-type");
      var mapSection = document.getElementById("mappa-siti");
      if (mapSection) mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
      if (window.__nacsSitesMap) window.__nacsSitesMap.filterType(type);
    });
  });
})();
