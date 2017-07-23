var peernet = require("peer-network")
var network = peernet()
var server = network.createServer()
var Readable = require("stream").Readable

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
            }
            var readStream = new Readable()
            readStream.push(JSON.stringify(feeds))
            readStream.push(null) // signals end of the read stream
            readStream.pipe(stream) // reply
        })
    })
    // stream.write("hello i am " + local.key.toString("hex"))
    // stream.on("data", function (data) {
        // console.log("data:", data.toString())
    //     db.ready(hyperdungeon)
    // })

    // if that fails then we're the only alive peer, so we create a server and listen on it so that
    // others have somewhere to connect to
}
var feeds =  [
    "5c73d8199d83875b62b19b28893b374189e439e760dc070497cfbd643bfb8fbe",  // wintermute
     "7cfc122d7ce9e73d8324f49cb0ab4cd4a92e708e87757102b06d0ed757f7d4aa" // clone client 
]
module.exports.feeds = feeds
connect("hyperdungeon")
