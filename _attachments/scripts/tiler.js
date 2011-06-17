Array.prototype.subtract = function (subtrahend) {
	return this.filter(function (item) {
		return subtrahend.indexOf(item) == -1;
	});
};

/*
TiledScroller
A mechanism for scrolling and tiling things

Usage:

var thing = new TiledScroller({
	outer: container element
	innter: inner element
	tileSize: [w, h] - pixel size of a tiles
	showTile: function (x, y) - a tile comes into view
	hideTile: function (x, y) - a tile leaves view
	start: [x, y]
	center: true - put 0,0 at the center of the page
	margin: {x: 0, y: 0, t: 0} - preload tiles within a time-space margin
	onScroll: function (x, y) - scroll event
});

thing.setPosition(x, y);

*/
function TiledScroller(options) {
	var inner = options.inner;
	var outer = options.outer;
	var initialPosition = options.start || [0, 0];
	var center = !!options.center;
	var onScroll = options.onScroll;
	var margin = options.margin || {x: 0, y: 0, t: 0};
	
	var showTile = options.showTile;
	var hideTile = options.hideTile;
	
	var middle = this.midElement = document.createElement("div");
	middle.appendChild(inner);
	if (center) {
		middle.style.position = "absolute";
		middle.style.left = "50%";
		middle.style.top = "50%";
	}
	
	// tiler inside scroller
	
	var tiler = this.tiler = new Tiler({
		outer: middle,
		inner: inner,
		showTile: function (coords) { showTile(coords[0], coords[1]); },
		hideTile: function (coords) { hideTile(coords[0], coords[1]); },
		tileSize: options.tileSize,
	});
	
	var scroller = this.scroller = new Scroller({
		container: outer,
		contents: middle,
		scrollContents: true,
		dragToScroll: true,
		start: initialPosition,
		onScroll: updateViewport
	});
	
	this.isTileVisible = function (coords) {
		return tiler.isTileVisible(coords[0], coords[1]);
	};
	
	this.getTileAtPixel = function (x, y) {
		return tiler.getTileAtPixel(x, y);
	};
	
	this.setTileSize = function (w, h) {
		return tiler.setTileSize(w, h);
	};
	
	var idk = 12; // idk
	
	var prev = {
		x: initialPosition[0],
		y: initialPosition[1],
		t: +new Date()
	};
	function updateViewport(x, y) {
		if (!parent) {
			tiler.setFrame(0, 0);
			return;
		}
		var width = outer.offsetWidth;
		var height = outer.offsetHeight;
		var bounds = {
			x: -x - (center && (idk + width / 2)),
			y: -y - (center && (idk + height / 2)),
			w: width,
			h: height
		};
		var bounds1 = bounds;
		//console.log('original:', bounds);

		// expand bounds with margin
		if (margin.x || margin.y) {
			bounds = {
				x: bounds.x - margin.x,
				y: bounds.y - margin.y,
				w: bounds.w + margin.x * 2,
				h: bounds.h + margin.y * 2
			};
		}
		
		// predict future position
		var dx = x - prev.x;
		var dy = y - prev.y;
		if (dx || dt) {
			var t = +new Date();
			var dt = t - prev.t;
			prev.x = x;
			prev.y = y;
			prev.t = t;
			
			if (dt) {
				var prediction = {
					x: bounds1.x + dx / dt * margin.t,
					y: bounds1.y + dy / dt * margin.t
				};
				//console.log(dx / dt * margin.t, dy / dt * margin.t);
				
				// expand bounds with predicted future position
				var bounds2 = {
					x1: Math.min(bounds.x, prediction.x),
					y1: Math.min(bounds.y, prediction.y),
					x2: Math.max(bounds.x + bounds.w, prediction.x + width),
					y2: Math.max(bounds.y + bounds.h, prediction.y + height)
				};
				bounds = {
					x: bounds2.x1,
					y: bounds2.y1,
					w: bounds2.x2 - bounds2.x1,
					h: bounds2.y2 - bounds2.y1
				};
			}
			//console.log(bounds.w - bounds1.w);
		}
		
		tiler.setBounds(bounds);
		//console.log('expanded:', bounds);
		onScroll && onScroll(x, y);
	}
	updateViewport(initialPosition[0], initialPosition[1]);
	
	window.addEventListener("resize", function (e) {
		updateViewport(scroller.x, scroller.y);
	}, false);
}

