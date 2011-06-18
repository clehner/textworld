Couch.urlPrefix =
	location.host in {'localhost':1, 'cel.local':1} ? '/couchdb' : '';

var db = Couch.db("textworld");

var cellsElement = $("text");
var containerElement = $("container");

var world = location.pathname.match(/^.*\/(.*?)$/)[1] || "cel";

var cells = {
	add: function (cell) {
		var coords = cell.coords;
		var row = cells[coords[1]] || (cells[coords[1]] = {});
		row[coords[0]] = cell;
		cells._add(cell);
	},
	_add: function (cell) {
		cellsElement.appendChild(cell.element);
	},
	get: function (x, y) {
		var row = cells[y];
		return row && row[x];
	},
	getOrAdd: function (x, y) {
		var row = cells[y] || (cells[y] = {});
		var cell = row[x];
		if (!cell) {
			cell = row[x] = new Cell(x, y);
			cells._add(cell);
		}
		return cell;
	},
	forEach: function (cb) {
		for (var y in cells) {
			if (isNaN(y)) continue;
			var row = cells[y];
			for (var x in row) {
				cb(row[x], x, y);
			}
		}
	},
	_cellsLoadingCount: 0,
	_onCellLoadStart: function (cell) {
		this._cellsLoadingCount++;
	},
	_onCellLoadEnd: function (cell) {
		if (--this._cellsLoadingCount == 0) {
			if (this.onCellsLoaded) {
				this.onCellsLoaded();
			}
		}
	},
	onCellsLoaded: null
};


var boxW = 32;
var boxH = 16;

var letterWidth = 8;
var letterHeight = 15;

var nbsp = String.fromCharCode(160);

function Cell(x, y) {
	this.coords = [x, y];
	this.element = document.createElement("div");
	this.element.className = "cell";
	this.updatePosition();
	if (tiledscroller &&
		tiledscroller.isTileVisible([x * letterWidth, y * letterHeight])) {
		this.show();
	} else {
		this.hide();
	}
}
Cell.prototype = {
	coords: null,
	content: "",
	lastDeltaDate: null,
	isLoaded: false,
	isLoading: false,
	isVisible: false,
	toString: function () {
		return this.x + "," + this.y;
	},
	updatePosition: function () {
		var s = this.element.style;
		s.left = this.coords[0] * letterWidth + "px";
		s.top = this.coords[1] * letterHeight + "px";
		s.width = boxW * letterWidth + "px";
		s.height = boxH * letterHeight + "px";
	},
	loadData: function () {
		// load data from this.lastDeltaDate to timeline.currentTime
		this.isLoading = true;
		this.deltaDateLoading = timeline.currentTime;
		this.renderClassName();
		if (this.lastDeltaDate > timeline.currentTime) {
			// going back in time
			this.reset();
		} else if (this.lastDeltaDate == timeline.currentTime) {
			// up to date
			return;
		}
		//console.log(this.coords, 'bring', this.lastDeltaDate, 'to', timeline.currentTime);
		db.view('textworld/deltas', {
			group_level: 3,
			startkey: [world].concat(this.coords, this.lastDeltaDate),
			endkey: [world].concat(this.coords, timeline.currentTime),
			success: this._dataLoaded.bind(this)
		});
		cells._onCellLoadStart(this);
	},
	_dataLoaded: function (data) {
		this.isLoading = false;
		this.isLoaded = true;
		this.renderClassName();
		var row = data.rows[0];
		this.lastDeltaDate = this.deltaDateLoading;
		var text = row ? row.value : "";
		if (this.content) {
			//console.log('adding content', this.lastDeltaDate);
			this.addDelta(text);
		} else {
			//console.log('setting content', this.lastDeltaDate);
			this.content = text;
		}
		this.render();
		cells._onCellLoadEnd(this);
	},
	render: function () {
		//if (this.isVisible) {
		this.element.textContent = this.content.replace(nbsp, ' ');
	},
	addDelta: function (delta, date) {
		if (!delta) return;
		if (date) this.lastDeltaDate = date;
		var base = this.content.split("\n").map(function (line) {
			return line.split("");
		});
		delta.split("\n").forEach(function (line, y) {
			var baseLine = base[y] || (base[y] = []);
			line.split("").forEach(function (character, x) {
				if (character != ' ') {
					baseLine[x] = character;
				} else if (baseLine[x] == null) {
					baseLine[x] = ' ';
				}
			});
		});
		this.content = base.map(function (line) {
			return line.join("");
		}).join("\n");
		this.render();
	},
	setChar: function (x, y, char) {
		var lines = this.content.split("\n");
		if (y >= lines.length && char == " ") {
			// this is bogus!
			return false;
		}
		while (y >= lines.length) {
			lines.push("");
		}
		var line = lines[y];
		if (x < line.length) {
			if (line[x] == char) return false; // more bogus.
			var line2 = line.substr(0, x) + char + line.substr(x + 1);
		} else {
			if (char == " ") return false; // bogus....
			line2 = line + new Array(x - line.length + 1).join(" ") + char;
		}
		lines[y] = line2;
		this.content = lines.join("\n");
		this.render();
		return true;
	},
	show: function () {
		if (this.isVisible) return;
		this.isVisible = true;
		this.element.style.display = "block";
		if (this.isOutOfDate()) {
			this.loadData();
		}
	},
	hide: function () {
		if (this.isVisible) {
			this.isVisible = false;
			this.element.style.display = "none";
		}
	},
	reset: function () {
		this.content = '';
		this.lastDeltaDate = 0;
	},
	refresh: function (force) {
		if (force) {
			this.reset();
		}
		if (this.isVisible) {
			this.loadData();
		}
	},
	isOutOfDate: function () {
		return this.lastDeltaDate != timeline.currentTime;
	},
	renderClassName: function () {
		this.element.className = "cell" +
			(this.isLoading ? " loading" : "");
	}
};

