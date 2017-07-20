var hypercore = require("hypercore")
// allows you to find other hyper* peers
var hyperdiscovery = require("hyperdiscovery")
// allows you to write to memory as if you are writing to a file
var ram = require("random-access-memory")

var remote = process.argv[2] || "003afb49a31f4f6a7a487c1439ce2bc3eedc622450f602ef783d37051770251f"
// we pass the ram as storage to skip creating (and consequently clean up after) lots of folders
var feed = hypercore(ram, remote, {valueEncoding: "json"})

var swarm
feed.on("ready", function() {
    console.log(feed.key.toString("hex"))
    // we need to join the swarm to be able to find other peers
    swarm = hyperdiscovery(feed, {live: true})

    // triggered when a peer connects
    swarm.on("connection", function(peer, type) {
        console.log("i had a connection")
        console.log(peer.id.toString("hex"))
        console.log(peer.remoteId.toString("hex"))
    })
})

// create a readStream so that we can log all of the data we get from the peers we connect with
var stream = feed.createReadStream({start: 0, live: true})
stream.on("data", function(data) {
    console.log("data", data)
})

