var sys = require('util'),
    EventEmitter = require('events').EventEmitter;

/**
 * RingBuffer
 */
var RingBuffer = function(size){
	if (!size || size<=1)
		throw new Error('Size must be a positive integer greater than one');

	this.buffer = [];
	this.readHead = 0;
	this.writeHead = 0;
	this.itemCount = 0;
	
	this.move = function(value){return (value+1)%size;}

	this.read = function () {
		var ret;
		if (this.itemCount==0) return undefined;
		else {
			ret = this.buffer[this.readHead];
			this.buffer[this.readHead] = undefined; // consume/remove reference
			this.readHead = this.move(this.readHead);
			this.itemCount--;
			return ret;
		}
	}
	
	this.write = function (value) {
		if (this.itemCount==size) {
		  this.readHead = this.move(this.readHead); // skip the oldest element, because it's about to be overwritten
		}
		else {
            this.itemCount++;
		}
		
		this.buffer[this.writeHead] = value;
		this.writeHead = this.move(this.writeHead);
	}
	
	this.count = function () { return this.itemCount; }
	
	this.log = function(){
		console.log("readHead: " + this.readHead + ", writeHead: " + this.writeHead + ", itemCount: " + this.itemCount);
		var i, s="Items: ";
		for(i=0; i<size; i++){
			if(i>0) s = s + ", ";
			s = s + "'" + this.buffer[i] + "'";
		}
		console.log(s);
	}
};


/**
 * asynchronous RingBuffer
 */
function AsyncRingBuffer(size) {
    EventEmitter.call(this);

	var _realBuffer = new RingBuffer(size);
	var _eventName = 'data';
    var self = this;
    
    /*
	var asyncRead = function(callback){
		if (realBuffer.count()>0){ //read(callback); // synchronous
			var value = realBuffer.read();
			if (typeof callback==='function') {
			    callback(null, value);
			}
		}
		else { // subscribe to the next value
			self.once(eventName, function(){asyncRead(callback);});
		}
	}

	var write = function(value, callback){
		realBuffer.write(value);
		self.emit('data');
		if(typeof callback==='function')
			callback(null, value);
	}
    return {
        read: asyncRead,
        write: write,
        count: realBuffer.count,
        log: realBuffer.log
    }
	*/
	this.read = function(callback) {
        if (_realBuffer.count()>0){ //read(callback); // synchronous
            var value = _realBuffer.read();
            if (typeof callback==='function') {
                callback(value);
            }
        }
        else { // subscribe to the next value
            self.once(_eventName, function(){ self.read(callback); });
        }
    }

    this.write = function(value, callback) {
        _realBuffer.write(value);
        self.emit('data', value);
        if (typeof callback==='function') {
            callback(value);
        }
    }

    this.count = _realBuffer.count;
    
    this.log = _realBuffer.log;
    
    return this;
}

sys.inherits(AsyncRingBuffer, EventEmitter);
//AsyncRingBuffer.prototype = Object.create( EventEmitter.prototype );

/*
AsyncRingBuffer.prototype.read = function(callback) {
    if (_realBuffer.count()>0){ //read(callback); // synchronous
        var value = realBuffer.read();
        if (typeof callback==='function') {
            callback(null, value);
        }
    }
    else { // subscribe to the next value
        self.once(eventName, function(){ self._asyncRead(callback); });
    }
}

AsyncRingBuffer.prototype.write = function(value, callback) {
    _realBuffer.write(value);
    self.emit('data');
    if (typeof callback==='function') {
        callback(null, value);
    }
}
*/

exports.RingBuffer = RingBuffer;
exports.AsyncRingBuffer = AsyncRingBuffer;
