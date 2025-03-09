// import required APIs
const { TextEncoder, TextDecoder } = require("util"); 
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const fs = require("fs");
const path = require("path");

const { JSDOM } = require("jsdom");
const jquery = require("jquery");
const L = require('leaflet'); 


// Simulate a document environment for Jest
let dom;
let document;

beforeEach(async () => {

    // create objects to view console output from test dom
    jest.spyOn(console, "error");
    jest.spyOn(console, "log");

    // create jsdom object using html file. 
    // Note the different imports compared to production file, these are required due to the way jsdom handles imports
    let dom = new JSDOM(`
<!DOCTYPE html>
<html>
    <head>
        <title>ADS-B WeatherMap</title>
        <link rel="stylesheet" href="../static/css/styles.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

        <!-- Load Leaflet first -->
        <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.js"></script>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.css" />

        <script type="text/javascript" src="../static/js/leaflet_map.js"></script>
        <script type="text/javascript" src="../static/js/scripts.js"></script>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.4/jquery.min.js"></script>
        <!-- Load Select2 CSS -->
        <link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css" rel="stylesheet" />
        <!-- Load Select2 JS -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js"></script>


    </head>
    <body>
        <h2>ADS-B WeatherMap</h2>

        <div class="map-container">
            <!-- Add a div for Leaflet map -->
            <div id="map" style="width: 100%; height: 100%;"></div>
        </div>

        <div class="button-container">
            <button id="getDataButton" class="simple-button">Get Data</button>
            <button id="clearMapButton" class="simple-button">Clear Map</button>
            <button id="liveDataStart" class="simple-button">Start Live Data</button>
            <button id="liveDataStop" class="simple-button">Stop Live Data</button>
            <input type="checkbox" id="saveDataCb">
            <label for="saveDataCb">Save Data</label>
            <button id="filterDataButton" class="simple-button">Filter Data</button>

        </div>
        <div id="filterDialog" class="filter-dialog">
            <div class="dialog-header">
                <span>Filter Data</span>
                <button id="closeFilterDialog" class="close-button">&times;</button>
            </div>
            <div id="filterContent" class="filter-content">
                <!-- Dynamic filter fields will be added here -->
            </div>
        </div>
    </body>
</html>
        `, {
            resources: "usable", 
            runScripts: "dangerously"
    });



    // Event listener for dom content loaded. 
    // Is bare bones version of scripts.js, including only functions required to run tests
    // and modification to scope of several variables. 
    dom.window.addEventListener("DOMContentLoaded", () => {
        console.log("scripts.js loaded");

        let currentLayer = null;
        window.liveDataInterval = null;
        let storeDataVal = 0;

        window.latestData = null;
    
        let selectedFilters = null;
    
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
            
            // Pause live data fetching while user selects desired filters
            if (liveDataInterval != null) {
                console.log("Pausing live data fetching");
                clearInterval(liveDataInterval);
                liveDataInterval = null;
            }
    
            // call function to populate filters 
            if (latestData == null) {
                //alert("No data loaded to filter");
                console.log("No data to filter", latestData);
                
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
    
        function populateFilterFields(data) { // need to call this once, not each time we get data
        // check if data exists. If no data display some message. If data, continue 
    
            let filterContent = document.getElementById("filterContent");
            filterContent.innerHTML = ""; // Clear previous filters
    
            let applyButton = document.createElement("button");
            applyButton.textContent = "Apply Filters";
            applyButton.className = "filter-button";   
            
            let resetFiltersButton = document.createElement("button");
            resetFiltersButton.textContent = "Reset Filters";
            resetFiltersButton.className = "reset-filters";
    
            const fields = ["callsign", "icao24", "on_ground", "origin_country", "velocity", "baro_altitude", "geo_altitude"];
        
            fields.forEach(field => {
                let label = document.createElement("label");
                label.textContent = field;
                label.className = "filter-label";
        
                // Check if the field is numeric, so we can use a slider
                if (["velocity", "baro_altitude", "geo_altitude"].includes(field)) {
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
    
            filterContent.appendChild(applyButton);
            filterContent.appendChild(resetFiltersButton);
            
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
                    window.liveDataInterval = 5000
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
            
            });
        }
        console.log("scripts.js execution completed");
    })

    document = dom.window.document;
    global.document = document;
    global.window = dom.window;

    global.$ = require("jquery")(dom.window);
    global.jQuery = global.$;

    const event = new dom.window.Event("DOMContentLoaded");
    dom.window.document.dispatchEvent(event);

    await new Promise(resolve => setTimeout(resolve, 400));

});


// Test suite for filter menu behavior
describe("Filter Menu Behavior", () => {

    // UT-1 filter menu should display if live data exists 
    test("UT-1: Filter menu displays if live data exists", () => {

        // get button to launch filter data menu
        const button = document.getElementById("filterDataButton")

        // load some test data and assign to correct object
        const geojsonPath = path.resolve(__dirname, "../dataframe.geojson");
        const geojsonData = fs.readFileSync(geojsonPath, "utf8");
        const parsedData = JSON.parse(geojsonData);
        global.latestData = parsedData; // Set latestData globally
    
        window.latestData = global.latestData;

        // simulate button chick
        button.click()

        // get menu that should have been generated
        const menu = document.getElementById("filterDialog")

        // validate that menu is displayed
        expect(menu.style.display).toBe("block");
    })

    // UT-2 filter menu should not display if no data
    test("UT-2: Filter menu does not display if no data", () => {

            // create object to view console output
            const consoleSpy = jest.spyOn(console, 'log');
            const button = document.getElementById("filterDataButton")
    
            // simulate button click
            button.click()
    
            // verify that correct message was logged
            expect(consoleSpy).toHaveBeenCalledWith("No data to filter", null);
            consoleSpy.mockRestore(); // Restore original console.log
    
            // get object for menu
            const menu = document.getElementById("filterDialog");
    
            // Verify menu is not displayed
            expect(menu.style.display).toBe("");
    })

    // UT-3 opening filters menu pauses data fetching
    test("UT-3: Opening filters menu pauses data fetching", () => {

        // manually set live data interval
        window.liveDataInterval = 5000;

        // get button to launch data filtering meue
        const button = document.getElementById("filterDataButton");

        // simulate button click
        button.click()

        // Validate that the data fetching interval is null
        expect(window.liveDataInterval).toBe(null);

    })

    // UT-4 applying filters restarts data fetching
    test("UT-4: Applying filters resumes data fetching", async () => {

        // create object to view console output 
        const consoleSpy = jest.spyOn(console, 'log');

        // get button to launch filters menu
        const button = document.getElementById("filterDataButton")

        // load some test data from file
        const geojsonPath = path.resolve(__dirname, "../dataframe.geojson");
        const geojsonData = fs.readFileSync(geojsonPath, "utf8");
        const parsedData = JSON.parse(geojsonData);
        global.latestData = parsedData; // Set latestData globally
    
        window.latestData = global.latestData;

        // simulate button click
        button.click()

        // wait for menu to load before proceeding
        await new Promise(resolve => setTimeout(resolve, 200));

        // Validate that correct message was logged
        expect(consoleSpy).toHaveBeenCalledWith("Populated filter menu");

        consoleSpy.mockRestore();

        // get apply filters button
        const applyButton = document.querySelector(".filter-button")

        // select apply filters button
        applyButton.click()

        // validate that data fetching interval was reset
        expect(window.liveDataInterval).toBe(5000)

    })

    // UT-5 test that filters are applied correctly
    test("UT-5: Verify filters are applyied correctly", () => {

        // load test data from file
        const geojsonPath = path.resolve(__dirname, "../dataframe.geojson");
        const geojsonData = fs.readFileSync(geojsonPath, "utf8");
        const parsedData = JSON.parse(geojsonData);

        // create example filters to apply to the data
        const testFilters = {
            "on_ground": [
              "true"
            ],
            "velocity": {
              "min": 0,
              "max": 267
            },
            "baro_altitude": {
              "min": 0,
              "max": 13106
            },
            "geo_altitude": {
              "min": 0,
              "max": 13198
            }
          }

          // function used to filter data
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

        // call filters function and validate output is correct
        const filteredData = applyFilters(parsedData, testFilters);

        filteredData.features.forEach(feature => {
            expect(feature.properties.on_ground).toBe("true");
            expect(feature.properties.velocity).toBeGreaterThanOrEqual(0);
            expect(feature.properties.velocity).toBeLessThanOrEqual(267);
            expect(feature.properties.baro_altitude).toBeGreaterThanOrEqual(0);
            expect(feature.properties.baro_altitude).toBeLessThanOrEqual(13106);
            expect(feature.properties.geo_altitude).toBeGreaterThanOrEqual(0);
            expect(feature.properties.geo_altitude).toBeLessThanOrEqual(13198);
        });
    })

    // UT-6 test on each function
    test("UT-6: Test onEach function to add tooltip", () => {

        // load test data
        const geojsonPath = path.resolve(__dirname, "../dataframe.geojson");
        const geojsonData = fs.readFileSync(geojsonPath, "utf8");
        const parsedData = JSON.parse(geojsonData);

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

        currentLayer = L.geoJson(parsedData, {
            pointToLayer: applyStyling, 
            onEachFeature: function (feature, layer) { 
                let popupContent = "<b>Aircraft Info</b><br>";
                for (let key in feature.properties) {
                    popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                }
                layer.bindPopup(popupContent);
            }
        })


        // Spy function to check onEachFeature call
        const features = parsedData.features;
        const spyOnEachFeature = jest.fn();

        // Re-initialize the layer with spy on the onEachFeature method
        currentLayer = L.geoJson(parsedData, {
            pointToLayer: applyStyling, 
            onEachFeature: spyOnEachFeature
        });

        // Assert that onEachFeature was called for each feature
        expect(spyOnEachFeature).toHaveBeenCalledTimes(features.length);
        features.forEach((feature) => {
            // Verify that onEachFeature was called with the correct arguments (feature, layer)
            expect(spyOnEachFeature).toHaveBeenCalledWith(feature, expect.any(L.Layer));
        });

    })

    afterEach(() => {
        // teardown variables after each test
        global.latestData = null;
        global.liveDataInterval = null;
    });

}); // close before each