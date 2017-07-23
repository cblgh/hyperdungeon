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
fs.readFile("./feeds.json", function(err, data) {
    if (!err) {
        feeds = JSON.parse(data)
    }
    connect("hyperdungeon")
})
module.exports.feeds = feeds
