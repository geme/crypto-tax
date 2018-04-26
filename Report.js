class Sale {
	constructor(transaction, quantity) {
		this.transaction = transaction;
		this.quantity = quantity;
		this.taxableProfit = 0;
	}
}

Sale.prototype.toText = function () {
	return this.transaction.date.ddmmyyyyhhmmss() + ":\t" + this.quantity .toFixed(8) + ":\t" + this.taxableProfit.toFixed(2);
}

class Listing {
	constructor(obj) {
		function sortByDate(a,b) {
			return a.date - b.date;
		}

		this.symbols = Object.keys(obj);

		this.symbols.forEach((symbol) => {
			this[symbol] = obj[symbol];
			this[symbol].purchases.sort(sortByDate);
			this[symbol].sales.sort(sortByDate);
		});

		this.claim();

		this.calc();
	}
}

Listing.prototype.claim = function () {

	function calc(sale, purchase) {
		const sold = sale.sales.reduce((r, s) => {
			return r + s.quantity;
		}, 0);

		if (sold < sale.out_qty) {
			const claimable = purchase.in_qty - purchase.claimed;
			if (claimable > 0) {
		
				const unsold = sale.out_qty - sold;

				if (claimable >= unsold) {
					purchase.claimed += unsold;
					sale.sales.push(new Sale(purchase, unsold));
				} else {
					purchase.claimed += claimable;
					sale.sales.push(new Sale(purchase, claimable))
				}
			}
		}
	}

	function claim(sale, purchases) {
		purchases.filter((purchase) => {
			return purchase.date.getTime() <= sale.date.getTime();
		}).forEach((purchase) => {
			calc(sale, purchase);
		});	
	}

	this.symbols.forEach((symbol) => {
		const purchases = this[symbol].purchases;
		const sales = this[symbol].sales;

		sales.forEach((sale) => {
			claim(sale, purchases);
		});
	});
};

Listing.prototype.calc = function () {
	this.symbols.forEach((symbol) => {
		this[symbol].sales.forEach((t) => {

			t.sales.forEach((sale) => {
				const buyPrice = parseFloat(sale.transaction.amount_in_eur) / parseFloat(sale.transaction.in_qty);
				const profit = parseFloat(t.amount_in_eur) - parseFloat(t.out_qty) * buyPrice;

				t.profit += profit;

				const taxFreeDate = new Date(t.date).setFullYear(t.date.getFullYear() - 1);
				if(sale.transaction.date.getTime() > taxFreeDate ) {
					t.taxable += profit;
					sale.taxableProfit = profit;
				}
			});

			t.taxResult = t.taxable * 0.25;

			t.update();
		});
	});
}

