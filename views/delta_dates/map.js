function(doc) {
	if (doc.type != 'delta') return;
	emit(doc.date, null);
}