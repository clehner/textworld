function (doc, oldDoc, userCtx) {
	var isAdmin = userCtx.roles.indexOf('_admin') != -1;
	var type = doc.type || (oldDoc && oldDoc.type);
	
	if (doc._deleted) {
		if (!isAdmin) {
			throw {unauthorized: "Only admin can delete docs."};
		}
		return;
	}
	if (oldDoc) {
		if (!isAdmin) {
			throw {unauthorized: "Only admin can change docs."};
		}
	}
	
	if (type == "delta") {
		if (typeof doc.world != "string") {
			throw {forbidden: "Delta must have a world string."};
		}
		if (typeof doc.content != "string") {
			throw {forbidden: "Delta must have a content string."};
		}
		if (typeof doc.x != "number" || typeof doc.y != "number") {
			throw {forbidden: "Delta must have numberic coordinates."};
		}
		if (typeof doc.date != "number") {
			throw {forbidden: "Delta must have a numeric date."};
		}
	} else if (!isAdmin) {
		throw {forbidden: "Doc type must be delta."};
	}
}