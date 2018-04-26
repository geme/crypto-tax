function render() {
	const body = document.getElementsByTagName("body")[0];

	const submitBtn = document.createElement('button').set({
		type: "submit",
		text: "submit"
	});

	const fileInput = document.createElement('input').set({
		type: "file",
		id: "file",
		multiple: true
	});

	const form = document.createElement('form').set({
		action: "/",
		method: "post",
		onsubmit: () => {
			readFile("file", renderReport);
			return false;
		},
		append: [ fileInput,
				  submitBtn ]
	});

	body.appendChild(form);
	body.appendChild(document.createElement('br'));
}

function readFile(inputId, callback) {
	try {
		var files = document.getElementById(inputId).files,
			count = files.length,
			done = 0,
			data = [];

		if (count <= 0) {
			throw "no input file!"
		}

		const keys = Object.keys(files);
		keys.forEach((key) => {
			const file = files[key];
			const fileReader = new FileReader();
			fileReader.onload = (fr, label) => {
				const parsed = parseCSV(fr.target.result);
				data.push.apply(data, parsed);
				done = done + 1;

				if (done == count) {
					callback(new Report(data));
				}
			};
			fileReader.readAsText(file);
		});
	} catch (e) {
		console.log(e);
	}
}

function renderReport(report) {
	report.fetchMissingEurPrices(() => {
		report.calc();
		
		const csv = 'data:text/csv;charset=utf-8,' + report.toCSV();
		const data = encodeURI(csv);

		const link = document.createElement('a').set({
			href: data,
			download: "export.csv",
			text: "export"
		});

		document.getElementsByTagName("body")[0].appendChild(link);
       
	});
	report.render();
}

window.onload = render;