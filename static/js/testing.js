/* const fs = require('fs');

const rawData = fs.readFileSync('C:/Users/danpa/Projects/aa_capstone/py_project/opensky.json');
const data = JSON.parse(rawData);

var url = 'https://opensky-network.org/api/states/all?lamin=38.5&lomin=-77.6&lamax=39&lomax=-78' // use much smaller bbox

// have 400 token user limit :( 
//fetch(url).then(response => response.json()).then(data => console.log(data));

//console.log(states)

var statesLen = data.states.length

for (var i = 0; i < 10; i++) {
     var thisState = data.states[i]

    var lon = thisState[5]
    var lat = thisState[6]
    var heading = thisState[10]

    console.log(lon, lat, heading)
}  */

// put this into RsSource function. that function will need to be async
// note: might want to write time as well 


function getDataFromFS() {
    const fs = require('fs'); 
    const rawData = fs.readFileSync('C:/Users/danpa/Projects/aa_capstone/py_project/opensky.json');
    const data = JSON.parse(rawData);

    const geojson = {
        "type": "FeatureCollection", 
        "features": []
    };

    var statesLen = data.states.length

    for (var i = 0; i < statesLen; i++) { // going to hard code for now, can dynamically assign later :) (if needed)
        var thisState = data.states[i]
        var feature = {
            "type": "Feature", 
            "geometry": {
                "type": "Point", 
                "coordinates": [thisState[5], thisState[6]]
            }, 
            "properties": {
                "icao24": thisState[0], 
                "callsign": thisState[1],
                "origin_country": thisState[2], 
                "time_position": thisState[3], 
                "last_contact": thisState[4], 
                "baro_altitude": thisState[7], 
                "on_ground": thisState[8], 
                "velocity": thisState[9], 
                "heading": thisState[10],
                "vertical_rate": thisState[11], 
                "sensors": thisState[12], 
                "geo_altitude": thisState[13],
                "squawk": thisState[14],  
                "spi": thisState[15], 
                "position_source": thisState[16]
            }
        }
        geojson.features.push(feature)
    }
    return geojson
}

async function getOpenSkyApi() {
    const url = 'https://opensky-network.org/api/states/all?lamin=38.5&lomin=-77.6&lamax=39&lomax=-78';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Response status: $(response.status)");
        }
    const data = await response.json();
    } catch (error) {
        console.error(error.message)
    }
    const geojson = {
        "type": "FeatureCollection", 
        "features": []
    };
    var statesLen = data.states.length
    for (var i = 0; i < statesLen; i++) { // going to hard code for now, can dynamically assign later :) (if needed)
        var thisState = data.states[i]
        var feature = {
            "type": "Feature", 
            "geometry": {
                "type": "Point", 
                "coordinates": [thisState[5], thisState[6]]
            }, 
            "properties": {
                "icao24": thisState[0], 
                "callsign": thisState[1],
                "origin_country": thisState[2], 
                "time_position": thisState[3], 
                "last_contact": thisState[4], 
                "baro_altitude": thisState[7], 
                "on_ground": thisState[8], 
                "velocity": thisState[9], 
                "heading": thisState[10],
                "vertical_rate": thisState[11], 
                "sensors": thisState[12], 
                "geo_altitude": thisState[13],
                "squawk": thisState[14],  
                "spi": thisState[15], 
                "position_source": thisState[16]
            }
        }
        geojson.features.push(feature)
    }
    return geojson
}


myData = getOpenSkyApi()

console.log(myData)

  