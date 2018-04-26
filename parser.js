String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) != -1;
};

String.prototype.startsWith = function(prefix) {
    return this.indexOf(prefix, 0) !== -1;
};

String.prototype.replaceAll = function (find, replace) {
    return this.replace(new RegExp(find, 'g'), replace);
}

Date.prototype.yyyymmdd = function() {
    var yyyy = this.getFullYear();
    var mm = this.getMonth() < 9 ? "0" + (this.getMonth() + 1) : (this.getMonth() + 1); // getMonth() is zero-based
    var dd  = this.getDate() < 10 ? "0" + this.getDate() : this.getDate();
    return yyyy + "-" + mm + "-" + dd;
};

Number.prototype.positive = function() {
    if (this < 0) {
      return this * -1;
    } else {
      return this;
    }
}

function parseCSV(content) {

  const manuellHeader = /DATE,IN_QTY,IN_CUR,OUT_QTY,OUT_CUR,VALUE_IN_EUR,EXCHANGE,NOTES/;
  const coinbaseTaxHeader = /Timestamp,Transaction Type,Asset,Quantity Transacted,EUR Spot Price at Transaction,EUR Amount Transacted \(Inclusive of Coinbase Fees\),Address,Notes/;
  const bitcoinDeHeader = /Datum;Typ;W\u00e4hrungen;Referenz;Kurs;"BTC vor Geb\u00fchr";"EUR vor Geb\u00fchr";"BTC nach Bitcoin.de-Geb\u00fchr";"EUR nach Bitcoin.de-Geb\u00fchr";"Zu- \/ Abgang";Kontostand/;
  const bittrexHeader = /OrderUuid,Exchange,Type,Quantity,Limit,CommissionPaid,Price,Opened,Closed/;
  const binanceHeader = /Date,Paar,Typ,Seite,Avg,Preis,Filled,Betrag,Total,Trigger Conditions,Status,Operation/;

  if(content.match(manuellHeader)) {
    const csv = arrayCSV(content, "\n", ",")
    return parseManual(csv);
  } else if (content.match(coinbaseTaxHeader)) {
    const csv = arrayCSV(content, "\n", ",");
    return parseCoinbaseTaxTransactionsReport(csv);
  } else if (content.match(bitcoinDeHeader)) {
    const csv = arrayCSV(content, "\n", ";");
    return parseBitcoinDe(csv);
  } else if (content.match(bittrexHeader)) {
    const csv = arrayCSV(content, "\n", ",");
    return parseBittrex(csv);
  } else if (content.match(binanceHeader)) {
    const csv = arrayCSV(content, "\n", ",");
    return parseBinance(csv);
  }
}

function arrayCSV(content, splitRows, splitCols) {

  const clean = cleanCSV(content);

  const rows = clean.split(splitRows);

  return rows.map(row => {
      return  row.split(splitCols);
    });
}

// there are some \n in cols so we have to remove it to split rows reliably
function cleanCSV(csv) {
  var openQuote = false;

  return csv.split("").map(c => {
    // if we find a \n and we have an open quotation mark already replace the \n
    if (c == "\n" && openQuote) {
      return "\\n";
    }
    if (c == "," && openQuote) {
      return " ";
    }
    if(c == "\"") {
      openQuote = !openQuote;
    }

    return c;
  }).join("");
}

function mapRows(csv, startRow, endRow, func) {
  return csv.splice(startRow, endRow).map(func);
}

function parseCoinbaseTaxTransactionsReport(csv) {
  return mapRows(csv, 4, csv.length-5, row => {
    return new Transaction({
      date: new Date(row[0]),
      type: row[1].match(/(Buy|Sell)/) ? "TRADE" : (row[1] === "Send" ? "OUT" : "IN"),
      in_qty: row[1].match(/Sell/) ? row[5] : (row[1].match(/(Receive|Buy)/) ? row[3] : ""),
      in_cur: row[1].match(/Sell/) ? "EUR"  : (row[1].match(/(Receive|Buy)/) ? row[2] : ""),
      out_qty: row[1].match(/(Sell|Send)/) ? row[3] : (row[1].match(/Buy/) ? row[5] : ""),
      out_cur: row[1].match(/(Sell|Send)/) ? row[2] : (row[1].match(/Buy/) ? "EUR" : ""),
      amount_in_eur: row[5],
      exchange: "coinbase.com",
      notes: row[7]
    });
  });
}

function parseBitcoinDe(csv) {
  return mapRows(csv, 2, csv.length-3, row => {
    const amount = parseFloat(row[9]);
    const currencies = row[2].replaceAll("\"", "").split(" ");
    const type = row[1] == "Kauf" ? "TRADE" : (row[1] == "Auszahlung" ? "OUT" : "IN");

    return new Transaction({
      date: new Date(row[0].replaceAll("\"", "")),
      type: type,
      in_qty: amount >= 0 ? amount : "",
      in_cur: amount >= 0 ? currencies[0] : "",
      out_qty: type === "OUT" ? amount.positive() : (type === "IN" ? "" : row[6]),
      out_cur: type === "OUT" ? row[2] : (type === "IN" ? "" : currencies[currencies.length-1]),
      amount_in_eur: row[6],
      exchange: "bitcoin.de",
      notes: ""
    });
  });
}

function parseBittrex(csv) {
  return mapRows(csv, 1, csv.length-2, row => {

    const isSell = row[2].endsWith("SELL");

    return new Transaction({
      date: new Date(row[8]),
      type: "TRADE",
      in_qty: isSell ? row[6] : row[3],
      in_cur: row[1].split("-")[isSell ? 0 : 1],
      out_qty: isSell ? row[3] : row[6],
      out_cur: row[1].split("-")[isSell ? 1 : 0],
      amount_in_eur: null,
      exchange: "bittrex.com",
      notes: ""
    });;
  });
}

function parseBinance(csv) {
  return mapRows(csv, 1, csv.length-2, row => {
    
    const isBuy = row[3] === "Kaufen";

    return new Transaction({
      date: new Date(row[0]),
      type: "TRADE",
      in_qty: isBuy ? row[6] : row[8].split(" ")[0],
      in_cur: isBuy ? row[1].split("/")[0] : row[1].split("/")[1],
      out_qty: isBuy ? row[8].split(" ")[0] : row[6],
      out_cur: isBuy ? row[1].split("/")[1] : row[1].split("/")[0],
      amount_in_eur: null,
      exchange: "binance.com",
      notes: ""
    });
  });
}

function parseManual(csv) {
  return mapRows(csv, 1, csv.length, row => {
      return new Transaction({
        date: new Date(row[0]),
        type: row[1],
        in_qty: row[2],
        in_cur: row[3],
        out_qty: row[4],
        out_cur: row[5],
        amount_in_eur: row[6],
        exchange: row[7],
        notes: row[8]
      });
  });
}












