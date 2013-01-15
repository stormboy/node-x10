var options = require("./settings");
var x10 = require("./lib/cm11");

var cm11 = new x10.CM11(options);
cm11.on("open", function() {
	console.log("CM11 is open. get status");
	cm11.getStatus();
	
        unitOn();
        unitOff();
        unitOn();
        unitOff();
        unitOn();
        unitOff();
        unitOn();
        unitOff();
        
	// setTimeout(function() {
	    // unitOn();
	// }, 1000);
});

var house = x10.HOUSE.A;
var unit = x10.UNIT.UNIT_5;

function unitOn() {
    console.log("sending on");
    cm11.sendCommand({house: house, unit: unit}, x10.FUNCTION.ON, function(err) {
        console.log("returned from sending command: on");
        // setTimeout(function() {
            // unitOff();
        // }, 1000);
    });
}
function unitOff() {
    console.log("sending off");
    cm11.sendCommand({house: house, unit: unit}, x10.FUNCTION.OFF, function(err) {
        console.log("returned from sending command: off");
        // setTimeout(function() {
            // unitOn();
        // }, 1000);
    });
}
