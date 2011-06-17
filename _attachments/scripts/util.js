function $(id) {
	return document.getElementById(id);
}

if (!Date.now) {
	Date.now = function () {
		return new Date().getTime();
	};
}

String.prototype.repeat = function (n) {
	return new Array(n + 1).join(this);
};

(function () {
	var slice = Array.prototype.slice;
	Function.prototype.bind = function (context) {
		var fn = this,
			args = slice.call(arguments, 1);
		return function () {
			return fn.apply(context, args.concat(slice.call(arguments)));
		};
	};
}());

// Simulate onhashchange support in all browsers
"onhashchange" in window || (function () {
	var lastHash = '';
	function pollHash() {
		if (lastHash !== location.hash) {
			lastHash = location.hash;
			var event = document.createEvent("HTMLEvents");
			event.initEvent("hashchange", true, false);
			document.body.dispatchEvent(event);
			if (typeof onhashchange == "function") {
				onhashchange(event);
			}
		}
	}
	setInterval(pollHash, 100);
})();

// debounce, by John Hann
// http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
// discard close invokations for the last one.
Function.prototype.debounce = function (threshold, execAsap) {
	var func = this, timeout;
	return function debounced() {
		var obj = this, args = arguments;
		function delayed() {
			if (!execAsap)
				func.apply(obj, args);
			timeout = null; 
		}
 
		if (timeout)
			clearTimeout(timeout);
		else if (execAsap)
			func.apply(obj, args);
 
		timeout = setTimeout(delayed, threshold || 100); 
	};
};

// caps invokation frequency at @threshold ms
Function.prototype.throttle = function (threshold) {
	var func = this,
		throttling, args,
		apply = this.apply;
	function endThrottle() {
		throttling = false;
		if (args) {
			apply.apply(func, args);
			args = null;
		}
	}
	return function throttler() {
		if (throttling) {
			args = [this, arguments];
		} else {
			args = null;
			throttling = true;
			setTimeout(endThrottle, threshold);
			return func.apply(this, arguments);
		}
	};
};

// useful for mouse handlers
function getRelativeCoords(e, element) {
	var x = e.pageX;
	var y = e.pageY;
	for (var el = element; el; el = el.offsetParent) {
		x -= el.offsetLeft - el.scrollLeft;
		y -= el.offsetTop - el.scrollTop;
	}
	return [x, y];
}

function Slider(opt) {
	var self = this;
	var sliderEl = this.element = opt.element;
	var trackEl = sliderEl.parentNode;
	var snap = opt.snap || 0;
	var onupdate = opt.onupdate;
	var pos;
	
	sliderEl.addEventListener("mousedown", mousedown, false);

	function usableArea(pos) {
		return 1 - sliderEl.offsetWidth / trackEl.offsetWidth;
	}

	// allow clicking in the track to jump
	trackEl.addEventListener("mousedown", trackMousedown, false);
	function trackMousedown(e) {
		if (e.target != this) return;
		sliderEl.style.left = e.layerX - sliderEl.offsetWidth / 2 + "px";
		mousedown(e);
		drag(e);
	}
	
	var dragging = false;
	var startX;
	function mousedown(e) {
		if (dragging) return;
		dragging = true;
		document.addEventListener("mousemove", drag, false);
		document.addEventListener("mouseup", mouseup, false);
		document.addEventListener("contextmenu", mouseup, false);
		startX = sliderEl.offsetLeft - e.pageX;
		// prevent accidental text selection while dragging slider
		e.preventDefault();
		e.stopPropagation();
	}
	function mouseup(e) {
		dragging = false;
		document.removeEventListener("mousemove", drag, false);
		document.removeEventListener("mouseup", mouseup, false);
		document.removeEventListener("contextmenu", mouseup, false);
	}
	
	function drag(e) {
		var sliderX = (e.pageX + startX) / usableArea();
		var part = sliderX / trackEl.offsetWidth;
		setPos(part);
	}
	
	function setPos(part, dontUpdate) {
		var snapped = snap ? Math.round(part / snap) * snap : part;
		var newPos = +((Math.min(1, Math.max(0, snapped))).toFixed(10));
		if (pos == newPos) return;
		pos = newPos;
		//sliderEl.style.left = sliderX + "px";
		sliderEl.style.left = pos * usableArea() * 100 + "%";
		dontUpdate || update();
	}
	
	function update() {
		onupdate.call(self, pos);
	}
	
	this.set = setPos;
	this.update = update;
	
	if (opt.start) {
		setPos(opt.start);
	}
}