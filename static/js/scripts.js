document.addEventListener("DOMContentLoaded", function () {
    console.log("scripts.js loaded");

    const map = window.leafletMap;  // Access the map created in leaflet_map.js

    if (!map) {
        console.error("Map is not initialized yet.");
        return;
    }

    let currentLayer = null;
    let liveDataInterval = null;
    let storeDataVal = 0;

    function applyStyling(feature, latlng) { // note: heading seems off by ~ 45 degrees
        var heading = feature.properties.heading || 0;
        var customIcon = L.divIcon({
            className: 'custom-plane-icon',
            html: `<div style="font-size: 16px; color: gold; text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black; transform: translate(-50%, -50%) rotate(${heading}deg);">
                        <i class="fa fa-plane"></i>
                  </div>`,
            iconSize: [30, 30],  // Size of the icon container
            iconAnchor: [15, 15] // Center alignment
        });
        return L.marker(latlng, {icon: customIcon});
    }

    async function fetchLiveData() {
        try {
            const bounds = map.getBounds();
            const bbox = `${bounds.getSouthWest().lat},${bounds.getNorthEast().lat},${bounds.getSouthWest().lng},${bounds.getNorthEast().lng}`;
            const response = await fetch(`/api-call/${bbox}/${storeDataVal}`);
            const data = await response.json();

            if (!response.ok) {
                console.error("Error fetching live data:", response.status, data);
                return;
            }

            console.log("Live data received:", data);

            if (currentLayer) {
                map.removeLayer(currentLayer);
            }

            currentLayer = L.geoJson(data, {
                pointToLayer: applyStyling
            }).addTo(map);
        } catch (error) {
            console.error("An error occurred while fetching live data:", error);
        }
    }

    document.getElementById("clearMapButton").addEventListener("click", function () {
        if (currentLayer) {
            map.removeLayer(currentLayer);
            currentLayer = null;
            console.log("Map layer removed");
        } else {
            console.log("No layer to remove");
        }
    });

    document.getElementById("liveDataStart").addEventListener("click", function () {
        if (!liveDataInterval) {
            liveDataInterval = setInterval(fetchLiveData, 5000);
            console.log("Live data fetching started");
        }
    });

    document.getElementById("liveDataStop").addEventListener("click", function () {
        if (liveDataInterval) {
            clearInterval(liveDataInterval);
            liveDataInterval = null;
            console.log("Live data fetching stopped");
        }
    });

    // Event listener for the checkbox
    document.getElementById("saveDataCb").addEventListener("change", function () {
        storeDataVal = this.checked ? 1 : 0;
        console.log("Save Data checkbox changed:", storeDataVal);
    });

    console.log("scripts.js execution completed");
});






