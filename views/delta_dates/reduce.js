function(keys, values, rereduce) {
	if (rereduce) {
		return {
			first: Math.min.apply(0, values.map(function (value) {
				return value.first;
			})),
			last: Math.max.apply(0, values.map(function (value) {
				return value.last;
			}))
		};
	} else {
		return {
			first: Math.min.apply(0, keys.map(function (key) {
				return key[0];
			})),
			last: Math.max.apply(0, keys.map(function (key) {
				return key[0];
			}))
		};
	}
}