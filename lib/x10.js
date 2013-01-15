/**
 * Reads energy data from a smart meter via a RAVEn dongle.
 * Publishes data to a MQTT service.
 */

// TODO get initial state of device from X10 interface

var sys = require('util'),
    mqtt = require('mqttjs'),
    crypto = require('crypto'),
    x10 = require("./cm11"),
    EventEmitter = require('events').EventEmitter;

var DEBUG = true;

/**
 * 
 * @param {Object} x10  X10 interface
 * @param {Object} options  config params.  address, path
 */
var X10Meem = function(x10, options) {
    EventEmitter.call(this);

    
    this.options = options;
    
    // selected house code
    this.address = options.address;  //{ house: x10.HOUSE.A, unit: x10.UNIT.UNIT_3 };
    
    this.topicIn = options.path + "/in";
    this.topicOut = options.path + "/out";
    this.mqttClient;
    this.pingTimer = null;
    this.connected = false;

    this.lifecycleState = "loaded";
    
    var meem = this;
    
    this.x10 = x10;
    this.x10.on("open", function() {
        openHandler(meem);
    });
}

sys.inherits(X10Meem, EventEmitter);

X10Meem.prototype.setPath = function(path) {
    if (this.connected) {
        var self = this;
        this.mqttClient.unsubscribe({topic: self.topicIn});
        this.mqttClient.unsubscribe({topic: self.topicOut});
        this.mqttClient.unsubscribe({topic: self.topicOut+"?"});
    }
    this.topicIn = path + "/in";
    this.topicOut = path + "/out";
    if (this.connected) {
        var self = this;
        this.mqttClient.subscribe({topic: self.topicIn});
        this.mqttClient.subscribe({topic: self.topicOut});
        this.mqttClient.subscribe({topic: self.topicOut+"?"});
    }
}

X10Meem.prototype.value = function(value) {
    console.log("X10Meem: changing value: " + value);
    var self = this;
    var fn = value ? x10.FUNCTION.ON : x10.FUNCTION.OFF;
    this.x10.sendCommand(this.address, fn, function(err) {
        if (err) {
            console.log("X10 meem err: " + err);
        }
        else {
            self.state = { timestamp: new Date(), value: value};
            self.mqttClient.publish({topic: self.topicOut, payload: JSON.stringify(self.state)});
            self.emit("value", self.state);
        }
    });
}

X10Meem.prototype.close = function () {
    this.mqttClient.close();
}


X10Meem.prototype.startPing = function() {
    if (this.pingTimer) {
        clearTimeout(this.pingTimer);
    }
    var self = this;
    this.pingTimer = setTimeout(function() {
        ping(self);
    }, 60000);        // make sure we ping the server 
}

X10Meem.prototype.stopPing = function() {
    if (this.pingTimer) {
        clearTimeout(this.pingTimer);
    }
}

function ping(meem) {
    if (meem.connected) {
        if (DEBUG) {
            console.log("pinging MQTT server");
        }
        meem.mqttClient.pingreq();
        meem.pingTimer = setTimeout(function() {
            ping(meem);
        }, 60000);
    }
}

// handle X10 interface open
function openHandler(meem) {
    console.log('X10 bus interface open: ' + meem.options);
    
    mqtt.createClient(meem.options.mqttPort, meem.options.mqttHost, function(err, mqttClient) {
        meem.mqttClient = mqttClient;

        // add handlers to MQTT client
        mqttClient.on('connack', function(packet) {
            if (packet.returnCode === 0) {
                console.log('MQTT sessionOpened');
                
                mqttClient.subscribe({topic: meem.topicIn});
                // subscribe to requests for state
                mqttClient.subscribe({topic: meem.topicOut+"?"});
                meem.connected = true;
                meem.startPing();
                meem.emit("lifecycle", "ready");
            }
        });
        mqttClient.on('close', function() {
            console.log('MQTT close');
                meem.connected = false;
        });
        mqttClient.on('error', function(e) {
            // ??? seems to timeout a lot
            console.log('MQTT error: ' + e);
        });
        mqttClient.on('publish', function(packet) {
            // got data from subscribed topic
            console.log('received ' + packet.topic + ' : ' + packet.payload);

            // check if message is a request for current value, send response
            var i = packet.topic.indexOf("?");
            if (i > 0) {
                var requestTopic = packet.topic.slice(0, i);
                var responseTopic = packet.payload;
                console.log("requestTopic: " + requestTopic + "  responseTopic: " + responseTopic);
                if (requestTopic == meem.topicOut) {
                    console.log("sending content: " + meem.state);
                    mqttClient.publish({topic: responseTopic, payload: JSON.stringify(meem.state)});
                }
            }
            else {
                if (packet.topic == meem.topicIn) {
                    var message = JSON.parse(packet.payload);
                    meem.value(message.value);
                }
            }
        });

        crypto.randomBytes(24, function(ex, buf) {      // create a random client ID for MQTT
            var clientId = buf.toString('hex');
            mqttClient.connect({
                keepalive: 60,
                client: clientId
            });
        });
    });
}



exports.X10Meem = X10Meem;