// Preload a list of boxes have a history of at least one delta.
// Only load from those cells.
var preloadCellsList = true;
if (preloadCellsList) db.view('textworld/deltas_count', {
	group_level: 3,
	startkey: [world],
	endkey: [world, {}],
	success: function (data) {
		data.rows.forEach(function (row) {
			var key = row.key;
			var cell = new Cell(key[1], key[2]);
			cells.add(cell);
		});
	}
});

var tiledscroller = new TiledScroller({
	inner: cellsElement,
	outer: containerElement,
	tileSize: [boxW * letterWidth, boxH * letterHeight],
	center: true,
	margin: {x: 100, y: 100, t: 100},
	showTile: function (x, y) {
		if (preloadCellsList) {
			var cell = cells.get(x * boxW, y * boxH);
			cell && cell.show();
		} else {
			cells.getOrAdd(x * boxW, y * boxH).show();
		}
		//console.log('show', x, y, cell);
	},
	hideTile: function (x, y) {
		if (preloadCellsList) {
			var cell = cells.get(x * boxW, y * boxH);
			cell && cell.hide();
		} else {
			cells.getOrAdd(x * boxW, y * boxH).hide();
		}
		//console.log('hide', x, y, cell);
	},
	start: (sessionStorage.textworldpos || "0,0").split(",").map(Number),
	onScroll: function (x, y) {
		sessionStorage.textworldpos = x + "," + y;
	}.debounce(50)
});

window.addEventListener("resize", function () {	
	calibrateLetterSize();
}, false);

function calibrateLetterSize() {
	var el = document.createElement("div");
	el.style.whiteSpace = "pre";
	el.innerHTML = "\n".repeat(19) + nbsp.repeat(20);
	cellsElement.appendChild(el);

	function done() {
		letterWidth = el.offsetWidth / 20;
		letterHeight = el.offsetHeight / 20;
		//console.log(letterWidth, letterHeight);
		cellsElement.removeChild(el);
		tiledscroller.setTileSize(boxW * letterWidth, boxH * letterHeight);
		cells.forEach(function (cell) {
			cell.updatePosition();
		});
	}

	// the div might need time to settle in.
	if (el.offsetWidth) done();
	else setTimeout(done, 10);
}
calibrateLetterSize();

