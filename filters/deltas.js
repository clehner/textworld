function (doc, req) {
	return (doc.type == "delta")
		&& (req.query.world == doc.world);
}