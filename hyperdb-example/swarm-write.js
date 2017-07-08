var hypercore = require("hypercore");
var hyperdiscovery = require("hyperdiscovery");

var feed = hypercore("./cores/swarmtest", {valueEncoding: "json"});

var phrase = process.argv[2] || "what is in a name?";
var swarm;
feed.on("ready", function() {
    console.log(feed.key.toString("hex"));
    swarm = hyperdiscovery(feed);
});
  
feed.append({item: phrase })