/*
Tiler
A mechanism for tiling things

Usage:

var tiler = new Tiler({
	outer: container element
	inner: inner element
	tileSize: [w, h] - pixel size of a tiles
	intialBounds: [x, y, w, h] - initial position and frame size
	showTile: function ([x, y]) - a tile comes into view
	hideTile: function ([x, y]) - a tile leaves view
});

tiler.setPosition(x, y);
tiler.setFrame(w, h);
// or
tiler.setBounds(x, y, w, h);

*/
function Tiler(options) {
	var inner = options.inner;
	var outer = options.outer;
	
	this.hideTile = options.hideTile;
	this.showTile = options.showTile;
	
	this.setTileSize.apply(this, options.tileSize || [256, 256]);
	
	this.tiles = {};
	this.visibleTiles = [];

	var bounds = options.initialBounds;
	bounds && this.setBounds(bounds);
}
Tiler.prototype = {
	visibleTiles: null,
	tiles: null,
	tileWidth: 256,
	tileHeight: 256,
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	
	setPosition: function (x, y) {
		this.setBounds(x, y, this.w, this.h);
	},
	
	setFrame: function (w, h) {
		this.setBounds(this.x, this.y, w, h);
	},
	
	setBounds: function (x, y, w, h) {
		// allow object as argument
		if (arguments.length == 1) {
			var bounds = arguments[0];
			x = bounds.x;
			y = bounds.y;
			w = bounds.w;
			h = bounds.h;
		}
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.update();
	},
	
	update: function () {
		this.setVisibleTiles(this.getTilesInRect(
			this.x, this.y, this.w, this.h));
	},
	
	showTile: function () {},
	hideTile: function () {},
	
	getTile: function (x, y) {
		var id = x + "," + y;
		return this.tiles[id] || (this.tiles[id] = [x, y]);
	},
	
	getTileAtPixel: function (x, y) {
		return this.getTile(
			Math.floor(x / this.tileWidth),
			Math.floor(y / this.tileHeight)
		);
	},
	
	getVisibleTiles: function () {
		return this.visibleTiles;
	},
	
	getTilesInRect: function (x0, y0, w, h) {
		var tiles = [];
		var left   = Math.floor(x0 / this.tileWidth);
		var top    = Math.floor(y0 / this.tileHeight);
		var right  = Math.ceil((x0 + w) / this.tileWidth);
		var bottom = Math.ceil((y0 + h) / this.tileHeight);
		
		var i = 0;
		for (var x = left; x < right; x++) {
			for (var y = top; y < bottom; y++) {
				if (i++ > 1000) { debugger; return; }
				tiles.push(this.getTile(x, y));
			}
		}
		return tiles;
	},
	
	setVisibleTiles: function (newTiles) {
		var oldTiles = this.getVisibleTiles();
		this.visibleTiles = newTiles;
		oldTiles.subtract(newTiles).forEach(this.hideTile);
		newTiles.subtract(oldTiles).forEach(this.showTile);
	},
	
	isTileVisible: function (x, y) {
		var tw = this.tileWidth;
		var th = this.tileHeight;
		return ((x + tw) > this.x) && (x < (this.x + this.w))
			&& ((y + th) > this.y) && (y < (this.y + this.h));
	},
	
	setTileSize: function (w, h) {
		if (!w || !h) {
			// can't be zero, idiot
			return;
		}
		this.tileWidth = w;
		this.tileHeight = h;
		this.tiles && this.update();
	}
};
