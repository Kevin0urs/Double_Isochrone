/**
 * ====================================================================
 * DOUBLE ISOCHRONE - LOGIQUE APPLICATIVE
 * ====================================================================
 * Application cartographique interactive statique pour GitHub Pages.
 * Utilise Leaflet, Turf.js et les API OpenRouteService (Géocodage + Isochrones).
 * ====================================================================
 */

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // 1. ÉTAT GLOBAL CENTRALISÉ
  // ------------------------------------------------------------------
  const state = {
    apiKey: '',
    isConfigured: false,

    // Paramètres des points
    points: {
      A: {
        lat: null,
        lon: null,
        label: '',
        mode: 'driving-car',
        duration: 30 // en minutes
      },
      B: {
        lat: null,
        lon: null,
        label: '',
        mode: 'driving-car',
        duration: 30 // en minutes
      }
    },

    // Données GeoJSON calculées
    geojsonData: {
      A: null,
      B: null,
      intersection: null
    },

    // Superficies en km²
    areas: {
      A: 0,
      B: 0,
      intersection: 0
    },

    // Couches et marqueurs Leaflet
    map: null,
    markers: {
      A: null,
      B: null
    },
    layers: {
      A: null,
      B: null,
      intersection: null
    },

    // Panes personnalisés pour l'ordre d'affichage
    panes: {
      isochroneA: null,
      isochroneB: null,
      intersection: null
    },

    // Contrôle d'état d'interaction
    activeSelectionMode: null, // 'A' | 'B' | null
    isCalculating: false,
    resultsCalculated: false,

    // Contrôleurs d'annulation des requêtes HTTP (AbortController)
    abortControllers: {
      searchA: null,
      searchB: null,
      calculate: null
    },

    // Position initiale par défaut (Sud-Ouest de la France / Nouvelle-Aquitaine)
    defaultView: {
      center: [44.5, -0.2],
      zoom: 8
    }
  };

  // ------------------------------------------------------------------
  // 2. RÉFÉRENCES AUX ÉLÉMENTS DU DOM
  // ------------------------------------------------------------------
  const dom = {};

  function cacheDomElements() {
    // Alerte configuration
    dom.configWarning = document.getElementById('config-warning');
    dom.configWarningText = document.getElementById('config-warning-text');

    // Messages d'état
    dom.statusCard = document.getElementById('status-card');
    dom.statusSpinner = document.getElementById('status-spinner');
    dom.statusText = document.getElementById('status-text');

    // Point A
    dom.searchA = document.getElementById('search-a');
    dom.btnClearSearchA = document.getElementById('btn-clear-search-a');
    dom.suggestionsA = document.getElementById('suggestions-a');
    dom.btnSelectMapA = document.getElementById('btn-select-map-a');
    dom.labelA = document.getElementById('label-a');
    dom.latA = document.getElementById('lat-a');
    dom.lonA = document.getElementById('lon-a');
    dom.modeA = document.getElementById('mode-a');
    dom.durationA = document.getElementById('duration-a');
    dom.durationNumA = document.getElementById('duration-num-a');
    dom.durationDisplayA = document.getElementById('duration-display-a');

    // Point B
    dom.searchB = document.getElementById('search-b');
    dom.btnClearSearchB = document.getElementById('btn-clear-search-b');
    dom.suggestionsB = document.getElementById('suggestions-b');
    dom.btnSelectMapB = document.getElementById('btn-select-map-b');
    dom.labelB = document.getElementById('label-b');
    dom.latB = document.getElementById('lat-b');
    dom.lonB = document.getElementById('lon-b');
    dom.modeB = document.getElementById('mode-b');
    dom.durationB = document.getElementById('duration-b');
    dom.durationNumB = document.getElementById('duration-num-b');
    dom.durationDisplayB = document.getElementById('duration-display-b');

    // Boutons d'action
    dom.btnCalculate = document.getElementById('btn-calculate');
    dom.btnRecenter = document.getElementById('btn-recenter');
    dom.btnExportA = document.getElementById('btn-export-a');
    dom.btnExportB = document.getElementById('btn-export-b');
    dom.btnExportCommon = document.getElementById('btn-export-common');
    dom.btnReset = document.getElementById('btn-reset');

    // Panneau de résultats
    dom.resultsPanel = document.getElementById('results-panel');
    dom.resAddrA = document.getElementById('res-addr-a');
    dom.resModeA = document.getElementById('res-mode-a');
    dom.resDurationA = document.getElementById('res-duration-a');
    dom.resAreaA = document.getElementById('res-area-a');

    dom.resAddrB = document.getElementById('res-addr-b');
    dom.resModeB = document.getElementById('res-mode-b');
    dom.resDurationB = document.getElementById('res-duration-b');
    dom.resAreaB = document.getElementById('res-area-b');

    dom.resCommonStatus = document.getElementById('res-common-status');
    dom.resAreaCommon = document.getElementById('res-area-common');
    dom.resShareA = document.getElementById('res-share-a');
    dom.resShareB = document.getElementById('res-share-b');

    // Bascules de couches
    dom.toggleLayerA = document.getElementById('toggle-layer-a');
    dom.toggleLayerB = document.getElementById('toggle-layer-b');
    dom.toggleLayerCommon = document.getElementById('toggle-layer-common');
  }

  // ------------------------------------------------------------------
  // 3. VÉRIFICATION DE LA CONFIGURATION
  // ------------------------------------------------------------------
  function checkConfiguration() {
    const config = window.APP_CONFIG || {};
    const key = config.ORS_API_KEY ? String(config.ORS_API_KEY).trim() : '';

    if (!key || key === 'VOTRE_CLE_OPENROUTESERVICE' || key.length < 15) {
      state.isConfigured = false;
      state.apiKey = '';
      if (dom.configWarning) {
        dom.configWarning.classList.remove('is-hidden');
      }
      showStatus(
        'La clé OpenRouteService n’est pas configurée. Renseignez-la dans le fichier config.js avant d’utiliser l’application.',
        'warning'
      );
      dom.btnCalculate.disabled = true;
      return false;
    }

    state.isConfigured = true;
    state.apiKey = key;
    if (dom.configWarning) {
      dom.configWarning.classList.add('is-hidden');
    }
    return true;
  }

  // ------------------------------------------------------------------
  // 4. INITIALISATION DE LA CARTE LEAFLET
  // ------------------------------------------------------------------
  function initMap() {
    // Création de la carte avec centrage sur le Sud-Ouest (Nouvelle-Aquitaine)
    state.map = L.map('map', {
      center: state.defaultView.center,
      zoom: state.defaultView.zoom,
      zoomControl: true
    });

    // Échelle métrique
    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(state.map);

    // Fond de carte OpenStreetMap officiel avec attribution obligatoire
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Contributeurs d’OpenStreetMap</a>'
    }).addTo(state.map);

    // Création de panes Leaflet dédiés pour garantir un ordre d'empilement strict :
    // Ordre : 1. isochrone A -> 2. isochrone B -> 3. intersection -> 4. marqueurs (markerPane Leaflet zIndex 600)
    state.panes.isochroneA = state.map.createPane('pane-isochrone-a');
    state.panes.isochroneA.style.zIndex = '410';

    state.panes.isochroneB = state.map.createPane('pane-isochrone-b');
    state.panes.isochroneB.style.zIndex = '420';

    state.panes.intersection = state.map.createPane('pane-intersection');
    state.panes.intersection.style.zIndex = '430';

    // Événement clic sur la carte
    state.map.on('click', handleMapClick);
  }

  // ------------------------------------------------------------------
  // 5. GESTION DES MARQUEURS ET SÉLECTION CARTE
  // ------------------------------------------------------------------
  function createCustomMarkerIcon(pointType) {
    const isA = pointType === 'A';
    return L.divIcon({
      className: '',
      html: `<div class="custom-leaflet-marker ${isA ? 'marker-pin-a' : 'marker-pin-b'}" style="width:32px; height:32px;">${pointType}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  }

  function setPointCoordinates(pointType, lat, lon, label) {
    const pt = state.points[pointType];
    pt.lat = parseFloat(lat);
    pt.lon = parseFloat(lon);
    pt.label = label || `Position (${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)})`;

    // Mise à jour de l'affichage dans le formulaire
    if (pointType === 'A') {
      dom.labelA.textContent = pt.label;
      dom.latA.textContent = pt.lat.toFixed(5);
      dom.lonA.textContent = pt.lon.toFixed(5);
    } else {
      dom.labelB.textContent = pt.label;
      dom.latB.textContent = pt.lat.toFixed(5);
      dom.lonB.textContent = pt.lon.toFixed(5);
    }

    // Mise à jour ou création du marqueur Leaflet
    if (state.markers[pointType]) {
      state.markers[pointType].setLatLng([pt.lat, pt.lon]);
      state.markers[pointType].setPopupContent(`<strong>Point ${pointType}</strong><br>${pt.label}`);
    } else {
      const marker = L.marker([pt.lat, pt.lon], {
        icon: createCustomMarkerIcon(pointType),
        draggable: true,
        title: `Point de départ ${pointType} (déplaçable)`
      }).addTo(state.map);

      marker.bindPopup(`<strong>Point ${pointType}</strong><br>${pt.label}`);
      marker.bindTooltip(`Point ${pointType}`, { permanent: false, direction: 'top' });

      // Événement fin de déplacement du marqueur
      marker.on('dragend', function (e) {
        const newLatLng = e.target.getLatLng();
        setPointCoordinates(pointType, newLatLng.lat, newLatLng.lng, `Position (${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)})`);
        reverseGeocode(pointType, newLatLng.lat, newLatLng.lng);
        invalidateResults();
      });

      state.markers[pointType] = marker;
    }

    invalidateResults();
  }

  function toggleMapSelectionMode(pointType) {
    if (state.activeSelectionMode === pointType) {
      // Désactivation
      deactivateMapSelection();
      showStatus('Sélection sur la carte désactivée.', 'info');
    } else {
      // Activation
      state.activeSelectionMode = pointType;
      const isA = pointType === 'A';
      dom.btnSelectMapA.classList.toggle('is-active', isA);
      dom.btnSelectMapA.setAttribute('aria-pressed', isA ? 'true' : 'false');
      dom.btnSelectMapB.classList.toggle('is-active', !isA);
      dom.btnSelectMapB.setAttribute('aria-pressed', !isA ? 'true' : 'false');

      state.map.getContainer().style.cursor = 'crosshair';
      showStatus(`Cliquez sur la carte pour positionner le Point ${pointType}.`, 'info');
    }
  }

  function deactivateMapSelection() {
    state.activeSelectionMode = null;
    dom.btnSelectMapA.classList.remove('is-active');
    dom.btnSelectMapA.setAttribute('aria-pressed', 'false');
    dom.btnSelectMapB.classList.remove('is-active');
    dom.btnSelectMapB.setAttribute('aria-pressed', 'false');
    if (state.map) {
      state.map.getContainer().style.cursor = '';
    }
  }

  function handleMapClick(e) {
    if (!state.activeSelectionMode) return;

    const pointType = state.activeSelectionMode;
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    setPointCoordinates(pointType, lat, lon, `Position (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
    reverseGeocode(pointType, lat, lon);

    showStatus(`Point ${pointType} positionné avec succès.`, 'success');
    deactivateMapSelection();
  }

  // ------------------------------------------------------------------
  // 6. GÉOCODAGE & RECHERCHE D'ADRESSES (OPENROUTESERVICE)
  // ------------------------------------------------------------------
  function setupAddressSearch(pointType) {
    const input = pointType === 'A' ? dom.searchA : dom.searchB;
    const list = pointType === 'A' ? dom.suggestionsA : dom.suggestionsB;
    const btnClear = pointType === 'A' ? dom.btnClearSearchA : dom.btnClearSearchB;
    let debounceTimer = null;
    let activeSuggestionIndex = -1;

    // Saisie utilisateur avec temporisation de 500 ms
    input.addEventListener('input', function () {
      const query = input.value.trim();
      btnClear.classList.toggle('is-hidden', query.length === 0);

      clearTimeout(debounceTimer);
      activeSuggestionIndex = -1;

      if (query.length < 3) {
        hideSuggestions(list, input);
        return;
      }

      debounceTimer = setTimeout(() => {
        executeAddressSearch(pointType, query);
      }, 500);
    });

    // Effacement de la recherche
    btnClear.addEventListener('click', function () {
      input.value = '';
      btnClear.classList.add('is-hidden');
      hideSuggestions(list, input);
      input.focus();
    });

    // Navigation au clavier dans les suggestions
    input.addEventListener('keydown', function (e) {
      const items = list.querySelectorAll('.suggestion-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
        updateActiveSuggestion(items, activeSuggestionIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
        updateActiveSuggestion(items, activeSuggestionIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
          items[activeSuggestionIndex].click();
        }
      } else if (e.key === 'Escape') {
        hideSuggestions(list, input);
      }
    });

    // Fermeture lors du clic en dehors
    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !list.contains(e.target)) {
        hideSuggestions(list, input);
      }
    });
  }

  function updateActiveSuggestion(items, index) {
    items.forEach((item, idx) => {
      const isActive = idx === index;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function hideSuggestions(list, input) {
    list.classList.add('is-hidden');
    list.innerHTML = '';
    if (input) {
      input.setAttribute('aria-expanded', 'false');
    }
  }

  async function executeAddressSearch(pointType, query) {
    const list = pointType === 'A' ? dom.suggestionsA : dom.suggestionsB;
    const input = pointType === 'A' ? dom.searchA : dom.searchB;

    if (!checkConfiguration()) {
      showStatus('Configurez votre clé OpenRouteService dans config.js pour rechercher une adresse.', 'warning');
      return;
    }

    // Annuler la requête précédente pour ce champ
    const controllerKey = `search${pointType}`;
    if (state.abortControllers[controllerKey]) {
      state.abortControllers[controllerKey].abort();
    }
    state.abortControllers[controllerKey] = new AbortController();
    const signal = state.abortControllers[controllerKey].signal;

    // Service d'autocomplétion OpenRouteService / Pelias
    // On privilégie la France via focus.point au centre de la France (46.5, 2.5),
    // sans bloquer les autres pays si recherchés.
    const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${encodeURIComponent(state.apiKey)}&text=${encodeURIComponent(query)}&size=5&focus.point.lat=46.5&focus.point.lon=2.5`;

    try {
      const response = await fetch(url, { signal });

      if (!response.ok) {
        handleHttpError(response.status, 'Recherche d’adresse');
        return;
      }

      const data = await response.json();

      if (!data || !data.features || data.features.length === 0) {
        list.innerHTML = `<li class="suggestion-item" role="option"><em>Aucune adresse trouvée pour "${escapeHtml(query)}"</em></li>`;
        list.classList.remove('is-hidden');
        input.setAttribute('aria-expanded', 'true');
        return;
      }

      // Remplissage de la liste des suggestions (max 5 résultats)
      list.innerHTML = '';
      data.features.slice(0, 5).forEach((feature, index) => {
        const label = feature.properties.label || feature.properties.name || 'Adresse sans libellé';
        const coords = feature.geometry.coordinates; // [lon, lat]

        const li = document.createElement('li');
        li.className = 'suggestion-item';
        li.setAttribute('role', 'option');
        li.setAttribute('id', `sugg-${pointType}-${index}`);
        li.innerHTML = `
          <span class="suggestion-icon" aria-hidden="true">📍</span>
          <span class="suggestion-text">${escapeHtml(label)}</span>
        `;

        li.addEventListener('click', function () {
          setPointCoordinates(pointType, coords[1], coords[0], label);
          input.value = label;
          hideSuggestions(list, input);
          state.map.setView([coords[1], coords[0]], 12);
          showStatus(`Point ${pointType} défini : ${label}`, 'success');
        });

        list.appendChild(li);
      });

      list.classList.remove('is-hidden');
      input.setAttribute('aria-expanded', 'true');

    } catch (err) {
      if (err.name === 'AbortError') {
        // Requête annulée normalement lors de la frappe rapide
        return;
      }
      console.error('Erreur recherche géocodage :', err);
      showStatus('Erreur de communication avec le service de géocodage. Vérifiez votre connexion.', 'error');
    }
  }

  // Géocodage inverse lors d'un clic ou déplacement de marqueur
  async function reverseGeocode(pointType, lat, lon) {
    if (!state.isConfigured) return;

    try {
      const url = `https://api.openrouteservice.org/geocode/reverse?api_key=${encodeURIComponent(state.apiKey)}&point.lat=${lat}&point.lon=${lon}&size=1`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
          const address = data.features[0].properties.label || data.features[0].properties.name;
          if (address) {
            state.points[pointType].label = address;
            if (pointType === 'A') {
              dom.labelA.textContent = address;
              dom.searchA.value = address;
              dom.btnClearSearchA.classList.remove('is-hidden');
            } else {
              dom.labelB.textContent = address;
              dom.searchB.value = address;
              dom.btnClearSearchB.classList.remove('is-hidden');
            }
            if (state.markers[pointType]) {
              state.markers[pointType].setPopupContent(`<strong>Point ${pointType}</strong><br>${address}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Géocodage inverse non disponible :', err);
    }
  }

  // ------------------------------------------------------------------
  // 7. INVALIDATION DES RÉSULTATS LORS D'UN CHANGEMENT DE PARAMÈTRE
  // ------------------------------------------------------------------
  function invalidateResults() {
    if (!state.resultsCalculated) return;

    state.resultsCalculated = false;

    // Suppression des couches d'isochrones et d'intersection
    clearIsochroneLayers();

    // Désactivation des exports et du recentrage
    dom.btnRecenter.disabled = true;
    dom.btnExportA.disabled = true;
    dom.btnExportB.disabled = true;
    dom.btnExportCommon.disabled = true;

    // Masquage ou indication dans le panneau de résultats
    dom.resultsPanel.classList.add('is-hidden');

    // Message d'information conforme aux exigences
    showStatus('Les paramètres ont été modifiés. Relancez le calcul.', 'warning');
  }

  function removeIsochroneMapLayers() {
    if (state.layers.A) {
      state.map.removeLayer(state.layers.A);
      state.layers.A = null;
    }
    if (state.layers.B) {
      state.map.removeLayer(state.layers.B);
      state.layers.B = null;
    }
    if (state.layers.intersection) {
      state.map.removeLayer(state.layers.intersection);
      state.layers.intersection = null;
    }
  }

  function clearIsochroneLayers() {
    removeIsochroneMapLayers();
    state.geojsonData.A = null;
    state.geojsonData.B = null;
    state.geojsonData.intersection = null;
  }

  // ------------------------------------------------------------------
  // 8. APPEL DE L'API D'ISOCHRONES OPENROUTESERVICE
  // ------------------------------------------------------------------
  async function fetchIsochrone(pointType, signal) {
    const pt = state.points[pointType];
    const durationSeconds = pt.duration * 60; // Conversion minutes en secondes

    const url = `https://api.openrouteservice.org/v2/isochrones/${encodeURIComponent(pt.mode)}`;

    const bodyPayload = {
      locations: [[pt.lon, pt.lat]], // Ordre impératif ORS : [longitude, latitude]
      range: [durationSeconds],
      range_type: 'time'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': state.apiKey,
        'Accept': 'application/json, application/geo+json'
      },
      body: JSON.stringify(bodyPayload),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Code HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errorMsg = parsed.error.message;
        }
      } catch (e) {
        // Texte brut
      }
      throw new Error(`Erreur lors du calcul de l’isochrone ${pointType} : ${translateApiError(response.status, errorMsg)}`);
    }

    const data = await response.json();

    if (!data || !data.features || data.features.length === 0) {
      throw new Error(`Aucune géométrie d'isochrone retournée pour le point ${pointType}.`);
    }

    return data;
  }

  // ------------------------------------------------------------------
  // 9. EXTRACTION & NORMALISATION DES GÉOMÉTRIES TURF.JS
  // ------------------------------------------------------------------
  function extractPolygons(geojson) {
    if (!geojson) return [];
    const polygons = [];

    function processFeature(feature) {
      if (!feature || !feature.geometry) return;
      const geom = feature.geometry;
      if (geom.type === 'Polygon') {
        polygons.push(turf.polygon(geom.coordinates, feature.properties || {}));
      } else if (geom.type === 'MultiPolygon') {
        // Décomposer chaque composante du MultiPolygon en un Polygon simple pour Turf
        geom.coordinates.forEach(coords => {
          polygons.push(turf.polygon(coords, feature.properties || {}));
        });
      } else if (geom.type === 'GeometryCollection') {
        (geom.geometries || []).forEach(g => {
          processFeature({ type: 'Feature', geometry: g, properties: feature.properties });
        });
      }
    }

    if (geojson.type === 'FeatureCollection') {
      (geojson.features || []).forEach(processFeature);
    } else if (geojson.type === 'Feature') {
      processFeature(geojson);
    } else if (geojson.type === 'Polygon') {
      polygons.push(turf.polygon(geojson.coordinates));
    } else if (geojson.type === 'MultiPolygon') {
      geojson.coordinates.forEach(coords => {
        polygons.push(turf.polygon(coords));
      });
    }

    return polygons;
  }

  // ------------------------------------------------------------------
  // 10. CALCUL DE L'INTERSECTION GÉOGRAPHIQUE AVEC TURF.JS
  // ------------------------------------------------------------------
  function calculateIntersection(isoA, isoB) {
    const polysA = extractPolygons(isoA);
    const polysB = extractPolygons(isoB);

    if (polysA.length === 0 || polysB.length === 0) {
      return null;
    }

    const intersections = [];

    // Calcul par paires de tous les polygones élémentaires
    for (const pA of polysA) {
      for (const pB of polysB) {
        try {
          // Signature Turf v6.5.0 : turf.intersect(poly1, poly2)
          const inter = turf.intersect(pA, pB);
          if (inter && inter.geometry && inter.geometry.coordinates && inter.geometry.coordinates.length > 0) {
            const area = turf.area(inter);
            if (area > 10) { // Élimination des résidus d'arrondi numérique (< 10 m²)
              intersections.push(inter);
            }
          }
        } catch (err) {
          console.warn('Erreur lors du calcul d’intersection d’une paire de polygones :', err);
        }
      }
    }

    if (intersections.length === 0) {
      return null;
    }

    if (intersections.length === 1) {
      return intersections[0];
    }

    // Fusion des géométries d'intersection multiples
    try {
      let combined = intersections[0];
      for (let i = 1; i < intersections.length; i++) {
        const u = turf.union(combined, intersections[i]);
        if (u) {
          combined = u;
        }
      }
      return combined;
    } catch (unionErr) {
      console.warn('Union des intersections impossible, retour sous forme de FeatureCollection :', unionErr);
      return turf.featureCollection(intersections);
    }
  }

  // ------------------------------------------------------------------
  // 11. CALCUL DES SUPERFICIES
  // ------------------------------------------------------------------
  function calculateAreaKm2(geojson) {
    if (!geojson) return 0;
    try {
      const areaM2 = turf.area(geojson);
      if (isNaN(areaM2) || !isFinite(areaM2) || areaM2 <= 0) {
        return 0;
      }
      // Conversion m² -> km² (1 km² = 1 000 000 m²)
      return areaM2 / 1000000;
    } catch (err) {
      console.warn('Erreur de calcul de superficie :', err);
      return 0;
    }
  }

  // ------------------------------------------------------------------
  // 12. AFFICHAGE CARTOGRAPHIQUE DES COUCHES
  // ------------------------------------------------------------------
  function displayLayersOnMap() {
    removeIsochroneMapLayers();

    // 1. Couche Isochrone A (Bleu semi-transparent, trait continu)
    if (state.geojsonData.A) {
      state.layers.A = L.geoJSON(state.geojsonData.A, {
        pane: 'pane-isochrone-a',
        style: {
          color: '#1d4ed8',
          weight: 2,
          opacity: 0.85,
          fillColor: '#1e88e5',
          fillOpacity: 0.35
        }
      }).bindTooltip('Isochrone A', { sticky: true });

      if (dom.toggleLayerA.checked) {
        state.layers.A.addTo(state.map);
      }
    }

    // 2. Couche Isochrone B (Orange semi-transparent, trait pointillé)
    if (state.geojsonData.B) {
      state.layers.B = L.geoJSON(state.geojsonData.B, {
        pane: 'pane-isochrone-b',
        style: {
          color: '#ea580c',
          weight: 2,
          dashArray: '5, 5',
          opacity: 0.9,
          fillColor: '#fb8c00',
          fillOpacity: 0.35
        }
      }).bindTooltip('Isochrone B', { sticky: true });

      if (dom.toggleLayerB.checked) {
        state.layers.B.addTo(state.map);
      }
    }

    // 3. Couche Intersection (Vert, contour renforcé)
    if (state.geojsonData.intersection) {
      state.layers.intersection = L.geoJSON(state.geojsonData.intersection, {
        pane: 'pane-intersection',
        style: {
          color: '#1b5e20',
          weight: 3.5,
          dashArray: '6, 4',
          opacity: 1,
          fillColor: '#2e7d32',
          fillOpacity: 0.6
        }
      }).bindTooltip('Zone commune (Intersection)', { sticky: true });

      if (dom.toggleLayerCommon.checked) {
        state.layers.intersection.addTo(state.map);
      }
    }

    // Ordre visuel : s'assurer que A est en arrière-plan et l'intersection au premier plan
    if (state.layers.A && state.map.hasLayer(state.layers.A)) {
      state.layers.A.bringToBack();
    }
    if (state.layers.intersection && state.map.hasLayer(state.layers.intersection)) {
      state.layers.intersection.bringToFront();
    }

    // Ajustement de la vue cartographique à l'ensemble des résultats
    fitMapToResults();
  }

  function fitMapToResults() {
    const boundsGroup = L.featureGroup();

    if (state.layers.A && state.map.hasLayer(state.layers.A)) {
      boundsGroup.addLayer(state.layers.A);
    }
    if (state.layers.B && state.map.hasLayer(state.layers.B)) {
      boundsGroup.addLayer(state.layers.B);
    }
    if (state.markers.A) {
      boundsGroup.addLayer(state.markers.A);
    }
    if (state.markers.B) {
      boundsGroup.addLayer(state.markers.B);
    }

    if (boundsGroup.getLayers().length > 0) {
      try {
        state.map.fitBounds(boundsGroup.getBounds(), {
          padding: [40, 40],
          maxZoom: 14,
          animate: true
        });
      } catch (e) {
        console.warn('Impossible d’ajuster les limites de la carte :', e);
      }
    }
  }

  // ------------------------------------------------------------------
  // 13. EXÉCUTION DU CALCUL PRINCIPAL
  // ------------------------------------------------------------------
  async function runCalculation() {
    if (state.isCalculating) return;

    if (!checkConfiguration()) {
      showStatus('La clé OpenRouteService n’est pas configurée. Renseignez-la dans le fichier config.js avant d’utiliser l’application.', 'warning');
      return;
    }

    // Validation des données des points
    const ptA = state.points.A;
    const ptB = state.points.B;

    if (ptA.lat === null || ptA.lon === null) {
      showStatus('Veuillez définir l’adresse ou la position du Point de départ A.', 'warning');
      dom.searchA.focus();
      return;
    }

    if (ptB.lat === null || ptB.lon === null) {
      showStatus('Veuillez définir l’adresse ou la position du Point de départ B.', 'warning');
      dom.searchB.focus();
      return;
    }

    if (isNaN(ptA.duration) || ptA.duration < 5 || ptA.duration > 120) {
      showStatus('La durée pour le Point A doit être comprise entre 5 et 120 minutes.', 'warning');
      return;
    }

    if (isNaN(ptB.duration) || ptB.duration < 5 || ptB.duration > 120) {
      showStatus('La durée pour le Point B doit être comprise entre 5 et 120 minutes.', 'warning');
      return;
    }

    // Annulation logique d'un éventuel calcul précédent
    if (state.abortControllers.calculate) {
      state.abortControllers.calculate.abort();
    }
    state.abortControllers.calculate = new AbortController();
    const signal = state.abortControllers.calculate.signal;

    // Mise en état de chargement
    state.isCalculating = true;
    dom.btnCalculate.disabled = true;
    showStatus('Calcul des zones accessibles en cours…', 'info', true);

    try {
      // Lancement des deux appels en parallèle avec Promise.all
      const [isoResultA, isoResultB] = await Promise.all([
        fetchIsochrone('A', signal),
        fetchIsochrone('B', signal)
      ]);

      state.geojsonData.A = isoResultA;
      state.geojsonData.B = isoResultB;

      // Calcul de la zone d'intersection géographique
      const intersectionGeoJson = calculateIntersection(isoResultA, isoResultB);
      state.geojsonData.intersection = intersectionGeoJson;

      // Calcul des superficies
      const areaA = calculateAreaKm2(isoResultA);
      const areaB = calculateAreaKm2(isoResultB);
      const areaInter = intersectionGeoJson ? calculateAreaKm2(intersectionGeoJson) : 0;

      state.areas.A = areaA;
      state.areas.B = areaB;
      state.areas.intersection = areaInter;

      // Affichage des couches sur la carte
      displayLayersOnMap();

      // Mise à jour de l'affichage des résultats
      displayResultsPanel(areaA, areaB, areaInter, intersectionGeoJson !== null);

      // Activation des boutons
      state.resultsCalculated = true;
      dom.btnRecenter.disabled = false;
      dom.btnExportA.disabled = false;
      dom.btnExportB.disabled = false;
      dom.btnExportCommon.disabled = !intersectionGeoJson;

      if (!intersectionGeoJson) {
        showStatus('Les deux zones de déplacement ne se recoupent pas avec les paramètres sélectionnés.', 'warning');
      } else {
        showStatus('Calcul terminé avec succès. Les deux isochrones et leur intersection sont affichés.', 'success');
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('Erreur lors du calcul :', err);
      showStatus(err.message || 'Une erreur imprévue est survenue lors du calcul.', 'error');
    } finally {
      state.isCalculating = false;
      dom.btnCalculate.disabled = false;
      hideSpinner();
    }
  }

  // ------------------------------------------------------------------
  // 14. MISE À JOUR DU PANNEAU DE RÉSULTATS
  // ------------------------------------------------------------------
  function displayResultsPanel(areaA, areaB, areaInter, hasIntersection) {
    const modeLabels = {
      'driving-car': '🚗 Voiture',
      'cycling-regular': '🚲 Vélo',
      'foot-walking': '🚶 Marche'
    };

    // Point A
    dom.resAddrA.textContent = state.points.A.label || `Lat: ${state.points.A.lat.toFixed(4)}, Lon: ${state.points.A.lon.toFixed(4)}`;
    dom.resModeA.textContent = modeLabels[state.points.A.mode] || state.points.A.mode;
    dom.resDurationA.textContent = `${state.points.A.duration} minutes`;
    dom.resAreaA.textContent = `${formatNumber(areaA)} km²`;

    // Point B
    dom.resAddrB.textContent = state.points.B.label || `Lat: ${state.points.B.lat.toFixed(4)}, Lon: ${state.points.B.lon.toFixed(4)}`;
    dom.resModeB.textContent = modeLabels[state.points.B.mode] || state.points.B.mode;
    dom.resDurationB.textContent = `${state.points.B.duration} minutes`;
    dom.resAreaB.textContent = `${formatNumber(areaB)} km²`;

    // Zone commune
    if (hasIntersection && areaInter > 0) {
      const shareA = areaA > 0 ? (areaInter / areaA) * 100 : 0;
      const shareB = areaB > 0 ? (areaInter / areaB) * 100 : 0;

      dom.resCommonStatus.textContent = 'Intersection identifiée';
      dom.resCommonStatus.style.color = 'var(--color-common-primary)';
      dom.resAreaCommon.textContent = `${formatNumber(areaInter)} km²`;
      dom.resShareA.textContent = `${formatNumber(shareA)} %`;
      dom.resShareB.textContent = `${formatNumber(shareB)} %`;
    } else {
      dom.resCommonStatus.textContent = 'Aucun recoupement';
      dom.resCommonStatus.style.color = 'var(--color-warning-text)';
      dom.resAreaCommon.textContent = '0,00 km²';
      dom.resShareA.textContent = '0,00 %';
      dom.resShareB.textContent = '0,00 %';
    }

    dom.resultsPanel.classList.remove('is-hidden');
  }

  // ------------------------------------------------------------------
  // 15. EXPORT DES DONNÉES EN GEOJSON (COMPATIBLE QGIS)
  // ------------------------------------------------------------------
  function exportGeoJSON(type) {
    let rawData = null;
    let fileName = '';

    const nowISO = new Date().toISOString();

    if (type === 'A') {
      rawData = state.geojsonData.A;
      fileName = 'isochrone-A.geojson';
    } else if (type === 'B') {
      rawData = state.geojsonData.B;
      fileName = 'isochrone-B.geojson';
    } else if (type === 'common') {
      rawData = state.geojsonData.intersection;
      fileName = 'intersection-isochrones.geojson';
    }

    if (!rawData) {
      showStatus(`Aucune donnée disponible pour l'export ${type}.`, 'warning');
      return;
    }

    // Enrichissement des propriétés avec métadonnées complètes
    const enrichedGeoJSON = prepareGeoJsonForExport(type, rawData, nowISO);

    // Téléchargement via Blob et URL temporaire côté navigateur
    const jsonString = JSON.stringify(enrichedGeoJSON, null, 2);
    const blob = new Blob([jsonString], { type: 'application/geo+json;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);

    showStatus(`Export réussi : ${fileName}`, 'success');
  }

  function prepareGeoJsonForExport(type, geojson, timestamp) {
    const isCommon = type === 'common';

    const baseProperties = {
      zone_type: isCommon ? 'intersection' : `isochrone_${type}`,
      calculated_at: timestamp,
      source: 'OpenRouteService',
      attribution: 'Contributeurs OpenStreetMap',
      label_point_A: state.points.A.label,
      lat_A: state.points.A.lat,
      lon_A: state.points.A.lon,
      mode_A: state.points.A.mode,
      duration_A_minutes: state.points.A.duration,
      area_A_km2: parseFloat(state.areas.A.toFixed(2)),
      label_point_B: state.points.B.label,
      lat_B: state.points.B.lat,
      lon_B: state.points.B.lon,
      mode_B: state.points.B.mode,
      duration_B_minutes: state.points.B.duration,
      area_B_km2: parseFloat(state.areas.B.toFixed(2))
    };

    if (isCommon) {
      baseProperties.area_intersection_km2 = parseFloat(state.areas.intersection.toFixed(2));
      baseProperties.share_of_A_percent = state.areas.A > 0 ? parseFloat(((state.areas.intersection / state.areas.A) * 100).toFixed(2)) : 0;
      baseProperties.share_of_B_percent = state.areas.B > 0 ? parseFloat(((state.areas.intersection / state.areas.B) * 100).toFixed(2)) : 0;
    }

    // Cloner la structure pour ne pas muter l'état
    const cloned = JSON.parse(JSON.stringify(geojson));

    if (cloned.type === 'FeatureCollection') {
      cloned.features = cloned.features.map(f => {
        f.properties = Object.assign({}, f.properties || {}, baseProperties);
        return f;
      });
      return cloned;
    } else if (cloned.type === 'Feature') {
      cloned.properties = Object.assign({}, cloned.properties || {}, baseProperties);
      return {
        type: 'FeatureCollection',
        features: [cloned]
      };
    } else if (cloned.type === 'Polygon' || cloned.type === 'MultiPolygon') {
      return {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: baseProperties,
          geometry: cloned
        }]
      };
    }

    return cloned;
  }

  // ------------------------------------------------------------------
  // 16. RÉINITIALISATION COMPLÈTE DE L'APPLICATION
  // ------------------------------------------------------------------
  function resetApplication() {
    // Annuler les requêtes en cours
    Object.values(state.abortControllers).forEach(ctrl => {
      if (ctrl) ctrl.abort();
    });

    // Supprimer les marqueurs de la carte
    if (state.markers.A) {
      state.map.removeLayer(state.markers.A);
      state.markers.A = null;
    }
    if (state.markers.B) {
      state.map.removeLayer(state.markers.B);
      state.markers.B = null;
    }

    // Supprimer les couches d'isochrones
    clearIsochroneLayers();

    // Réinitialiser les états de points
    state.points.A = { lat: null, lon: null, label: '', mode: 'driving-car', duration: 30 };
    state.points.B = { lat: null, lon: null, label: '', mode: 'driving-car', duration: 30 };
    state.resultsCalculated = false;
    state.isCalculating = false;

    // Réinitialiser les champs de recherche et coordonnées
    dom.searchA.value = '';
    dom.btnClearSearchA.classList.add('is-hidden');
    dom.labelA.textContent = 'Aucun point défini';
    dom.latA.textContent = '—';
    dom.lonA.textContent = '—';

    dom.searchB.value = '';
    dom.btnClearSearchB.classList.add('is-hidden');
    dom.labelB.textContent = 'Aucun point défini';
    dom.latB.textContent = '—';
    dom.lonB.textContent = '—';

    // Réinitialiser les modes de transport
    dom.modeA.value = 'driving-car';
    dom.modeB.value = 'driving-car';

    // Réinitialiser les durées
    dom.durationA.value = '30';
    dom.durationNumA.value = '30';
    dom.durationDisplayA.textContent = '30 min';

    dom.durationB.value = '30';
    dom.durationNumB.value = '30';
    dom.durationDisplayB.textContent = '30 min';

    // Réinitialiser les boutons
    dom.btnRecenter.disabled = true;
    dom.btnExportA.disabled = true;
    dom.btnExportB.disabled = true;
    dom.btnExportCommon.disabled = true;
    dom.btnCalculate.disabled = !state.isConfigured;

    // Masquer le panneau de résultats
    dom.resultsPanel.classList.add('is-hidden');

    // Recentrer la carte
    state.map.setView(state.defaultView.center, state.defaultView.zoom);

    deactivateMapSelection();
    showStatus('Application réinitialisée. Vous pouvez définir de nouveaux points.', 'info');
  }

  // ------------------------------------------------------------------
  // 17. GESTION DES MESSAGES D'ÉTAT ET TRADUCTION DES ERREURS
  // ------------------------------------------------------------------
  function showStatus(message, type = 'info', showSpinner = false) {
    if (!dom.statusCard) return;

    dom.statusCard.classList.remove('is-hidden', 'status-info', 'status-warning', 'status-error', 'status-success');
    dom.statusCard.classList.add(`status-${type}`);

    dom.statusText.textContent = message;

    if (showSpinner) {
      dom.statusSpinner.classList.remove('is-hidden');
    } else {
      dom.statusSpinner.classList.add('is-hidden');
    }
  }

  function hideSpinner() {
    if (dom.statusSpinner) {
      dom.statusSpinner.classList.add('is-hidden');
    }
  }

  function handleHttpError(statusCode, context) {
    let msg = '';
    switch (statusCode) {
      case 400:
        msg = `Requête invalide auprès d’OpenRouteService lors de : ${context}.`;
        break;
      case 401:
      case 403:
        msg = 'Clé API OpenRouteService invalide ou non autorisée. Vérifiez votre clé dans config.js.';
        break;
      case 404:
        msg = `Service introuvable (${context}).`;
        break;
      case 429:
        msg = 'Quota journalier dépassé ou fréquence de requêtes trop élevée sur votre clé OpenRouteService.';
        break;
      case 500:
      case 502:
      case 503:
        msg = 'Le service OpenRouteService est temporairement indisponible. Veuillez réessayer dans un instant.';
        break;
      default:
        msg = `Erreur HTTP ${statusCode} lors de l’opération : ${context}.`;
    }
    showStatus(msg, 'error');
  }

  function translateApiError(status, detail) {
    if (status === 401 || status === 403) {
      return 'Clé API OpenRouteService invalide, inactive ou non reconnue. Vérifiez config.js.';
    }
    if (status === 429) {
      return 'Quota OpenRouteService dépassé pour cette clé API.';
    }
    if (status === 400) {
      return `Paramètres non acceptés par OpenRouteService (${detail}).`;
    }
    if (status >= 500) {
      return 'Serveur OpenRouteService temporairement inaccessible.';
    }
    return detail || `Code HTTP ${status}`;
  }

  // ------------------------------------------------------------------
  // 18. UTILITAIRES DE SYNCHRONISATION ET FORMATAGE
  // ------------------------------------------------------------------
  function syncDurationInputs(pointType, value) {
    let val = parseInt(value, 10);
    if (isNaN(val)) val = 30;
    if (val < 5) val = 5;
    if (val > 120) val = 120;
    val = Math.round(val / 5) * 5; // Arrondi au pas de 5

    state.points[pointType].duration = val;

    if (pointType === 'A') {
      dom.durationA.value = val;
      dom.durationNumA.value = val;
      dom.durationDisplayA.textContent = `${val} min`;
    } else {
      dom.durationB.value = val;
      dom.durationNumB.value = val;
      dom.durationDisplayB.textContent = `${val} min`;
    }

    invalidateResults();
  }

  function formatNumber(num) {
    if (isNaN(num) || !isFinite(num) || num === null || num === undefined) {
      return '0,00';
    }
    return num.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ------------------------------------------------------------------
  // 19. CONFIGURATION DES ÉVÉNEMENTS GLOBAUX
  // ------------------------------------------------------------------
  function setupEventListeners() {
    // Mode de transport
    dom.modeA.addEventListener('change', function () {
      state.points.A.mode = dom.modeA.value;
      invalidateResults();
    });

    dom.modeB.addEventListener('change', function () {
      state.points.B.mode = dom.modeB.value;
      invalidateResults();
    });

    // Synchronisation durée curseur <-> champ numérique Point A
    dom.durationA.addEventListener('input', function () {
      syncDurationInputs('A', dom.durationA.value);
    });
    dom.durationNumA.addEventListener('change', function () {
      syncDurationInputs('A', dom.durationNumA.value);
    });

    // Synchronisation durée curseur <-> champ numérique Point B
    dom.durationB.addEventListener('input', function () {
      syncDurationInputs('B', dom.durationB.value);
    });
    dom.durationNumB.addEventListener('change', function () {
      syncDurationInputs('B', dom.durationNumB.value);
    });

    // Boutons de sélection sur la carte
    dom.btnSelectMapA.addEventListener('click', function () {
      toggleMapSelectionMode('A');
    });

    dom.btnSelectMapB.addEventListener('click', function () {
      toggleMapSelectionMode('B');
    });

    // Boutons d'action
    dom.btnCalculate.addEventListener('click', runCalculation);
    dom.btnRecenter.addEventListener('click', fitMapToResults);
    dom.btnExportA.addEventListener('click', () => exportGeoJSON('A'));
    dom.btnExportB.addEventListener('click', () => exportGeoJSON('B'));
    dom.btnExportCommon.addEventListener('click', () => exportGeoJSON('common'));
    dom.btnReset.addEventListener('click', resetApplication);

    // Bascules d'affichage des couches
    dom.toggleLayerA.addEventListener('change', function () {
      if (state.layers.A) {
        if (dom.toggleLayerA.checked) {
          state.layers.A.addTo(state.map);
          state.layers.A.bringToBack();
        } else {
          state.map.removeLayer(state.layers.A);
        }
      }
    });

    dom.toggleLayerB.addEventListener('change', function () {
      if (state.layers.B) {
        if (dom.toggleLayerB.checked) {
          state.layers.B.addTo(state.map);
          if (state.layers.intersection && state.map.hasLayer(state.layers.intersection)) {
            state.layers.intersection.bringToFront();
          }
        } else {
          state.map.removeLayer(state.layers.B);
        }
      }
    });

    dom.toggleLayerCommon.addEventListener('change', function () {
      if (state.layers.intersection) {
        if (dom.toggleLayerCommon.checked) {
          state.layers.intersection.addTo(state.map);
          state.layers.intersection.bringToFront();
        } else {
          state.map.removeLayer(state.layers.intersection);
        }
      }
    });

    // Configuration des autocomplétions d'adresses
    setupAddressSearch('A');
    setupAddressSearch('B');
  }

  // ------------------------------------------------------------------
  // 20. POINT D'ENTRÉE PRINCIPAL (INITIALISATION)
  // ------------------------------------------------------------------
  function init() {
    cacheDomElements();
    initMap();
    setupEventListeners();
    checkConfiguration();
  }

  // Lancement dès que le DOM est complètement chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