const Report = (function () { 

	Element.prototype.set = function (json) {
	  Object.keys(json).forEach((key) => {
	    if(!key || json[key] == null) return;

	    if(key == "text") 
	      this.appendChild(document.createTextNode(json[key]));
	    else if (key == "append") 
	      if (json[key].constructor === Array)
	        json[key].forEach((a) => {
	          this.appendChild(a);
	        });
	      else
	        this.appendChild(json[key]);
	    else {
	      if(json[key].constructor == Function) {
	        this[key] = json[key];
	      } else {
	        this.setAttribute(key, json[key]);
	      }
	    }
	    
	  });
	  return this;
	}

	Array.prototype.then = function (callback) {
		callback(this);
		return this;
	}

	class Report {
		constructor(arrayOfTransactions) {
			if (arrayOfTransactions.constructor !== Array) throw "[Report.constructor] arg is not an Array";
			arrayOfTransactions.forEach((t) => {
				if (t.constructor !== Transaction) throw "[Report.constructor] one or more items in arg is not a Transaction";
			});

			this.transactions = arrayOfTransactions.filter((t) => { return t.date.getFullYear() <= 2017 });
			this.head = ["Date", "IN quantity", "IN currency", "OUT quantity", "OUT currency", "value in EUR", "Exchange", "Profit", "Tax FIFO Details", "Taxable", "TaxResult"];
		}
	}

	Report.prototype.fetchMissingEurPrices = function(callback) {
		var todo = 0;
	
		this.tradesOnly().filter((t) => {
			// we filter for all items that don not have an EUR price
			return !t.isFiatTransaction() && !t.amount_in_eur;
		}).filter((t) => {
			return t.toFiatSymbol();
		}).then((a) => {
			todo = a.length;
		}).map((t) => {
			const amount = t.in_cur.match(/(ETH|BTC)/) ? t.in_qty : t.out_qty

			Coinbase.getPriceForDate(t.toFiatSymbol(), t.date, (price) => {
				t.amount_in_eur = parseFloat(price) * amount;
				t.updateRenderedEurValue();

				todo--;
				if(todo <= 0) callback();
			});
		});
	};

	Report.prototype.tradesOnly = function() {
		return this.transactions.filter((t) => {
			if(t.constructor !== Transaction) return false;
			return t.isTrade();
		});
	};

	Report.prototype.render = function() {	
		const thead = document.createElement('thead').set({
			append: document.createElement('tr').set({
				append: this.head.map((h) => { 
					return document.createElement('th').set({ text: h }) 
				})
			})
		});

		const tbody = document.createElement('tbody').set({
			append: this.tradesOnly()
				.sort((a, b) => {
				  return  a.date - b.date;
				})
				.map(row => {
					return row.render()
				})
		});

		const tfoot = document.createElement('tfoot').set({
			append: [
				document.createElement('tr').set({
					append:this.head.map((a) => {
						return document.createElement('td')
					})
				}),
				document.createElement('tr').set({
					append: document.createElement('td').set({
						colSpan: this.head.length,
						text: "* Tagespreis von Coinbase"
					})
				})]
		});

		const table = document.createElement('table').set({
			id: "table",
			append: [thead, tfoot, tbody]
		});

		const body = document.getElementsByTagName("body")[0];
		const tableElem = document.getElementById('table');
		if (tableElem) {
			body.removeChild(tableElem);
		} 

		body.appendChild(table);
	};

	Report.prototype.calc = function() {
		var rslt = this.transactions.filter((t) => {
			return t.isTrade();
		}).reduce((acc, t) => {
			if(!acc[t.in_cur]) acc[t.in_cur] = { purchases: [], sales: [] };
			if(!acc[t.out_cur]) acc[t.out_cur] = { purchases: [], sales: [] };

			acc[t.in_cur].purchases.push(t);
			if (t.out_cur != "EUR") {
				acc[t.out_cur].sales.push(t);
			}

			return acc;
		}, {});

		const listing = new Listing(rslt);

		this.updateFooter();

		console.log(rslt);

	};

	Report.prototype.totalProfit = function () {
		return this.transactions.reduce((r, t) => {
			return r + t.profit;
		}, 0).toFixed(2);
	}

	Report.prototype.totalTaxable = function () {
		return this.transactions.reduce((r, t) => {
			return r + t.taxable;
		}, 0).toFixed(2);
	}

	Report.prototype.totalTaxResult = function () {
		return this.transactions.reduce((r, t) => {
			return r + t.taxResult;
		}, 0).toFixed(2);
	}

	Report.prototype.updateFooter = function () {
		const table = document.getElementById('table');
		const tfoot = table.querySelector('tfoot tr');

		const profitIndex = this.head.indexOf("Profit");
		const taxableIndex = this.head.indexOf('Taxable');
		const taxResultIndex = this.head.indexOf('TaxResult');

		tfoot.children[profitIndex].innerHTML = this.totalProfit();
		tfoot.children[taxableIndex].innerHTML = this.totalTaxable();
		tfoot.children[taxResultIndex].innerHTML = this.totalTaxResult();
	};

	Report.prototype.toCSV = function () {
		return this.head.join(";") + "\n" + this.tradesOnly().sort((a,b) => {
			return a.date - b.date;
		}).map((t) => {
			return t.toCSV();
		}).join('') + ";;;;;;;" + this.totalProfit() + ";;" + this.totalTaxable() + ";" + this.totalTaxResult() + "\n" + "* Berechnet am Tagespreis des BTC/ETH von coinbase.com";
	};

	return Report;

})();