function(doc) {
	if (doc.type != 'delta') return;
	
	var startX = doc.x;
	var startY = doc.y;
	var date = doc.date;
	var world = doc.world;
	
	doc.content.split("\n").forEach(function (line, y) {
		line.split("").forEach(function (char, x) {
			emit([world, startX + x, startY + y, date], null);
		});
	});
}