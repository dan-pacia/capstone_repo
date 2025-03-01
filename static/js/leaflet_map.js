document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded, initializing map...");

    const map = L.map("map", {
        center: [38.9, -77.45], // Lat, Lon for around Dulles airport
        zoom: 10,
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

