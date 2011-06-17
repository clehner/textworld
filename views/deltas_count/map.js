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
	
	var yStart = Math.floor(offsetY / boxH) * boxH;
	var xStart = Math.floor(offsetX / boxW) * boxW;
	var yEnd = offsetY + height;
	var xEnd = offsetX + width;
	for (var y = yStart; y < yEnd; y += boxH) {
		for (var x = xStart; x < xEnd; x += boxW) {
			emit([x, y, doc.date], 1);
		}
	}
}