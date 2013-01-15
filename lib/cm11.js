/**
 * serial port
 * circular buffer with event emitter
 */

var sys = require('util'),
    serialport = require("serialport"),
    RingBuffer = require("./ringBuffer").AsyncRingBuffer,
    EventEmitter = require('events').EventEmitter;

var DEBUG = false;
var INFO = true;

var HOUSE = {
        A: 0x6,
        B: 0xE,
        C: 0x2,
        D: 0xA,
        E: 0x1,
        F: 0x9,
        G: 0x5,
        H: 0xD,
        I: 0x7,
        J: 0xF,
        K: 0x3,
        L: 0xB,
        M: 0x0,
        N: 0x8,
        O: 0x4,
        P: 0xC
}
var UNIT = {
        UNIT_1: 0x6,
        UNIT_2: 0xE,
        UNIT_3: 0x2,
        UNIT_4: 0xA,
        UNIT_5: 0x1,
        UNIT_6: 0x9,
        UNIT_7: 0x5,
        UNIT_8: 0xD,
        UNIT_9: 0x7,
        UNIT_10: 0xF,
        UNIT_11: 0x3,
        UNIT_12: 0xB,
        UNIT_13: 0x0,
        UNIT_14: 0x8,
        UNIT_15: 0x4,
        UNIT_16: 0xC
}
var FUNCTION = {
     ALL_UNITS_OFF : 0,
     ALL_LIGHTS_ON : 1,
     ON : 2,
     OFF : 3,
     DIM : 4,
     BRIGHT : 5,
     ALL_LIGHTS_OFF : 6,
     EXTENDED_CODE : 7,
     HAIL_REQ : 8,
     HAIL_ACK : 9,
     PRESET_DIML : 10,
     PRESET_DIMH : 11,
     EXTENDED_DATA : 12,
     STATUS_ON : 13,
     STATUS_OFF : 14,
     STATUS_REQ : 15
}

// state of serial connection with CM11 device
var State = { 
    READY: 0,       // ready to receive. might get 0x5a (poll), 0xa5 (interface power fail, time request)
    EXPECT_CHKSUM: 1,      // expecting a checksum
    EXPECT_READY: 2,      // expecting a ready message: 0x55
    EXPECT_STATUS: 3,      // expecting a status message
};

function calcChecksum(buf) {
    var sum = 0;
    for (var i=0; i<buf.length; i++) {
        sum += buf[i];
    }
    return sum & 0xff;
}

var CM11 = function(options) {
    EventEmitter.call(this);

	this.buffer = new RingBuffer(12);   // a data buffer for incoming serial data from the CM11 interface

    // doe outgoing commands
    this.houseCode = 0x6;               // address house code
    this.state = State.READY;           // serial interface state
    this.messageData = new Buffer(2);   // data for messages to send to the CM11 interface
    this.checksum = 0;      // calculated checksum on data to write
    
    this.statusBuffer = new Buffer(14);   // for network status
    this.statusOffset = 0;
    
    this.messageCallback = null;

    // queue for incoming commands to send on the CM11 interface     
    this.commandQueue = [];
	
	// configure the serial port that the RAVEn USB dongle is on.
    this.serialPort = new serialport.SerialPort(options.serialPath, {
        baudrate: 4800,
        databits: 8,
        stopbits: 1,
        parity: 'none',
    });
    
    this.serialPort.on("open", function () {
        if (DEBUG) {
            console.log('serial device open');
        }
        setTimeout(function() {
            self.emit("open");
        }, 2000);
    });
    
    self = this;
    this.serialPort.on("data", this.dataHandler);
    this.buffer.on("data", function(data) {
        self.incomingHandler(self, data);
    });
    
    this.buffer.on("checksum", this.checksumHandler);
    this.buffer.on("ready", this.readyHandler);
    this.buffer.on("status", this.statusHandler);
    this.buffer.on("error", function(err) {
        console.log("got error from buffer: " + err);
    })
}

sys.inherits(CM11, EventEmitter);

/**
 * handler for incoming serial data from CM11
 * 
 * @param {Object} data Buffer of octects
 */
CM11.prototype.dataHandler = function(data) {
    if (DEBUG) {
        var str = "";
        for (var i=0; i<data.length; i++) {
            var octet = data.readUInt8(i);
            str += octet.toString(16);
            str +=","
        }
        console.log("got data from serial port: " + str);
    }

    // write data into circular buffer
    for (var i=0; i<data.length; i++) {
        var octet = data.readUInt8(i);
        self.buffer.write(octet);
    }
}