function refreshCells() {
	cells.forEach(function (cell) {
		cell.refresh();
	});
}

var changesPromise;
function listenForDeltas(since) {
	if (changesPromise) {
		return changesPromise.start();
	}
	changesPromise = db.changes(since, {
		filter: 'textworld/deltas',
		include_docs: true,
		world: world
	});
	changesPromise.onChange(function (resp) {
		var results = resp.results;
		if (results) results.forEach(function (change) {
			// a new, updated, or deleted tile doc
			receiveDelta(change.doc);
		});
	});
	window.addEventListener("online", changesPromise.start, false);
	window.addEventListener("offline", changesPromise.stop, false);
}

// from views/deltas/reduce.js
function substr2d(lines, xStart, yStart) {
	var lines2 = [];
	var i = 0;
	
	var height = lines.length;
	var yEnd = Math.min(yStart + boxH, height);
	var xWidth = xStart + boxW;
	
	if (yStart < 0) {
		var topPadding = new Array(-yStart).join("\n");
		lines2[i++] = topPadding;
		yStart = 0;
	}
	if (xStart < 0) {
		var leftPadding = new Array(1 - xStart).join(" ");
		xStart = 0;
	} else {
		leftPadding = "";
	}
	
	for (var y = yStart; y < yEnd; y++) {
		lines2[i++] = leftPadding + lines[y].substr(xStart, xWidth);
	}
	return lines2.join("\n");
}

String.prototype.leftPaddingLength = function (str) {
	for (var i = 0; this.indexOf(str, i) == i; i += str.length);
	return i;
};

function receiveDelta(doc, isPlayback) {
	var refreshCells = false;
	if (doc._deleted) {
		refreshCells = true;
	}
	
	var date = doc.date;
	if (date > timeline.endTime) {
		timeline.setEndTime(date);
	}
	if (date > timeline.currentTime) {
		if (isPlayback) {
			return;
		} else {
			timeline.setCurrentTime(date, true);
		}
	}
	if (date < timeline.currentTime) {
		//console.log("delta out of order");
		// out of order
		refreshCells = true;
	}

	var offsetX = doc.x;
	var offsetY = doc.y;
	var text = doc.content;
	var lines = text.split("\n");
	
	//console.log('Rendering delta:\n', text);
	
	var height = lines.length;
	var width = Math.max.apply(0, lines.map(function (line) {
		return line.length;
	}));
	
	// highlight the delta
	lines.forEach(function (line, y) {
		var x = line.leftPaddingLength(" ");
		new Highlight(x + offsetX, y + offsetY, line.length - x);
	});
	
	// split the delta and render it in each cell
	var yStart = Math.floor(offsetY / boxH) * boxH;
	var xStart = Math.floor(offsetX / boxW) * boxW;
	var yEnd = offsetY + height;
	var xEnd = offsetX + width;
	for (var y = yStart; y < yEnd; y += boxH) {
		for (var x = xStart; x < xEnd; x += boxW) {
			var cell = cells.getOrAdd(x, y);
			if (refreshCells) {
				cell.refresh(true);
			} else {
				var xCut = x - offsetX;
				var yCut = y - offsetY;
				cell.addDelta(substr2d(lines, xCut, yCut), date);
			}
		}
	}
}

function setChar(x, y, char) {
	var tileCoords = tiledscroller.getTileAtPixel(
		x * letterWidth, y * letterHeight);
	var cell = cells.getOrAdd(tileCoords[0] * boxW, tileCoords[1] * boxH);
	return cell.setChar(x - cell.coords[0], y - cell.coords[1], char);
}

function Updater(db, since) {
	function refreshSoon() {
		// don't refresh if there is still content in the buffer
		var busy = editor.delta.content;
		if (!busy) {
			location.reload();
		} else {
			setTimeout(refreshSoon, 1000);
		}
	}

	this.listenForUpdates = function () {
		db.changes(since, {
			filter: "textworld/design"
		}).onChange(function (resp) {
			if (!resp.error) {
				refreshSoon();
			}
		});
	};
}

