const Coinbase = {

	getPriceForDate: function(symbol, date, callback) {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', "https://api.coinbase.com/v2/prices/" + symbol + "-EUR/spot/?date=" + date.yyyymmdd());
		xhr.setRequestHeader('CB-VERSION', '2018-04-04');
		xhr.onreadystatechange = () => {
			if(xhr.readyState === 4 && xhr.status === 200) {
				try {
					const trim = xhr.responseText.trim();
					if (trim && trim.length > 0) {
						const json = JSON.parse(xhr.responseText);
						callback(json.data.amount);	
					}
				} catch(e) {
					console.log(e);
				}
			}
		}
		xhr.send(null);
	}
}
