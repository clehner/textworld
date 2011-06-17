function(doc) {
	if (doc.type != 'delta') return;
	
	var offsetX = doc.x;
	var offsetY = doc.y;
	
	var text = doc.content;
	var lines = text.split("\n");
	var height = lines.length;
	var width = Math.max.apply(0, lines.map(function (line) {
		return line.length;
	}));
	
	var boxW = 32;
	var boxH = 16;
	
	function substr2d(xStart, yStart) {
		var lines2 = [];
		var i = 0;
		
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
			lines2[i++] = (leftPadding + lines[y].substr(xStart, xWidth)).substr(0, boxW);
		}
		return lines2.join("\n");
	}
	
	var yStart = Math.floor(offsetY / boxH) * boxH;
	var xStart = Math.floor(offsetX / boxW) * boxW;
	var yEnd = offsetY + height;
	var xEnd = offsetX + width;
	for (var y = yStart; y < yEnd; y += boxH) {
		for (var x = xStart; x < xEnd; x += boxW) {
			var xCut = x - offsetX;
			var yCut = y - offsetY;
			emit([x, y, doc.date], substr2d(xCut, yCut));
		}
	}
}