// If we start listening for changes immediately, the browser will show a
// loader, which we don't want. So we record the db update_seq first, then
// listen for changes after all the cells are loaded.

var update_seq;
db.info({success: function (info) {
	update_seq = info.update_seq;
}});

cells.onCellsLoaded = function () {
	delete cells.onCellsLoaded; // one time listener
	setTimeout(function () {
		new Updater(db, update_seq).listenForUpdates();
		listenForDeltas(update_seq);
	}, 100);
};

// editing stuff

function Highlight(x, y, length) {
	this.element = document.createElement("div");
	this.element.className = "highlight";
	this.element.textContent = nbsp;
	this.move(x, y);
	this.setLength(length);
	setTimeout(this.fadeOut.bind(this), 250);
}
Highlight.prototype = {
	x: 0,
	y: 0,
	l: 0,
	visible: false,
	setLength: function (l) {
		this.element.style.width = (this.l = l) * letterWidth + "px";
	},
	move: function (x, y) {
		this.element.style.left = (this.x = x) * letterWidth + "px";
		this.element.style.top = (this.y = y) * letterHeight + "px";
		return this.show();
	},
	moveBy: function (dx, dy) {
		if (dx || dy) {
			this.move(this.x + dx, this.y + dy);
		}
	},
	show: function () {
		if (this.visible) return;
		this.visible = true;
		cellsElement.appendChild(this.element);
		return this;
	},
	remove: function () {
		if (!this.visible) return;
		this.visible = false;
		cellsElement.removeChild(this.element);
		return this;
	},
	fadeOut: function () {
		var dt = 1/12;
		(function step(t) {
			var hex = ("0" + Math.round(255 * t).toString(16)).substr(-2, 2);
			this.element.style.backgroundColor = "#ffff" + hex;
			if (t < 1) {
				setTimeout(step.bind(this, t + dt), 50);
			} else {
				this.remove();
			}
		}.call(this, 0));
	}
};

function Cursor(x, y) {
	this.element = document.createElement("div");
	this.element.className = "cursor";
	this.element.textContent = nbsp;
	this.move(x, y);
}
Cursor.prototype = Highlight.prototype;

function Delta() {}
Delta.prototype = {
	x: 0,
	y: 0,
	content: "",
	onEdit: null,
	setChar: function (x, y, char) {
		if (!char) {
			char = " ";
		}
		if (!this.content) {
			this.content = char;
			this.x = x;
			this.y = y;
		} else {
			var text = this.content;
			var lines = text.split("\n");
			var height = lines.length;
			if (y < this.y) {
				// add top padding
				text = "\n".repeat(this.y - y) + text;
				this.y = y;
			} else if (y >= this.y + height) {
				// add bottom padding
				text += "\n".repeat(y - this.y - height + 1);
			}
			lines = text.split("\n");
			if (x < this.x) {
				// add left padding (to all lines)
				var leftPadding = " ".repeat(this.x - x);
				lines = lines.map(function (line) {
					return line ? leftPadding + line : "";
				});
				this.x = x;
			} else {
				var y2 = y - this.y;
				var x2 = x - this.x;
				var line = lines[y2];
				if (x2 < line.length) {
					if (line[x2] == char) return false; // more bogus.
					var line2 = line.substr(0, x2) + char + line.substr(x2 + 1);
				} else {
					if (char == " ") return false; // bogus....
					line2 = line + " ".repeat(x2 - line.length) + char;
				}
				lines[y2] = line2;
			}
			this.content = lines.join("\n");
		}
		this.onEdit && this.onEdit();
	},
	reset: function () {
		this.content = "";
	}
}

