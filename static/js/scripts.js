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

    let interpolatedLayer = null;

    let selectedFilters = null;

    let latestImgURL = null;
    let currentOverlay = null;
    let liveIMGInterval = 0;

    let selectedDate = null;  // To track selected date

    let historicDataInterval = null; 
    let historicDataRange = null; 
    let currentHistoricTime = null;
    let historicTimeout = null;

    let displayedDataType = null;

    function timeToSeconds(timeStr) {
        const [h, m, s] = timeStr.split(":").map(Number);
        return h * 3600 + m * 60 + s;
    }
    
    function secondsToTime(seconds) {
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    // function to interpolate ads-b data points
    function interpolateAndPlot(data, dt) {
        const R = 6371; // Earth radius in km
        let interpolatedFeatures = [];
    
        data.features.forEach(feature => {
            if (feature.properties.on_ground) {
                return; // Ignore ground objects
            }
    
            // skip if missing fields we need
            let { latitude, longitude, velocity, heading } = feature.properties;
            if (!latitude || !longitude || !velocity || !heading) return;
    
            // Convert speed from knots to km/s
            let speed_kms = (velocity * 1.852) / 3600; // 1 knot = 1.852 km/h
    
            // Convert heading to radians
            let theta = (heading * Math.PI) / 180;
    
            // Calculate distance traveled in km
            let d = speed_kms * dt;
    
            // Compute new lat and lon
            let delta_lat = (d / R) * Math.cos(theta);
            let delta_lon = (d / R) * Math.sin(theta) / Math.cos(latitude * Math.PI / 180);
    
            let new_lat = latitude + (delta_lat * 180) / Math.PI;
            let new_lon = longitude + (delta_lon * 180) / Math.PI;
    
            // Clone and update feature
            let newFeature = JSON.parse(JSON.stringify(feature));
            newFeature.geometry.coordinates = [new_lon, new_lat];
            interpolatedFeatures.push(newFeature);
        });

        console.log("Created interpolated features:", interpolatedFeatures)
    
        if (interpolatedFeatures.length > 0) {
            if (interpolatedLayer) {
                // if layer exists remove layer
                map.removeLayer(interpolatedLayer)
            }

            interpolatedLayer = L.geoJson({ type: "FeatureCollection", features: interpolatedFeatures }, {
                pointToLayer: applyInterpolatedStyling,
            }).addTo(map);

            // render actual points on top
            currentLayer.bringToFront();
        }
    }
    

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

    function applyInterpolatedStyling(feature, latlng) { 
        let heading = feature.properties.heading || 0;
        heading -= 90; // Rotate to align with the unit circle
    
        let interpolatedIcon = L.divIcon({
            className: 'interpolated-plane-icon', // blue points for interpolated positions 
            html: `<div style="font-size: 16px; color: blue; text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black; transform: translate(-50%, -50%) rotate(${heading}deg);">
                        <i class="fa fa-plane"></i>
                  </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    
        return L.marker(latlng, { icon: interpolatedIcon });
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

            // remove interpolated layer if it exists
            if (interpolatedLayer) {
                map.removeLayer(interpolatedLayer)
            }

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

            if (document.getElementById("interpDataCb").checked) { 
                setTimeout(() => interpolateAndPlot(filteredData, 5), 2500);
            }

        } catch (error) {
            console.error("An error occurred while fetching live data:", error);
        }

    }

    async function fetchImage() {

        var imgBounds = [[14.571340, -152.109282], [56.761450, -52.946876]];

        // logic to deterine which image to request from server
        let imgType;
        if (displayedDataType === "live") {
            imgType = "live";
        } else if  (displayedDataType === "historic") {
            if (!selectedDate || !currentHistoricTime) {
                console.warn("Historic date/time not yet selected.");
                return;
            }
            imgType = `${selectedDate}_${currentHistoricTime.replaceAll(":", "")}`;
        } else {
            console.warn("displayedDataType is not set."); 
            return;
        }

        var response = await fetch(`/get-image-filename/${imgType}`)
        if (!response.ok) {
            console.error("Failed to fetch image", response.status, response.statusText);
            // set interval to 15 seconds to try again until new image
            liveIMGInterval = setInterval(fetchImage, 15000)
            return;
        }
        let responseData = await response.text();
        console.log(responseData)
        if (responseData === "Image not available") {
            console.log(responseData);
            // set interval to 15 seconds to try again until new image
            liveIMGInterval = setInterval(fetchImage, 15000)
            return;
        }
        let imgName = responseData.trim();
        let imgURL = `/get-latest-image/${imgName}`;
        // check if we got a new image
        if (latestImgURL === imgURL) {
            console.log("Did not receive new image");
            return;
        }

        console.log("Image URL", imgURL);
        latestImgURL = imgURL;

        // check if an overlay exists, delete and replace if it does
        if (currentOverlay) {
            map.removeLayer(currentOverlay);
            currentOverlay = null;
        }
        currentOverlay = L.imageOverlay(imgURL, imgBounds, {opacity: 0.65}).addTo(map);
        // set interval back to 5 minutes
        liveIMGInterval = setInterval(fetchImage, 300000)

    }

    // Event listener for historicDataButton
    document.getElementById("historicDataButton").addEventListener("click", async function () {
        var response = await fetch("/populate-dates")
        if (!response.ok) {
            console.error("An error occured retrieving dates", response.status, response.statusText);
        }
        const data = await response.json();
        const dates = data.datesList;

        const datesContainer = document.getElementById("historicContent");
        datesContainer.innerHTML = ""; // Clear any previous content

        if (dates.length === 0) {
            datesContainer.innerHTML = "<p>No historic data available.</p>";
        } else {
            dates.forEach(date => {
                const dateDiv = document.createElement("div");
                dateDiv.textContent = date;
                dateDiv.className = "date-entry";
                datesContainer.appendChild(dateDiv);

                dateDiv.addEventListener("click", () => {
                    document.querySelectorAll(".date-entry").forEach(el => {
                        el.classList.remove("selected-date");
                    })

                    dateDiv.classList.add("selected-date");
                    selectedDate = date;
                })

                historicContent.appendChild(dateDiv);
            })

        }
        // show menu and populate with available dates
        document.getElementById("historicDialog").style.display = "block";
    })
    // event listener for button to load historic data  
    document.getElementById("loadHistoricDataBtn").addEventListener("click", async () => {
        if (!selectedDate) {
            alert("Please select a date.");
            return;
        }
    
        console.log(selectedDate);
        displayedDataType = "historic";
    
        try {
            const response = await fetch(`/get-date-range/${selectedDate}`);
            if (!response.ok) {
                console.error("Failed to get date range:", response.statusText);
                return;
            }
    
            const timeList = await response.json();
            if (!Array.isArray(timeList) || timeList.length === 0) {
                console.warn("No time data available for selected date.");
                return;
            }
    
            console.log("Time range:", timeList);
            historicDataRange = timeList;
    
            let index = 0;
    
            // Recursive fetch function using dynamic timeout
            const fetchNext = async () => {
                if (index >= historicDataRange.length) {
                    console.log("Finished playing historic data.");
                    return;
                }
    
                currentHistoricTime = historicDataRange[index];
    
                try {
                    const response = await fetch(`/get-historic-data-range/${selectedDate}/${currentHistoricTime}`);
                    if (!response.ok) throw new Error("Failed to fetch historic data");
    
                    const data = await response.json();
                    console.log(`Data at ${currentHistoricTime}:`, data);
                    latestData = data;
    
                    if (Array.isArray(data) && data.length > 0) {
                        const filteredData = applyFilters(data, selectedFilters);
    
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
                    }
    
                } catch (error) {
                    console.error("Error during fetchHistoricData:", error);
                    return;
                }
    
                index++;
    
                if (index < historicDataRange.length) {
                    const currentSeconds = timeToSeconds(historicDataRange[index - 1]);
                    const nextSeconds = timeToSeconds(historicDataRange[index]);
                    const deltaMillis = (nextSeconds - currentSeconds) * 1000;
    
                    historicTimeout = setTimeout(fetchNext, deltaMillis);
                }
            };
                if (historicTimeout) {
                    clearTimeout(historicTimeout);
                    historicTimeout = null;
                }
            // Start the loop
            fetchNext();

            // get first image and set interval for image fetching
            if (!liveIMGInterval) {
                fetchImage() // get first image then set the interval to update
                liveIMGInterval = setInterval(fetchImage, 300000)
                console.log("Live weather fetching started")
            }
    
            document.getElementById("historicDialog").style.display = "none";
    
        } catch (error) {
            console.error("Error fetching date range:", error);
        }
    });

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
        // remove overlay
        if (currentOverlay) {
            map.removeLayer(currentOverlay);
            currentOverlay = null;
            console.log("removed overlay layer")
        }
        else {
            console.log("No overlay layer to remove")
        }
    });

    // Event listener for start live data button  
    document.getElementById("liveDataStart").addEventListener("click", function () {
        if (!liveDataInterval) {
            displayedDataType = "live";
            liveDataInterval = setInterval(fetchLiveData, 5000);
            console.log("Live data fetching started");
        }
        // get first image and set interval for image fetching
        if (!liveIMGInterval) {
            fetchImage() // get first image then set the interval to update
            liveIMGInterval = setInterval(fetchImage, 300000)
            console.log("Live weather fetching started")
        }
    });

    // Event listener for stop live data button 
    document.getElementById("liveDataStop").addEventListener("click", function () {
        if (liveDataInterval) {
            clearInterval(liveDataInterval);
            liveDataInterval = null;
            console.log("Live data fetching stopped");
        }
        if (liveIMGInterval) {
            clearInterval(liveIMGInterval);
            liveIMGInterval = null;
            console.log("Live image fetching stopped");
        }
        if (historicTimeout) {
            clearTimeout(historicTimeout);
            historicTimeout = null;
            console.log("Historic data playback stopped");
        }

    });

    // function to load test data 
    // document.getElementById("getDataButton").addEventListener("click", async function () {
    //     try {
    //         const response = await fetch("/get-data");
    //         const data = await response.json();
    //         if (!response.ok) {
    //             console.error("Error fetching data:", response.status, data);
    //             return;
    //         }
    //         console.log("Data received:", data);
    //         latestData = data;
            
    //         // 
    //         let filteredData = applyFilters(data, selectedFilters);

    //         if (currentLayer) {
    //             map.removeLayer(currentLayer);
    //         }
    //         currentLayer = L.geoJson(filteredData, {
    //             pointToLayer: applyStyling, 
    //             onEachFeature: function (feature, layer) { 
    //                 let popupContent = "<b>Aircraft Info</b><br>";
    //                 for (let key in feature.properties) {
    //                     popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
    //                 }
    //                 layer.bindPopup(popupContent);
    //             }
    //         }).addTo(map);
    //         console.log("current layer:", currentLayer);

    //     } catch (error) {
    //         console.error("An error occurred:", error);
    //     }
    // });

    // Event listener for the checkbox
    document.getElementById("saveDataCb").addEventListener("change", function () {
        storeDataVal = this.checked ? 1 : 0;
        console.log("Save Data checkbox changed:", storeDataVal);
    });

    // Event listener for the filter data button 
    document.getElementById("filterDataButton").addEventListener("click", function () {
        
        // check which data type is running, store in variable
        if (liveDataInterval !== null) {
            activeInterval = "live";
        } else if (historicDataInterval !== null) {
            activeInterval = "historic";
        } else {
            activeInterval = "none";  // or null, depending on how you want to handle it
        }
        // pause correct type

        // Pause live data fetching while user selects desired filters
        if (activeInterval === "live") {
            console.log("Pausing live data fetching");
            clearInterval(liveDataInterval);
            liveDataInterval = null;
        } else {
            if (activeInterval === "historic") {
                console.log("Pausing historic data fetching");
                clearInterval(historicDataInterval);
                historicDataInterval = null;
        }
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

    // add user interaction for the historic data dialog
    let historicDialog = document.getElementById("historicDialog");
    let historicHeader = document.querySelector(".historic-header");
    
    // event listener for the x button on the historic data button
    document.getElementById("closeHistoricDialog").addEventListener("click", function () {
        document.getElementById("historicDialog").style.display = "none";
    });

    historicHeader.addEventListener("mousedown", function (e) {
        isDragging = true;
        offsetX = e.clientX - historicDialog.offsetLeft;
        offsetY = e.clientY - historicDialog.offsetTop;
    });

    document.addEventListener("mousemove", function (e) {
        if (isDragging) {
            historicDialog.style.left = `${e.clientX - offsetX}px`;
            historicDialog.style.top = `${e.clientY - offsetY}px`;
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






