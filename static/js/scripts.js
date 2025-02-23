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
        heading = heading - 90; // custom style orients like unit circle, with 0 due east
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
                pointToLayer: applyStyling, 
                onEachFeature: function (feature, layer) { 
                    let popupContent = "<b>Aircraft Info</b><br>";
                    for (let key in feature.properties) {
                        popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                    }
                    layer.bindPopup(popupContent);
                }
            }).addTo(map);

            // populate the filter menu with features 
            if (data.features.length > 0) {
                populateFilterFields(data.features[0].properties);
            }
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

    // Event listener for the filter data button 
    document.getElementById("filterDataButton").addEventListener("click", function () {
        document.getElementById("filterDialog").style.display = "block";
    });

    // event listener for the x button on the filter data button
    document.getElementById("closeFilterDialog").addEventListener("click", function () {
        document.getElementById("filterDialog").style.display = "none";
    });

    // Make the dialog draggable
    let dialog = document.getElementById("filterDialog");
    let header = document.querySelector(".dialog-header");
    let offsetX, offsetY, isDragging = false;

    header.addEventListener("mousedown", function (e) {
        isDragging = true;
        offsetX = e.clientX - dialog.offsetLeft;
        offsetY = e.clientY - dialog.offsetTop;
    });

    document.addEventListener("mousemove", function (e) {
        if (isDragging) {
            dialog.style.left = `${e.clientX - offsetX}px`;
            dialog.style.top = `${e.clientY - offsetY}px`;
        }
    });

    document.addEventListener("mouseup", function () {
        isDragging = false;
    });

    // Populate the dialog with filter fields
    function populateFilterFields(properties) {
        let filterContent = document.getElementById("filterContent");
        filterContent.innerHTML = ""; // Clear previous filters

        Object.keys(properties).forEach(key => {
            let label = document.createElement("label");
            label.textContent = key;
            label.className = "filter-label";

            let select = document.createElement("select");
            select.className = "filter-select";
            select.setAttribute("data-key", key);

            // Make the dropdown searchable using Select2 library
            $(select).select2({ // issue here
                placeholder: `Select ${key}`,
                allowClear: true,
                width: '100%'
            });

            filterContent.appendChild(label);
            filterContent.appendChild(select);
        });
    }



    console.log("scripts.js execution completed");
});