function Editor() {
	var editing = false;
	var editDelta = this.delta = new Delta();
	var editCursor = new Cursor(0, 0);
	editCursor.remove();

	editDelta.onEdit = function saveEdit() {
		//console.log('Sending delta:\n', this.content);
		if (!this.content) return;
		var content = this.content;
		db.saveDoc({
			type: "delta",
			world: world,
			x: this.x,
			y: this.y,
			content: content,
			date: Date.now()
		}, {
			error: function (status, error, reason) {
				alert("Error! " + reason);
				this.content = content;
			}.bind(this)
		});
		this.reset();
	}.debounce(1500);
	
	var moves = {
		37: [-1, 0], // left
		38: [0, -1], // up
		39: [1, 0], // right
		40: [0, 1] // down
	};
	
	function onKeyDown(e) {
		var move = moves[e.keyCode];
		if (move) {
			editCursor.moveBy(move[0], move[1]);
			e.preventDefault();
		} else if (e.keyCode == 8) { // delete
			editCursor.moveBy(-1, 0);
			characterTyped(" ");
			e.preventDefault();
		}
	}
	function onKeyPress(e) {
		if (e.metaKey || e.ctrlKey) {
			return;
		}
		switch (e.keyCode) {
		case 13: // enter
			editCursor.moveBy(0, 1);
		break;
		case 32: // space
			e.preventDefault();
		//break;
		//case 9: // tab
		//break;
		default:
			characterTyped(String.fromCharCode(e.keyCode));
			editCursor.moveBy(1, 0);
		}
	}
	
	var hasPos = false;
	
	this.startEditing = function () {
		if (editing) return;
		editing = true;
		hasPos && editCursor.show();
		window.addEventListener("keydown", onKeyDown, false);
		window.addEventListener("keypress", onKeyPress, false);
	};
	this.stopEditing = function () {
		if (!editing) return;
		editing = false;
		editCursor.remove();
		window.removeEventListener("keydown", onKeyDown, false);
		window.removeEventListener("keypress", onKeyPress, false);
	};
	
	function characterTyped(char) {
		var x = editCursor.x;
		var y = editCursor.y;
		if (!setChar(x, y, char)) {
			// ignore if it's the same character
			return;
		}
		// use &nbsp; because regular spaces don't count
		if (char == ' ') char = nbsp;
		editDelta.setChar(x, y, char);
	}
	
	this.editAtLetter = function (x, y) {
		hasPos = true;
		editCursor.move(x, y);
	}
};

function examineLetter(x, y, forward) {
	var startTime = timeline.currentTime + (forward ? .1 : -.1);
	db.view("textworld/character_history", {
		startkey: [world, x, y].concat(startTime),
		endkey: [world, x, y].concat(forward ? {} : 0),
		limit: 1,
		descending: !forward,
		success: function (resp) {
			var row = resp.rows[0];
			if (row) {
				var time = row.key[3];
				timeline.setCurrentTime(time);
			} else {
				timeline.setCurrentTime(startTime);
			}
		}
	});
}

// mouse cursor stuff

var examining = false;
function renderMouseCursor() {
	containerElement.className = [
		examining && "examining",
		!timeline.inPlayback && "editing"
	].filter(Boolean).join(" ");
}

function checkKey(e) {
	examining = e.altKey;
	renderMouseCursor();
}
window.addEventListener("keydown", checkKey, false);
window.addEventListener("keyup", checkKey, false);


var editor = new Editor();

// listen for cursor clicks
containerElement.addEventListener("mousedown", function (e) {
	var mouse = getRelativeCoords(e, cellsElement);
	var x = Math.floor(mouse[0] / letterWidth);
	var y = Math.floor(mouse[1] / letterHeight);
	if (examining) {
		examineLetter(x, y, e.shiftKey);
	} else if (!timeline.inPlayback) {
		editor.editAtLetter(x, y);
	}
}, false);

// timeline stuff

