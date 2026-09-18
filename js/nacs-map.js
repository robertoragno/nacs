/* NACS landscape map — MapLibre GL.
 *
 * Replaces the Leaflet map. Two reasons: Leaflet inlined every geometry into
 * index.html (2.8 MB) and resolved basemaps by provider NAME through
 * leaflet-providers.js, which began demanding an API key. Here the tile URLs
 * are explicit and the geometry is fetched on demand (387 KB, cached).
 */
(function () {
  "use strict";

  var DATA = "data/map/";
  /* Design tokens are declared in OKLCH, which MapLibre's style parser rejects
   * outright ("color expected, oklch(...) found") and which silently drops the
   * layer. Paint each token into a 1x1 canvas and read the pixel back, so the
   * CSS custom properties stay the single source of truth and the map follows
   * a theme change instead of carrying a duplicated hard-coded palette. */
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
      _ctx.fillStyle = v;                 // invalid values leave the previous one
      _ctx.fillRect(0, 0, 1, 1);
      var d = _ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] === 0) return fallback;
      return "#" + [d[0], d[1], d[2]].map(function (n) {
        return ("0" + n.toString(16)).slice(-2);
      }).join("");
    } catch (e) { return fallback; }
  }

  var css = getComputedStyle(document.documentElement);
  var tok = function (n, fb) {
    var v = toHex((css.getPropertyValue(n) || "").trim(), fb);
    return v || fb;   // toHex must never hand a paint property `undefined`
  };

  var INK    = tok("--ink", "#2C201C");
  var ACCENT = tok("--accent", "#99281F");
  var RULE   = tok("--rule-strong", "#998A84");

  /* Basemaps must work with no API key on a static host.
   *
   * CARTO (basemaps.cartocdn.com) no longer qualifies: it still answers 200 but
   * stamps "API KEY REQUIRED" across every tile, which is what appeared on the
   * old Leaflet map. OpenFreeMap serves OSM-based vector tiles free and keyless,
   * and its "positron" style is the same muted look. Esri World Imagery is the
   * satellite layer and needs no key either.
   */
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

  var el = document.getElementById("nacs-map");
  if (!el || typeof maplibregl === "undefined") return;

  var map = new maplibregl.Map({
    container: "nacs-map",
    style: styleFor("mappa"),
    center: [15.92, 41.60],
    zoom: 11,
    attributionControl: false,
    cooperativeGestures: true   // one-finger drag scrolls the page on mobile
  });

  window.__nacsmap = map;   // debug handle

  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
  map.addControl(new maplibregl.FullscreenControl(), "top-right");

  var LAYERS = [
    { id: "aree_campione", label: "Aree campione", on: true },
    { id: "fields",        label: "Campi (UR)",    on: true },
    { id: "ut",            label: "UT",            on: true },
    { id: "roman_cities",  label: "Perimetri città romane", on: true },
    { id: "legacy_sites",  label: "Siti noti",              on: true }
  ];

  function addData() {
    LAYERS.forEach(function (L) {
      if (!map.getSource(L.id)) {
        var gj = window.NACS_MAP_DATA && window.NACS_MAP_DATA[L.id];
        if (!gj) { showMapError("dati mancanti per il livello \"" + L.id + "\" (data.js non caricato?)"); return; }
        map.addSource(L.id, { type: "geojson", data: gj });
      }
    });

    if (!map.getLayer("aree_campione-line")) map.addLayer({
      id: "aree_campione-line", source: "aree_campione", type: "line",
      paint: { "line-color": "#D64545", "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.85 }
    });

    // Matches the original Leaflet map's field colouring exactly: two states,
    // not three. survey_status TRUE -> green; NA or FALSE both collapse to
    // the same grey (the source data never actually distinguished "not
    // accessible" from "not yet walked" as separate colours).
    var FIELD_COLOR = ["case", ["==", ["get", "survey_status"], "TRUE"], "#94AE89", "#B3B3B3"];
    if (!map.getLayer("fields-fill")) map.addLayer({
      id: "fields-fill", source: "fields", type: "fill",
      paint: { "fill-color": FIELD_COLOR, "fill-opacity": 0.5 }
    });
    if (!map.getLayer("fields-line")) map.addLayer({
      id: "fields-line", source: "fields", type: "line",
      paint: { "line-color": FIELD_COLOR, "line-width": 1, "line-opacity": 1 }
    });

    if (!map.getLayer("ut-fill")) map.addLayer({
      id: "ut-fill", source: "ut", type: "fill",
      paint: { "fill-color": ACCENT, "fill-opacity": 0.5 }
    });
    if (!map.getLayer("ut-line")) map.addLayer({
      id: "ut-line", source: "ut", type: "line",
      paint: { "line-color": ACCENT, "line-width": 1 }
    });

    if (!map.getLayer("roman_cities-fill")) map.addLayer({
      id: "roman_cities-fill", source: "roman_cities", type: "fill",
      paint: { "fill-color": "#EDEDE9", "fill-opacity": 0.75 }
    });
    if (!map.getLayer("roman_cities-line")) map.addLayer({
      id: "roman_cities-line", source: "roman_cities", type: "line",
      paint: { "line-color": "#4A4140", "line-width": 1 }
    });
    // Direct labelling over a legend entry: the polygon alone didn't say
    // which Roman city it was without a click. text-font must name a font
    // this style's own glyph set actually serves ("Noto Sans ..." here, not
    // MapLibre's spec default of "Open Sans Regular") — requesting a font
    // the style doesn't have breaks bucket-building for every layer on this
    // source, not just the label, which is why the fill/line silently
    // stopped rendering too when this was first added without one.
    if (!map.getLayer("roman_cities-label")) map.addLayer({
      id: "roman_cities-label", source: "roman_cities", type: "symbol",
      layout: {
        "text-field": ["get", "Nome"],
        "text-font": ["Noto Sans Italic"],
        "text-size": 13
      },
      paint: {
        "text-color": INK,
        "text-halo-color": "#fff",
        "text-halo-width": 1.4
      }
    });

    if (!map.getLayer("legacy_sites-pt")) map.addLayer({
      id: "legacy_sites-pt", source: "legacy_sites", type: "circle",
      layout: { visibility: LAYERS.find(function (l) { return l.id === "legacy_sites"; }).on ? "visible" : "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 15, 6],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": INK,
        "circle-stroke-width": 1.2
      }
    });

    wireInteraction();
  }

  var POPUP_FIELDS = {
    "fields-fill": [["UR", "UR"], ["field_use", "Uso del suolo"],
                    ["vegetation", "Vegetazione"], ["visibility", "Visibilità"],
                    ["survey_status", "Ricognito"]],
    "ut-fill":     [["UT", "UT"], ["field_id", "Campo"],
                    ["Evidence_Type", "Tipo di evidenza"], ["note", "Note"]],
    // id_sito alone ("NACS2") told the reader nothing; Nome and a trimmed
    // Descrizione (the only place this legacy dataset records function and
    // chronology, as free text rather than structured fields) actually do.
    "legacy_sites-pt": [["Nome", "Sito"], ["id_sito", "Codice"], ["Descrizione", "Descrizione"]],
    "roman_cities-fill": [["Nome", "Città"]]
  };

  var DESCRIPTION_MAX = 220;
  function truncate(text) {
    if (text.length <= DESCRIPTION_MAX) return text;
    var cut = text.slice(0, DESCRIPTION_MAX);
    return cut.slice(0, cut.lastIndexOf(" ")) + "…";
  }

  // The UT/UR schede pages read the id back out of the query string (see
  // js/site.js) and drive the record's own reactable table to it, since that
  // table paginates and its expand state lives only in React, not in the URL.
  var RECORD_LINK = {
    "ut-fill":     { href: "ut.html",     param: "ut", field: "UT" },
    "fields-fill": { href: "fields.html", param: "ur", field: "UR" }
  };

  function popupHTML(layerId, props) {
    var rows = (POPUP_FIELDS[layerId] || []).map(function (f) {
      var v = props[f[0]];
      var missing = v === undefined || v === null || v === "" || v === "NA";
      // A censimento entry with no Descrizione is common (11 of 63 legacy
      // sites have none): say so rather than silently dropping the row, so
      // the popup doesn't read as broken when the source data is just thin.
      if (f[0] === "Descrizione" && missing) {
        return "<dt>" + f[1] + '</dt><dd class="map-popup-desc map-popup-empty">Non disponibile in questo censimento</dd>';
      }
      if (missing) return "";
      if (f[0] === "survey_status") v = (v === "TRUE") ? "sì" : (v === "FALSE" ? "no" : "da verificare");
      var ddClass = "";
      if (f[0] === "Descrizione") { v = truncate(String(v)); ddClass = ' class="map-popup-desc"'; }
      return "<dt>" + f[1] + "</dt><dd" + ddClass + ">" + String(v) + "</dd>";
    }).join("");
    if (!rows) return null;
    var html = '<dl class="map-popup">' + rows + "</dl>";
    var link = RECORD_LINK[layerId];
    var id = link && props[link.field];
    if (id !== undefined && id !== null && id !== "") {
      html += '<a class="map-popup-link" href="' + link.href + "?" + link.param + "=" +
        encodeURIComponent(id) + '">Vai alla scheda completa</a>';
    }
    return html;
  }

  var CLICKABLE = ["ut-fill", "fields-fill", "legacy_sites-pt", "roman_cities-fill"];
  var _wired = false;

  function wireInteraction() {
    if (_wired) return;   // addData() re-runs on a basemap switch; wire once.
    _wired = true;

    // One map-level handler, not one per layer: registering a separate
    // "click" listener on each layer meant every layer under the cursor
    // fired independently (a UT sitting inside its field opened both
    // popups at once). queryRenderedFeatures returns hits topmost-first,
    // so taking only the first one shows exactly the feature the user
    // actually clicked on.
    map.on("click", function (e) {
      var present = CLICKABLE.filter(function (id) { return map.getLayer(id); });
      var hits = map.queryRenderedFeatures(e.point, { layers: present });
      if (!hits.length) return;
      var top = hits[0];
      var html = popupHTML(top.layer.id, top.properties);
      if (!html) return;
      new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
        .setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    map.on("mousemove", function (e) {
      var present = CLICKABLE.filter(function (id) { return map.getLayer(id); });
      var hits = map.queryRenderedFeatures(e.point, { layers: present });
      map.getCanvas().style.cursor = hits.length ? "pointer" : "";
    });
  }

  function buildControls() {
    var host = document.getElementById("nacs-map-controls");
    if (!host) return;

    var baseWrap = document.createElement("div");
    baseWrap.className = "map-basegroup";
    ["mappa", "satellite"].forEach(function (k, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = k === "mappa" ? "Mappa" : "Satellite";
      b.setAttribute("aria-pressed", String(i === 0));
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-pressed") === "true") return;
        var visible = {};
        LAYERS.forEach(function (L) {
          map.getStyle().layers.forEach(function (ly) {
            if (ly.id.indexOf(L.id) === 0) visible[ly.id] = map.getLayoutProperty(ly.id, "visibility") !== "none";
          });
        });
        map.setStyle(styleFor(k));
        map.once("styledata", function () {
          addData();
          Object.keys(visible).forEach(function (id) {
            if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible[id] ? "visible" : "none");
          });
        });
        baseWrap.querySelectorAll("button").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
      });
      baseWrap.appendChild(b);
    });

    var layerWrap = document.createElement("div");
    layerWrap.className = "map-layergroup";
    LAYERS.forEach(function (L) {
      var id = "lyr-" + L.id;
      var lab = document.createElement("label");
      lab.htmlFor = id;
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.id = id; cb.checked = L.on;
      cb.addEventListener("change", function () {
        map.getStyle().layers.forEach(function (ly) {
          if (ly.id.indexOf(L.id) === 0) {
            map.setLayoutProperty(ly.id, "visibility", cb.checked ? "visible" : "none");
          }
        });
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(L.label));
      layerWrap.appendChild(lab);
    });

    host.innerHTML = "";
    host.appendChild(baseWrap);
    host.appendChild(layerWrap);
  }

  // The controls do not depend on the style, so build them at once: waiting for
  // "load" means waiting for the first tiles, which can stall on a slow
  // connection and leave the reader with a map they cannot configure.
  buildControls();

  // Surfaces a failure on the page instead of a silently blank map: any
  // MapLibre runtime error (a malformed style, a source that fails to parse)
  // fires here, independent of whether it happened inside a try/catch.
  function showMapError(msg) {
    var h = document.getElementById("nacs-map-controls");
    if (h && !h.querySelector(".map-error")) {
      h.insertAdjacentHTML("afterbegin", '<p class="map-error"></p>');
    }
    if (h) h.querySelector(".map-error").textContent = "Mappa: " + msg;
  }
  function describeMapError(e) {
    // MapLibre's 'error' event shape varies by failure: a style/paint
    // validation error, a failed source/tile fetch, and a generic runtime
    // exception all report differently. Try every field that has ever
    // carried the real reason, and always log the raw event to the console
    // even when the on-page summary has to fall back to something generic.
    console.error("[nacs-map] error event:", e);
    var err = e && e.error;
    var bits = [];
    if (e && e.sourceId) bits.push("source=" + e.sourceId);
    if (err) {
      if (err.message) bits.push(err.message);
      else if (err.status) bits.push("HTTP " + err.status + (err.url ? " " + err.url : ""));
      else if (typeof err === "string") bits.push(err);
      else { try { bits.push(JSON.stringify(err)); } catch (_) { bits.push(String(err)); } }
    }
    if (!bits.length) { try { bits.push(JSON.stringify(e)); } catch (_) { bits.push(String(e)); } }
    return bits.join(" ") || "errore senza dettagli (vedi console)";
  }
  map.on("error", function (e) { showMapError(describeMapError(e)); });

  // The data is loaded via <script src="data/map/data.js">, not fetch(): a
  // fetch() to a local file is blocked outright under file://, which is how
  // people preview the site by double-clicking index.html, while a
  // <script src> tag (same mechanism that loads this very file) is not
  // subject to that restriction. This just confirms the bundle actually
  // arrived and each layer has features, independent of MapLibre's own state.
  function verifyDataFiles() {
    if (!window.NACS_MAP_DATA) {
      showMapError("data/map/data.js non caricato (controlla il <script src> nella pagina)");
      return;
    }
    LAYERS.forEach(function (L) {
      var gj = window.NACS_MAP_DATA[L.id];
      if (!gj) showMapError("livello \"" + L.id + "\" assente da data.js");
      else if (!gj.features || gj.features.length === 0) showMapError("livello \"" + L.id + "\" ha 0 elementi");
    });
  }

  // "style.load" fires when the style is parsed, without waiting for tiles.
  map.on("style.load", function () {
    verifyDataFiles();
    try { addData(); } catch (err) {
      showMapError(err && err.message ? err.message : String(err));
      return;
    }

    // Frame the two active sample areas (Codice 1 and 2), not every sample
    // area ever drawn across the wider territory (aree_campione.json holds
    // Codice 1-9; most of those aren't part of this survey's active work).
    var aree = window.NACS_MAP_DATA && window.NACS_MAP_DATA.aree_campione;
    if (aree) {
      var active = aree.features.filter(function (f) {
        var c = Number(f.properties && f.properties.Codice);
        return c === 1 || c === 2;
      });
      var b = new maplibregl.LngLatBounds();
      active.forEach(function (f) {
        var walk = function (c) { if (typeof c[0] === "number") b.extend(c); else c.forEach(walk); };
        walk(f.geometry.coordinates);
      });
      if (!b.isEmpty()) map.fitBounds(b, { padding: 40, duration: 0 });
    }
  });
})();
