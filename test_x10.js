var options = require("./settings");
var X10 = require("./lib/cm11");
var X10Meem = require("./x10").X10Meem;

// create X10 interface
var x10Interface = new X10.CM11(options);

var officeFanConfig = {
    path: "/house/office/fan",
    address: { house: X10.Address.HOUSE_A, unit: X10.Address.UNIT_5 },
    mqttPort: options.mqttPort,
    mqttHost: options.mqttHost
}

var officeFan = new X10Meem(x10Interface, officeFanConfig);

officeFan.on("lifecycle", function(state) {
	console.log("officeFan: lifecycle state: " + state);
    // officeFan.value(true);
    // officeFan.value(false);
    // officeFan.value(true);
    // officeFan.value(false);
});
officeFan.on("value", function(state) {
    console.log("officeFan: got X10 state:" + JSON.stringify(state));
});


var officeLampConfig = {
    path: "/house/office/lamp",
    address: { house: X10.Address.HOUSE_A, unit: X10.Address.UNIT_3 },
    mqttPort: options.mqttPort,
    mqttHost: options.mqttHost
}
var officeLamp = new X10Meem(x10Interface, officeLampConfig);
officeLamp.on("lifecycle", function(state) {
    console.log("officeLamp lifecycle state: " + state);
});
officeLamp.on("value", function(state) {
    console.log("officeLamp: got X10 state:" + JSON.stringify(state));
});


var diningLampConfig = {
    path: "/house/dining/lamp",
    address: { house: X10.Address.HOUSE_A, unit: X10.Address.UNIT_2 },
    mqttPort: options.mqttPort,
    mqttHost: options.mqttHost
}
var diningLamp = new X10Meem(x10Interface, diningLampConfig);
diningLamp.on("lifecycle", function(state) {
    console.log("diningLamp lifecycle state: " + state);
});
diningLamp.on("value", function(state) {
    console.log("diningLamp: got X10 state:" + JSON.stringify(state));
});

var loungeLampConfig = {
    path: "/house/lounge/lamp",
    address: { house: X10.Address.HOUSE_A, unit: X10.Address.UNIT_15 },
    mqttPort: options.mqttPort,
    mqttHost: options.mqttHost
}
var loungeLamp = new X10Meem(x10Interface, loungeLampConfig);
loungeLamp.on("lifecycle", function(state) {
    console.log("loungeLamp lifecycle state: " + state);
});
loungeLamp.on("value", function(state) {
    console.log("loungeLamp: got X10 state:" + JSON.stringify(state));
});

var bed1LampConfig = {
    path: "/house/bed1/lamp",
    address: { house: X10.Address.HOUSE_A, unit: X10.Address.UNIT_13 },
    mqttPort: options.mqttPort,
    mqttHost: options.mqttHost
}
var bed1Lamp = new X10Meem(x10Interface, bed1LampConfig);
loungeLamp.on("lifecycle", function(state) {
    console.log("bed1Lamp lifecycle state: " + state);
});
bed1Lamp.on("value", function(state) {
    console.log("bed1Lamp: got X10 state:" + JSON.stringify(state));
});

var bed1AcConfig = {
    path: "/house/bed1/ac",
    address: { house: X10.Address.HOUSE_A, unit: X10.Address.UNIT_12 },
    mqttPort: options.mqttPort,
    mqttHost: options.mqttHost
}
var bed1Ac = new X10Meem(x10Interface, bed1AcConfig);
bed1Ac.on("lifecycle", function(state) {
    console.log("bed1Ac lifecycle state: " + state);
});
bed1Lamp.on("value", function(state) {
    console.log("bed1Ac: got X10 state:" + JSON.stringify(state));
});
