// Event listener that triggers when the DOM loads, adds all other functions and event listeners 
document.addEventListener("DOMContentLoaded", function () {
    console.log("scripts.js loaded");

    // Access the map created in leaflet_map.js
    const map = window.leafletMap;  

    if (!map) {
        console.error("Map is not initialized yet.");
        return;
    }

    // create objects required for other event listeners 
    let currentLayer = null;
    let liveDataInterval = null;
    let storeDataVal = 0;
    let latestData = null;

    let selectedFilters = null;

    // Function to apply filters to incomming data prior to map layer creation
    function applyFilters(data, selectedFilters) {
        // If no filters are selected, return the original data
        if (!selectedFilters || Object.keys(selectedFilters).length === 0) {
            return data;
        }
    
        // Filter the features in the data based on selectedFilters
        let filteredFeatures = data.features.filter(feature => {
            let properties = feature.properties;
    
            for (let key in selectedFilters) {
                let filterValue = selectedFilters[key];
    
                // Check if the filter is a dropdown (multiple selection)
                if (Array.isArray(filterValue)) {
                    if (!filterValue.includes(String(properties[key]))) {
                        return false; // Exclude feature if the value is not selected
                    }
                }
                // Check if the filter is numeric (slider range)
                else if (typeof filterValue === "object" && filterValue !== null) {
                    let minValue = filterValue.min;
                    let maxValue = filterValue.max;
                    let propertyValue = parseFloat(properties[key]);
    
                    // Ensure propertyValue is a valid number
                    if (isNaN(propertyValue) || propertyValue < minValue || propertyValue > maxValue) {
                        return false; // Exclude feature if the value is outside the range
                    }
                }
            }
    
            return true; // Include feature if all conditions are met
        });
    
        // Return the filtered data
        return { ...data, features: filteredFeatures };
    }
    
    // Function to apply desired styling to each point plotted on map
    function applyStyling(feature, latlng) { 
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

    // Function to call flask route to get data to plot 
    async function fetchLiveData() {
        try {
            // use current extent of map when requesting data, 
            // reduces number of API credits per call
            const bounds = map.getBounds();
            const bbox = `${bounds.getSouthWest().lat},${bounds.getNorthEast().lat},${bounds.getSouthWest().lng},${bounds.getNorthEast().lng}`;
            const response = await fetch(`/api-call/${bbox}/${storeDataVal}`);
            const data = await response.json();

            if (!response.ok) {
                console.error("Error fetching live data:", response.status, data);
                return;
            }

            console.log("Live data received:", data);
            latestData = data;
            console.log("Updated latest data:", latestData)

            // check if we got bad response from server
            if ("error" in data) {
                console.log("The server failed to retrieve data:", data.error)
                return
            }

            // overwrite data by applying filters
            let filteredData = applyFilters(data, selectedFilters);

            // remove current map layer if it exists
            if (currentLayer) {
                map.removeLayer(currentLayer);
            }

            // create new layer, applying our desired styling and addting on-click function for metadata display
            currentLayer = L.geoJson(filteredData, {
                pointToLayer: applyStyling, 
                onEachFeature: function (feature, layer) { 
                    let popupContent = "<b>Aircraft Info</b><br>";
                    for (let key in feature.properties) {
                        popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                    }
                    layer.bindPopup(popupContent);
                }
            }).addTo(map);

        } catch (error) {
            console.error("An error occurred while fetching live data:", error);
        }

        // check if interpDataInterval is set or null

        // if null skip

        // if set, interpolate positions for filteredData

        // apply styling and update currentLayer
    }

    // add event listener to test data button
    document.getElementById("testImageButton").addEventListener("click", async function () {
        // test function to load an image
        // sw/ne corners, lat, lon
        var imgBounds = [[14.571340, -152.109282], [56.761450, -52.946876]];

        L.imageOverlay("/images/20250323_010617_merc.jpg", imgBounds, {opacity: 0.65}).addTo(map);
    })

    // Event listener to clear map
    document.getElementById("clearMapButton").addEventListener("click", function () {
        if (currentLayer) {
            map.removeLayer(currentLayer);
            currentLayer = null;
            latestData = null;
            console.log("Map layer removed");
        } else {
            console.log("No layer to remove");
        }
    });

    // Event listener for start live data button  
    document.getElementById("liveDataStart").addEventListener("click", function () {
        if (!liveDataInterval) {
            liveDataInterval = setInterval(fetchLiveData, 5000);
            console.log("Live data fetching started");
        }
    });

    // Event listener for stop live data button 
    document.getElementById("liveDataStop").addEventListener("click", function () {
        if (liveDataInterval) {
            // clear interval for live data fetching, stopping map updates
            clearInterval(liveDataInterval);
            liveDataInterval = null;
            console.log("Live data fetching stopped");
        }
    });

    // function to load test data 
    document.getElementById("getDataButton").addEventListener("click", async function () {
        try {
            const response = await fetch("/get-data");
            const data = await response.json();
            if (!response.ok) {
                console.error("Error fetching data:", response.status, data);
                return;
            }
            console.log("Data received:", data);
            latestData = data;
            
            // 
            let filteredData = applyFilters(data, selectedFilters);

            if (currentLayer) {
                map.removeLayer(currentLayer);
            }
            currentLayer = L.geoJson(filteredData, {
                pointToLayer: applyStyling, 
                onEachFeature: function (feature, layer) { 
                    let popupContent = "<b>Aircraft Info</b><br>";
                    for (let key in feature.properties) {
                        popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                    }
                    layer.bindPopup(popupContent);
                }
            }).addTo(map);
            console.log("current layer:", currentLayer);

        } catch (error) {
            console.error("An error occurred:", error);
        }
    });

    // Event listener for the checkbox
    document.getElementById("saveDataCb").addEventListener("change", function () {
        storeDataVal = this.checked ? 1 : 0;
        console.log("Save Data checkbox changed:", storeDataVal);
    });

    // Event listener for the filter data button 
    document.getElementById("filterDataButton").addEventListener("click", function () {
        
        // Pause live data fetching while user selects desired filters
        if (liveDataInterval != null) {
            console.log("Pausing live data fetching");
            clearInterval(liveDataInterval);
            liveDataInterval = null;
        }

        // If there is no data to display, do not display menu and notify user
        if (latestData == null) {
            alert("No data loaded to filter");
            console.log("No data to filter", latestData);
            
        // display and populate the filters menu if there is data
        } else {
            document.getElementById("filterDialog").style.display = "block";
            populateFilterFields(latestData.features.map(feature => feature.properties));
            console.log("Populated filter menu");

            return
        }
    });

    // event listener for the x button on the filter data button
    document.getElementById("closeFilterDialog").addEventListener("click", function () {
        document.getElementById("filterDialog").style.display = "none";
    });

    // Make the dialog draggable
    let dialog = document.getElementById("filterDialog");
    let header = document.querySelector(".dialog-header");
    let offsetX, offsetY, isDragging = false;

    // add click and drag to header section of filters menu only
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

    // Function to get filters to use to populate filters menu. 
    function populateFilterFields(data) { 
    // check if data exists. If no data display some message. If data, continue 

        let filterContent = document.getElementById("filterContent");
        filterContent.innerHTML = ""; // Clear previous filters

        // Create buttons to apply or reset filters
        let applyButton = document.createElement("button");
        applyButton.textContent = "Apply Filters";
        applyButton.className = "filter-button";   
        
        let resetFiltersButton = document.createElement("button");
        resetFiltersButton.textContent = "Reset Filters";
        resetFiltersButton.className = "reset-filters";

    
        // list of fields we need to create filters for 
        const fields = ["callsign", "icao24", "on_ground", "origin_country", "velocity", "baro_altitude", "geo_altitude"];
    
        fields.forEach(field => {
            let label = document.createElement("label");
            label.textContent = field;
            label.className = "filter-label";
    
            // Check if the field is numeric, so we can use a slider
            if (["velocity", "baro_altitude", "geo_altitude"].includes(field)) {

                // get min and max values to use for slider ranges 
                let minVal = Math.round(Math.min(...data.map(item => item[field])));
                
                let maxVal = Math.round(Math.max(...data.map(item => item[field])));
    
                // Create the container for the slider and labels
                let sliderContainer = document.createElement("div");
                sliderContainer.className = "filter-slider-container";
    
                // Create the range input for numeric fields
                let slider = document.createElement("input");
                slider.type = "range";
                slider.className = "filter-slider";
                slider.setAttribute("data-key", field);
                slider.setAttribute("min", minVal);
                slider.setAttribute("max", maxVal);
                slider.setAttribute("step", "1"); // Allow slider to move in whole number steps
                slider.value = minVal; 
    
                // Add labels to show the min and max values
                let minLabel = document.createElement("span");
                minLabel.className = "slider-label";
                minLabel.textContent = minVal;
    
                let maxLabel = document.createElement("span");
                maxLabel.className = "slider-label";
                maxLabel.textContent = maxVal;
    
                let currentValue = document.createElement("span");
                currentValue.className = "current-value";
                currentValue.textContent = slider.value;
    
                // Update the current value as the slider is moved
                slider.addEventListener("input", () => {
                    currentValue.textContent = slider.value;
                });
    
                // Append the labels and slider to the container
                sliderContainer.appendChild(minLabel);  // Min label
                sliderContainer.appendChild(slider);  // Slider
                sliderContainer.appendChild(maxLabel);  // Max label
                sliderContainer.appendChild(currentValue);  // Current value label
    
                // Append the label and the slider container to the filterContent
                filterContent.appendChild(label);  // Add label
                filterContent.appendChild(sliderContainer);  // Add slider container
    
            } else {
                // If not a numeric field, use a select dropdown as before
                let select = document.createElement("select");
                select.className = "filter-select";
                select.setAttribute("data-key", field);
                select.setAttribute("multiple", "multiple");

                // Add an empty default option
                if (!data.some(item => item[field])) {
                    let defaultOption = document.createElement("option");
                    defaultOption.value = "";
                    defaultOption.textContent = `Select ${field}`;
                    select.appendChild(defaultOption);
                }
    
                // Get unique values to use for categorical filters (dropdowns)
                let uniqueValues = [...new Set(data.map(item => item[field]))].filter(value => value !== undefined);
    
                uniqueValues.forEach(value => {
                    let option = document.createElement("option");
                    option.value = value;
                    option.textContent = value;
                    select.appendChild(option);
                });

                filterContent.appendChild(label);
                filterContent.appendChild(select);
            }
            }); // closes loop for each field

        // Add the buttons we created to the filters menu
        filterContent.appendChild(applyButton);
        filterContent.appendChild(resetFiltersButton);
    
        // Make sure select2 applys correctly
        setTimeout(() => {
            $(".filter-select").each(function () {
                if ($(this).hasClass("select2-hidden-accessible")) {
                    $(this).select2("destroy"); // Destroy previous instance if it exists
                }
                $(this).select2({
                    placeholder: "Select an Option",
                    allowClear: true,
                    width: '100%',
                    multiple: true
                });
            });
        }, 100);
        
        // Event listener for button to apply filters
        document.querySelector(".filter-button").addEventListener("click", () => {
            selectedFilters = {};
        
            // Capture dropdown values
            document.querySelectorAll(".filter-select").forEach(select => {
                let key = select.getAttribute("data-key");
        
                let selectedValues = Array.from(select.selectedOptions)
                    .map(option => option.value)
                    .filter(value => value.trim() !== ""); // only use value if it is not empty (no selection)
        
                if (selectedValues.length > 0) {
                    selectedFilters[key] = selectedValues; // Store selected values
                }
            });
        
            // Capture slider values
            document.querySelectorAll(".filter-slider").forEach(slider => {
                let key = slider.getAttribute("data-key");
                let maxValue = parseFloat(slider.max);
                let selectedValue = parseFloat(slider.value);
        
                selectedFilters[key] = { min: selectedValue, max: maxValue };
            });
        
            console.log("Selected Filters:", selectedFilters);

            // Restart live data fetching
            if (!liveDataInterval) {
                liveDataInterval = setInterval(fetchLiveData, 5000);
                console.log("Resumed fetching live data");
            }
        });
        
        // Reset Filters Button
        document.querySelector(".reset-filters").addEventListener("click", function () {
            selectedFilters = null;
            console.log("Reset selected filters", selectedFilters)
        
            // Reset sliders to min values
            document.querySelectorAll(".filter-slider").forEach(slider => {
                slider.value = slider.min;
                // Update the slider's displayed current value
                let currentValueDisplay = slider.closest('.filter-slider-container').querySelector('.current-value');
                if (currentValueDisplay) {
                    currentValueDisplay.textContent = slider.min;
                }
            });
        
            // Reset dropdowns 
            document.querySelectorAll('.filter-select').forEach(select => {
                $(select).val([]).trigger('change'); // Reset Select2 dropdown
            });
                // Force Select2 to reset to placeholder
            setTimeout(() => {
                $(".filter-select").each(function () {
                    $(this).select2({
                        placeholder: "Select an Option", // Ensure placeholder is shown
                        allowClear: true,
                        width: '100%',
                        multiple: true
                    });
                });
            }, 100);
        });
    }
    
    
    console.log("scripts.js execution completed");
});






