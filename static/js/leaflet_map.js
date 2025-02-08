document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded, initializing map...");

    const map = L.map("map", {
        center: [38.8, -76.8], // DC
        zoom: 7,
        preferCanvas: true,  // Uses Canvas for rendering (performance boost)
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);

    setTimeout(() => {
        map.invalidateSize();  // Ensures tiles load properly
    }, 500);

    console.log("Map initialized successfully.");
    window.leafletMap = map;
});

