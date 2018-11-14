var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();

var url = "https://www.lawsoc.co.za/default.asp?id=1094";
function initDatabase(callback) {
	var db = new sqlite3.Database("data.sqlite");
	db.serialize(function() {
		db.run("CREATE TABLE IF NOT EXISTS data (title TEXT, initials TEXT, surname TEXT, firmname TEXT)");
		callback(db);
	});
}

function updateRow(db, values) {
	var statement = db.prepare("INSERT INTO data VALUES (?, ?, ?, ?)");
	statement.run(values.title, values.initials, values.surname, values.firmname);
	statement.finalize();
}

function readRows(db) {
	db.each("SELECT rowid AS id, title, initials, surname, firmname FROM data", function(err, row) {
		console.log(row.id + ": " + row.title + " " + row.initials + " " + row.surname + "(" + row.firmname + ")");
	});
}

function fetchPage(url, page, callback) {

    var headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
        'Content-Type' : 'application/x-www-form-urlencoded'
    };
    var form = {
        "a_type" : 1, "firm" : "", "name" : "",
        "town" : "", "spec" : "", "search" : 1,
        "paging" : page
    }
    request.post({url : url, form : form, headers : headers}, function(error, response, body) {
		if (error) {
			console.log("Error requesting page: " + error);
			return;
		}

		callback(body);
	});
}

function run(db) {
    var pages = [1];
    var seenPages = new Set();
    var keepLooping = true;

    var isPaginationLink = function(element) {
        return element.find("span").length > 0;
    }

    var pageIndex = function(element) {
        return element.find("span").text().split("-")[0].split("[ ")[1].trim();
    }

    var processPage = function(body) {
        var $ = cheerio.load(body);

        $('form[name="searchform3"] tr').each(function(index, element) {
            if (isPaginationLink($(element))) {
                pages.push(pageIndex($(element)));
            } else {
                updateRow(db, {
                    "title" : $(element.children[1]).text().trim(),
                    "initials" : $(element.children[3]).text().trim(),
                    "surname" : $(element.children[5]).text().trim(),
                    "firmname" : $(element.children[7]).text().trim()
                });
            }
        })
    }


    async function scrape() {
        while (pages.length > 0) {
            var page = pages.pop();

            if (seenPages.has(page))
                continue;

            console.log("Loading: " + page);

            p = await new Promise(resolve => {
                fetchPage(url, page, function(body) {
                    processPage(body)
                    resolve("resolved");
                });
            })

            seenPages.add(page);
        }
        db.close();
    }
    scrape();

    readRows(db);
}

initDatabase(run);
