function(keys, values, rereduce) {
	var boxW = 32;
	var boxH = 16;
	
	var matrices = values.map(function (value) {
		return value.split("\n").map(function (line) {
			return line.split("");
		});
	});
	
	if (!rereduce) {
		keys.forEach(function (pair, i) {
			var key = pair[0];
			var date = key[2];
			var matrix = matrices[i];
			matrix.date = date;
		});
		matrices.sort(function (a, b) {
			return a.date - b.date;
		});
	}
	
	var base = matrices.shift();
	matrices.forEach(function (delta) {
		delta.forEach(function (line, y) {
			var baseLine = base[y] || (base[y] = []);
			line.forEach(function (character, x) {
				if (character != ' ') {
					baseLine[x] = character;
				} else if (baseLine[x] == null) {
					baseLine[x] = ' ';
				}
			});
		});
	});
	return base.map(function (line) {
		return line.join("");
	}).join("\n"); 
}