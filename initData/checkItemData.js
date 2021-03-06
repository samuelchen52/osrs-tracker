require('dotenv').config();


//checks all items for any missing fields (that osrxbox failed to provide) and fills them by pulling them from the wiki
var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var invalid = require("./models/invalid.js");

var mongoose = require("mongoose");
var request = require("request");

var jsdom = require("jsdom");
const { JSDOM } = jsdom;

mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});



function checkFields(item)
{
	//returns if all fields are there
	return ((item.id === undefined || item.id === null)
	 || (item.members === undefined || item.members === null) 
	 || (item.description === undefined || item.description === null)
	 || (item.limit === undefined || item.limit === null)) ? false : true;
}

async function fetchAllDocuments(callback, criteria)
{
	//allitems will be the array being sorted that is 
	var allitems = [];
	criteria = criteria ? criteria : {};
	await new Promise (function (resolve, reject)
	{
		item.find(criteria, async function(err, alldocs) {
		if (err)
		{
			res.send("there was an error fetching all the documents!");
			process.exit();
		}
		else
		{
			allitems = alldocs;
			resolve();
		}
		});
	});
	callback(allitems);
}

async function checkItemData(callback)
{
	var allitems = null;
	await new Promise(function (resolve, reject)
	{
		//passes the promise object all the documents i.e. passes alldocs to the resolve function
		fetchAllDocuments(resolve, {invalid : false});
	}).then(function(alldocs){allitems = alldocs;});


	var wikiURL = "https://oldschool.runescape.wiki/w/Exchange:" // + itemName, spaces replaced with underscore
	
	//used to find data on the wiki page we pull
	var memberClass = "gemw-members";
	var limitClass = "gemw-limit"; //Buy limit<limit> .substring(9).split(",").join("")
	var idClass = "gemw-id"; //Item ID<id> .substring(7).split(",").join("")
	var descriptionClass = "gemw-examine";
	//there is also high alch and low alch, if ever needed

	var numMissing = 0;


	for (var i = 0; i < allitems.length; i ++)
	{
		if (!checkFields(allitems[i]))
		{
			var item = allitems[i];
			numMissing ++;
			await new Promise (function (resolve, reject)
			{
				request(wikiURL + item.name.split(" ").join("_"), function (error, response, body)
				{
					if (error)
					{
						console.log("failed to retrieve item data from wiki");
						process.exit();
					}
					else if (response.statusCode !== 200)
					{
						console.log("can't pull wiki item data for item with id of "  + item.id + "!");
						// invalid.findOne({name : item.name, id : item.id}, function (error, invalidItem)
						// {
						// 	if (error)
						// 	{
						// 		console.log("failed to find invalid document with id of " + item.id);
						// 		process.exit();
						// 	}
						// 	else if (!invalidItem)
						// 	{
						// 		invalid.create({name : item.name, id : item.id}, function (error, invalidItem)
						// 		{
						// 			if (error)
						// 			{
						// 				console.log("failed to create invalid document with id of " + item.id);
						// 				process.exit();
						// 			}
						// 		});
						// 	}
						// });
						item.invalid = true;
						item.save();
						resolve();
					}
					else
					{
						const dom = new JSDOM(body);

						let members = dom.window.document.querySelector("." + memberClass).textContent.substring(6);
						let limit = dom.window.document.querySelector("." + limitClass).textContent.substring(9).split(",").join("")
						limit = limit === "Unknown" ? -1 : limit;
						let id = dom.window.document.querySelector("." + idClass).textContent.substring(7).split(",").join("");
						let description = dom.window.document.querySelector("." + descriptionClass).textContent;

						item.members = (members === 'Members' ? true : false);
						item.limit = limit;
						item.id = item.id === undefined ? id : item.id;
						item.description = description;

						item.save();
						console.log("itemdata with id of " + item.id + " has been fetched from wiki");
						resolve(); 
					}
				});
			});
		}
	}

	allitems = null;
	console.log("itemdata for " + numMissing + " items have been fetched from the wiki!");
	if (typeof callback === "function")
	{
		callback();
	}
}

module.exports = checkItemData;