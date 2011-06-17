function(doc) {
	if (doc.type != 'delta') return;
	
	var startX = doc.x;
	var startY = doc.y;
	var date = doc.date;

	doc.content.split("\n").forEach(function (line, y) {
		line.split("").forEach(function (char, x) {
			emit([startX + x, startY + y, date], null);
		});
	});
}