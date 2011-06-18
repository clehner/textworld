function(doc) {
	if (doc.type != 'delta') return;
	emit([doc.world, doc.date], null);
}