function Timeline() {
	var self = this;
	
	this.startTime = 0;
	this.currentTime = Date.now();
	this.endTime = Date.now();
	this.timeRange = Date.now();
	
	this.inPlayback = false;
	this.atPresent = false;
	
	var showDate = false;
	
	function reachedPresent() {
		editor.startEditing();
		renderMouseCursor();
	}
	
	function enteredPlayback() {
		editor.stopEditing();
		renderMouseCursor();
	}
	
	// go to a position on the timeline and load the text world at that time
	function setTime(time, dontRefreshCells) {
		if (time == self.currentTime) return;
		self.currentTime = time;
		dateNode.nodeValue = showDate ? formatDateString(new Date(time)) : "";
		
		// don't show the date at first
		showDate = true;
		
		dontRefreshCells || refreshCells();
		slider.set((time - self.startTime) / self.timeRange, true);
		
		var wasInPlayback = self.inPlayback;
		var wasAtPresent = self.atPresent;
		self.inPlayback = (time < self.endTime);
		self.atPresent = !self.inPlayback;
		if (self.atPresent && !wasAtPresent) {
			reachedPresent();
		} else if (self.inPlayback && !wasInPlayback) {
			enteredPlayback();
		}
	}
	this.setCurrentTime = setTime;
	this.setEndTime = function (time) {
		self.endTime = time;
		self.timeRange = self.endTime - self.startTime;
	};
	
	// load the end and start times
	db.view("textworld/delta_dates", {
		startkey: [world],
		endkey: [world, {}],
		success: function (resp) {
			var row = resp.rows[0];
			if (!row) {
				// empty world
				return;
			}
			var range = row.value;
			self.startTime = range.first;
			self.setEndTime(range.last);
			slider.update();
		}
	});
	
	var months = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(",");
	function padTime(t) {
		return ('00' + t).substr(-2, 2);
	}
	function formatDateString(date) {
		// format date string
		// Jun 9, 2007, 5:46:21 PM
		return months[date.getMonth()] + ' ' +
			date.getDate() + ', ' +
			date.getFullYear() + ', ' +
			(date.getHours() % 12 || 12) + ':' +
			padTime(date.getMinutes()) + ':' +
			padTime(date.getSeconds()) + ' ' +
			(date.getHours() >= 12 ? 'PM' : 'AM');
	}
	
	var dateNode = $("date").appendChild(document.createTextNode(""));
	
	var slider = new Slider({
		element: $("timeline-slider"),
		snap: 0,
		start: 1,
		onupdate: function (n) {
			setTime(Math.round(self.startTime + self.timeRange * n));
		}.debounce(50)
	});
	
	// player stuff
	
	// linked list of delta ids by date
	var deltasIndex = {};
	
	function loadNextDeltaDates(num, cb) {
		var prevDeltaDate = self.currentTime;
		db.view("textworld/delta_dates", {
			reduce: false,
			startkey: [world, prevDeltaDate],
			endkey: [world, {}],
			limit: num,
			include_docs: true,
			success: function (resp) {
				resp.rows.forEach(function (row) {
					var thisDeltaDate = row.key[1];
					deltasIndex[prevDeltaDate] = row.doc;
					prevDeltaDate = thisDeltaDate;
				});
				cb();
			}
		});
	}
	
	function gotoNextDelta(cb) {
		if (self.currentTime >= self.endTime) {
			// at the present.
			return cb(true);
		}
		var delta = deltasIndex[self.currentTime];
		if (!delta) {
			loadNextDeltaDates(10, gotoNextDelta.bind(this, cb));
			return;
		}
		setTime(delta.date, true);
		receiveDelta(delta, true);
		cb && cb();
	}
	
	var playing = this.playing = false;
	var stepInterval = 75;
	var lastPlayTime = new Date().getTime();
	
	function stopPlaying() {
		if (playing) {
			clearInterval(playing);
			playing = self.playing = false;
		}
		self.onStop && self.onStop();
	}
	
	function startPlaying() {
		if (playing) return;
		playing = self.playing = true;
		(function step() {
			if (!playing) return;
			gotoNextDelta(function (end) {
				if (end) stopPlaying();
				if (!playing) return;
				var now = Date.now();
				var dt = Math.min(stepInterval, now - lastPlayTime);
				lastPlayTime = now;
				clearTimeout(playing);
				playing = setTimeout(step, dt);
			});
		}());
	}
	this.stopPlaying = stopPlaying;
	this.startPlaying = startPlaying;
};

var timeline = new Timeline();

$("play-button").addEventListener("click", function (e) {
	if (timeline.playing) {
		this.className = "";
		timeline.stopPlaying();
	} else {
		this.className = "playing";
		timeline.startPlaying();
	}
}, false);
timeline.onStop = function () {
	$("play-button").className = "";
};
