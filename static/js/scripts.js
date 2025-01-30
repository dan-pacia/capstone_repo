// Function to call Flask endpoint
async function callPyFunc() {
    try {
        const response = await fetch("/say-hello");
        const data = await response.json();
        console.log(data.message);
        alert(data.message);  // Display the response from Flask in an alert
    } catch (error) {
        console.error("Error calling Python function:", error);
    }
}

async function plotOnMap(){ // call this on a button click. test-plot is route calling function to update folium map
    try {
        const response = await fetch("/test-plot"); //fetch flask route test-plot
        const data = await response.json();
        if (data.iframe){
            const mapContainer = document.querySelector(".map-container");
            mapContainer.innerHTML = data.iframe;
        } else {
            console.error("No iframe received from server");
        }
   
    } catch (error) {
        console.error("Error calling Python function:", error);
    }
}