// handler for incoming data initiated by interface
CM11.prototype.incomingHandler = function(self, data) {
    if (self.state == State.EXPECT_CHKSUM) {
        self.buffer.read(function(data) {
            self.buffer.emit("checksum", data);
        });
    }
    else if (self.state == State.EXPECT_READY) {
        self.buffer.read(function(data) {
            if (data == 0x55) {    // ??? not expecting this
                if (DEBUG || INFO) {
                        console.log("CM11 interface ready to receive commands");
                }
                self.buffer.emit("ready");
            }
            else {
                self.buffer.emit("error", "expecting READY, but got " + data.toString(16));
            }
        });
    }
    else if (self.state == State.READY) {
        if (DEBUG) {
            console.log("got data event from circular buffer: " + data.toString(16));
        }

        // read the data
        self.buffer.read(function(data) {
            if (DEBUG) {
                console.log("got data from circular buffer: " + data.toString(16))
            }
           if (data == 0x5a) {      // interface is polling this machine, send response
                var cmd = new Buffer([0xc3]);
                if (DEBUG) {
                    console.log("writing poll response: " + cmd);
                }
                self.serialPort.write(cmd);
            }
            else if (data == 0xa5) {     // power failure time request
                if (DEBUG) {
                    console.log("Received power failure time request, setting interface clock");
                }
                //var cmd = new Buffer([0xfb]);
                //serialPort.write(cmd);
                
                // set interface clock
                // TODO set proper time
                cmd = new Buffer([
                    0x9b,
                    0x00,       // seconds
                    0x00,       // minutes
                    0x02,       // hours
                    0x30,       // year day (bits 0..7)
                    0x11,       // bit 8 of year day, and Day mask (SMTWTFS)
                    self.houseCode << 4 | 0x07
                ]);
                self.serialPort.write(cmd);
            }
            else {
                if (DEBUG) {
                    console.log("unknown data received in ready state: " + data);
                }
            }
        });
    }
    else if (self.state == State.EXPECT_STATUS) {
        self.buffer.read(function(data) {
            self.statusBuffer.writeUInt8(data, self.statusOffset++);
            if (self.statusOffset >= 14) {
                if (DEBUG) {
                    var str = "";
                    for (var i=0; i<14; i++) {
                        str += self.statusBuffer[i].toString(16) + ", ";
                    }
                    console.log("got all status: " + str);
                }
                // TODO handle complete status data
                self.buffer.emit("status", self.statusBuffer);
                self.state = State.READY;
                if ( typeof(self.messageCallback) == 'function') {
                    self.messageCallback(null);
                }
            }
        });
    }

}

CM11.prototype.checksumHandler = function(checksum) {
	// check checksum from interface matches calculated checksum
	if (DEBUG) {
	    console.log("got checksum: " + checksum.toString(16) + " . calculated: " + self.checksum.toString(16));
	}
    if (checksum == self.checksum) {
		// send ok
		self.serialPort.write(new Buffer([0x00]));
        self.state = State.EXPECT_READY;
	}
	else {
	    // retry sending message
	    if (DEBUG) {
    	    console.log("checksums do not match: " + self.checksum.toString(16) + " != " + checksum.toString(16) + ". retry sending message");
    	}
		self.serialPort.write(self.messageData);
		
		// TODO have a maximum retry amount
	}
}

// listen for code
CM11.prototype.readyHandler = function(code) {
	// TODO check that code is the ready code
    if (typeof self.messageCallback==='function') {
        self.messageCallback(null);
    }
}



// handle info reponse from interface
CM11.prototype.statusHandler = function(data) {
    console.log("got status: " + data);
    // if (typeof (self.messageCallback) === "function") {
        // self.messageCallback(data);
    // }
    // TODO emit an object rather than the status buffer
    self.emit("status", data);
}

CM11.prototype.sendAddress = function(address, callback) {
    self.messageCallback = callback;
    self.houseCode = address.house;
    var header = 0x04;  // address message
    var code = address.house << 4 | address.unit;

    if (DEBUG) {
        console.log("sending address. code: " + code.toString(16));
    }
    
	// write address
	var data = new Buffer([header, code]);
	self.messageData = data;
	self.checksum = calcChecksum(data);
	self.serialPort.write(data);
	self.state = State.EXPECT_CHKSUM;
}


