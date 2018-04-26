const Transaction = (function () { 

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

  Date.prototype.ddmmyyyyhhmmss = function() {
      var yyyy = this.getFullYear();
      var mm = this.getMonth() < 9 ? "0" + (this.getMonth() + 1) : (this.getMonth() + 1); // getMonth() is zero-based
      var dd  = this.getDate() < 10 ? "0" + this.getDate() : this.getDate();
      var hh = this.getHours() < 10 ? "0" + this.getHours() : this.getHours();
      var min = this.getMinutes() < 10 ? "0" + this.getMinutes() : this.getMinutes();
      var ss = this.getSeconds() < 10 ? "0" + this.getSeconds() : this.getSeconds();
      return dd + "." + mm + "." + yyyy + " " + hh + ":" + min + ":" + ss;
  };

  class Transaction {

    constructor(obj) {
      try {
        this.id = this.guid();
        this.date = obj.date;
        this.type = obj.type;
        this.in_qty = obj.in_qty;
        this.in_cur = obj.in_cur;
        this.out_qty = obj.out_qty;
        this.out_cur = obj.out_cur;
        this.claimed = 0;
        this.sales = [];
        this.amount_in_eur = parseFloat(obj.amount_in_eur);
        this.exchange = obj.exchange;
        this.notes = obj.notes;
        this.profit = 0;
        this.taxable = 0;
        this.taxResult = 0;
      } catch (e) {
        console.log("could not create object", e);
      }
    };
  }

  Transaction.prototype.guid = function () {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  Transaction.prototype.elem = function () {
    return document.getElementById(this.id);
  }

  Transaction.prototype.eurValueElem = function () {
    return this.elem().children[5];
  }

  Transaction.prototype.profitElem = function () {
    return this.elem().children[7];
  }

  Transaction.prototype.taxDescElem = function () {
    return this.elem().children[8];
  }

  Transaction.prototype.taxableElem = function () {
    return this.elem().children[9];
  }

  Transaction.prototype.taxResultElem = function () {
    return this.elem().children[10];
  }

  Transaction.prototype.updateRenderedEurValue = function () {
    const elem = this.eurValueElem();
    if (elem) {
        elem.innerHTML = this.amount_in_eur.toFixed(2) + " *";
    }
  }

  Transaction.prototype.updateRenderedProfit = function () {
    const elem = this.profitElem();
    if (elem) {
        elem.innerHTML = this.profit.toFixed(2);
    }
  }

  Transaction.prototype.updateRenderedTaxable = function () {
    const elem = this.taxableElem();
    if (elem) {
        elem.innerHTML = this.taxable.toFixed(2);
    }
  }

  Transaction.prototype.updateRenderedTaxResult = function () {
    const elem = this.taxResultElem();
    if (elem) {
        elem.innerHTML = this.taxResult.toFixed(2);
    }
  }

  Transaction.prototype.updateRenderedTaxDesc = function () {
    const elem = this.taxDescElem();
    if (elem && this.sales.length > 0) {
        elem.innerHTML = "";
        elem.set({ append: document.createElement('ul').set({ append: this.renderSaleHistory() }) });
    }
  }

  Transaction.prototype.update = function () {
    this.updateRenderedEurValue();
    this.updateRenderedProfit();
    this.updateRenderedTaxDesc();
    this.updateRenderedTaxable();
    this.updateRenderedTaxResult();
  };

  Transaction.prototype.renderSaleHistory = function () {
    return this.sales.map((sale) => {
      return document.createElement('li').set({
        text: sale.toText()
      });
    });
  }

  Transaction.prototype.render = function (parentElement, childElement) {
    if (!parentElement) parentElement = 'tr';
    if (!childElement) childElement = 'td';

    return document.createElement(parentElement).set({
      id: this.id,
      append: [
        document.createElement(childElement).set({ text: this.date.ddmmyyyyhhmmss() }),
        document.createElement(childElement).set({ text: this.in_qty }),
        document.createElement(childElement).set({ text: this.in_cur }),
        document.createElement(childElement).set({ text: this.out_qty }),
        document.createElement(childElement).set({ text: this.out_cur }),
        document.createElement(childElement).set({ text: this.amount_in_eur }),
        document.createElement(childElement).set({ text: this.exchange }),
        document.createElement(childElement).set({ text: this.profit }),
        document.createElement(childElement).set({ 
          append: document.createElement('ul').set({ append: this.renderSaleHistory() })
        }),
        document.createElement(childElement).set({ text: this.taxable }),
        document.createElement(childElement).set({ text: this.taxResult })]
      });  
  };

  Transaction.prototype.toCSV = function () {
    return[ this.date.ddmmyyyyhhmmss(), 
            this.in_qty,
            this.in_cur,
            this.out_qty,
            this.out_cur,
            (this.amount_in_eur + ((this.in_cur + this.out_cur).match(/EUR/) ? "" : " *")),
            this.exchange,
            this.profit.toFixed(2),
            "\"" + this.sales.map((s) => { return s.toText() }).join("\r") + "\"",
            this.taxable.toFixed(2),
            this.taxResult.toFixed(2 )].join(";") + "\n";
  };

  Transaction.prototype.toFiatSymbol = function () {
    return (this.in_cur + this.out_cur).match(/ETH/) ? "ETH" : 
           (this.in_cur + this.out_cur).match(/BTC/) ? "BTC" : 
           null;
  }

  Transaction.prototype.isFiatTransaction = function () {
    return (this.in_cur + this.out_cur).match(/EUR/);
  }

  Transaction.prototype.isTrade = function() {
    return this.type === "TRADE";
  };

  return Transaction;
})();
 