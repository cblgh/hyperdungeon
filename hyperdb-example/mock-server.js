var peernet = require("peer-network")
var network = peernet()
var server = network.createServer()
var Readable = require("stream").Readable
var fs = require("fs")

function connect(name) {
    console.log("starting server at " + name + "..")

    server.listen("hyperdungeon") // listen on a name
    server.on("listening", function() {
        console.log("ready for connections")
    })

    // when someone connects, we receive their feed key. if they are joining for the first time we add them to the end of
    // the feed list and then pass them the entire list
    // they then use that list to propagate their hyperdb instance 
    server.on("connection", function (stream) {
        console.log("new connection")
        stream.on("data", function (data) {
            console.log("received:", data.toString())
            var peerKey = data.toString()
            if (feeds.indexOf(peerKey) < 0) { // new peer connected, add them to our feeds
                feeds.push(peerKey)
                console.log(feeds)
                fs.writeFile("./feeds.json", JSON.stringify(feeds), function(err) {
                    if (err) { console.log(err) }
                })
            }
            var readStream = new Readable()
            readStream.push(JSON.stringify(feeds))
            readStream.push(null) // signals end of the read stream
            readStream.pipe(stream) // reply
        })
    })
}

var feeds = []
function start(name, key) {
    return new Promise(function(resolve, reject) {
        fs.readFile("./feeds.json", function(err, data) {
            if (!err) {
                feeds = JSON.parse(data)
            } else {
                feeds.push(key) // add the first key i.e. our key to feeds
            }
            resolve(feeds)
            connect(name)
        })
    })
}
module.exports = start