CM11.prototype.sendFunction = function(fn, callback) {
    self.messageCallback = callback;
    var header = 0x06;      // function message
    // TODO add dim amount to header if required
    var code = self.houseCode << 4 | fn;
    if (DEBUG) {
        console.log("sending function. code: " + code.toString(16));
    }
    
    var data = new Buffer([header, code]);
    self.messageData = data;
    self.checksum = calcChecksum(data);
    self.serialPort.write(data);
    self.state = State.EXPECT_CHKSUM;
}

CM11.prototype.sendStatusRequest = function(callback) {
    // TODO queue commands
    // send status request
    this.statusOffset = 0;
    this.messageCallback = callback;
    this.serialPort.write(new Buffer([0x8b]));
    this.state = State.EXPECT_STATUS;
}


CM11.prototype.sendCommand = function(address, fn, callback) {
    if (DEBUG) {
        console.log("queuing command for adress: " + address.toString(16) + " and fn: " + fn.toString(16));
    }
    self.queueCommand({type: "command", address: address, fn: fn, callback: callback});
        
}

/**
 * Get status from the X10 interface
 */
CM11.prototype.getStatus = function(callback) {
    if (DEBUG) {
        console.log("queuing status request");
    }
    self.queueCommand({type: "status", callback: callback});
}


CM11.prototype.queueCommand = function(command) {
     self.commandQueue.push(command);
     if (self.commandQueue.length == 1) {   // if the only funcion on queu, call it
        self.executeCommand(command);
     }
     if (self.commandQueue > 5) {
         console.log("warning X10 queue > 5: " + self.commandQueue.length);
     }
}

CM11.prototype.nextCommand = function() {
     var prevCommand = self.commandQueue.shift();
     if (self.commandQueue.length > 0 ) {   // if the only funcion on queu, call it
         var command = self.commandQueue[0];
         if (DEBUG) {
             console.log("--- execute queued command");
         }
         self.executeCommand(command);
     }
}

CM11.prototype.executeCommand = function(command) {
    var callback = command.callback;
    
    if (command.type == "command") {
        var address = command.address;
        var fn = command.fn;
        self.sendAddress(address, function(err) {
            if (err) {
                if (typeof(callback) === "function") {
                    callback(err);       // send error
               }
               self.nextCommand();          // next off queue
            }
            else {
                self.sendFunction(fn, function(err) {
                    if (typeof(callback) === "function") {
                       callback(err);
                    }
                    self.nextCommand();          // next off queue
                });
            }
        });
    }    
    else if (command.type == "status") {
        self.sendStatusRequest(function(err) {
            if (typeof(callback) === "function") {
                callback(err);
            }
            self.nextCommand();        // next off queue
        });
    }
}

var Address = {
    HOUSE_A: HOUSE.A,
    HOUSE_B: HOUSE.B,
    HOUSE_C: HOUSE.C,
    HOUSE_D: HOUSE.D,
    HOUSE_E: HOUSE.E,
    HOUSE_F: HOUSE.F,
    HOUSE_G: HOUSE.G,
    HOUSE_H: HOUSE.H,
    HOUSE_I: HOUSE.I,
    HOUSE_J: HOUSE.J,
    HOUSE_K: HOUSE.K,
    HOUSE_L: HOUSE.L,
    HOUSE_M: HOUSE.M,
    HOUSE_N: HOUSE.N,
    HOUSE_O: HOUSE.O,
    HOUSE_P: HOUSE.P,

    UNIT_1: UNIT.UNIT_1, 
    UNIT_2: UNIT.UNIT_2,    
    UNIT_3: UNIT.UNIT_3,    
    UNIT_4: UNIT.UNIT_4,   
    UNIT_5: UNIT.UNIT_5,   
    UNIT_6: UNIT.UNIT_6,   
    UNIT_7: UNIT.UNIT_7,   
    UNIT_8: UNIT.UNIT_8,   
    UNIT_9: UNIT.UNIT_9,
    UNIT_10: UNIT.UNIT_10,  
    UNIT_11: UNIT.UNIT_11,     
    UNIT_12: UNIT.UNIT_12,
    UNIT_13: UNIT.UNIT_13,
    UNIT_14: UNIT.UNIT_14,
    UNIT_15: UNIT.UNIT_15,
    UNIT_16: UNIT.UNIT_16,
};

exports.CM11 = CM11;
exports.Address = Address;

exports.HOUSE = HOUSE;
exports.UNIT = UNIT;
exports.FUNCTION = FUNCTION;

exports.CM11 = CM11;