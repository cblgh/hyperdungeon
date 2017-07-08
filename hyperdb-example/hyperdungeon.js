var hyperdb = require("hyperdb")
var hypercore = require("hypercore")
var hyperdiscovery = require("hyperdiscovery")
var pages = require("random-access-page-files")
var raf = require("random-access-file")
var ram = require("random-access-memory")
var readline = require("readline")

var st = process.argv.indexOf("--storage") > -1 ? storage : ram
var optimized = process.argv.indexOf("--optimized") > -1

var local = hypercore("./dungeon-dir", {valueEncoding: "json", sparse: true})
var db = hyperdb([
    // st <- <dat:hash>: put what you sync from <dat:hash> into the storage st
    // hypercore(st, "48e2619899edb24f4d5031b5e0cf16e6caef0cc20710c8c60783428f4e8d2ef3", {valueEncoding: "json", sparse: true}), // mafintosh
    // hypercore(st, "cd1034cedfe2dccdd225a96abcf0a5576158426ddd6078c2f89aa352da77115d", {valueEncoding: "json", sparse: true}), // wintermute
    hypercore(st, "d5d0b189af6b981ab7942c3d71103e9a1cbfa32e203220e830b7a16deac6cc43", {valueEncoding: "json", sparse: true}), // macbook
    local
])

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

var direction = process.argv[2] || "north"

db.ready(function () {
    var id = local.key.toString("hex")
    console.log("local key", id)

    var sw = hyperdiscovery(db, {live: true})

    if (process.argv.indexOf("--sync") > -1) {
        db.feeds[0].download({start: 0, end: -1})
        return
    }

    sw.on("connection", function(peer, type) {
        console.log("we got a connection")
    })

    var readCommand = function(player) {
        rl.question("> ", function(reply) {
            [reply, info] = reply.split(" ")
            switch (reply) {
                case "north": 
                    player.pos.y += 1
                    break
                case "south":
                    player.pos.y -= 1
                    break
                case "east":
                    player.pos.x += 1
                    break
                case "west":
                    player.pos.x -= 1
                    break
                case "whereis":
                    if (info in player.aliases) { info = player.aliases[info] }
                    get(info).then(function(pos) {
                        if (!pos) {
                            console.log("%s appears to be lost in the void..", info)
                        } else {
                            console.log("%s is at %j", info, pos)
                        }
                        readCommand(player);
                    })
                    return
                case "alias":
                    [friendId, alias] = info.split("=")
                    player.aliases[alias] = friendId
                    console.log("%s is now known as %s", friendId, alias)
                    update("aliases", JSON.stringify(player.aliases))
                    break
                case "look":
                    get(id).then(function(pos) {
                        console.log("your position is currently %j", pos)
                        readCommand(player)
                    })
                    return
                case "exit":
                    console.log("Closing...")
                    sw.destroy()
                    return
                default:
                    console.log("didn't recognize " + reply)
            }
            readCommand(player)
            update(id, JSON.stringify(player.pos))
        })
    }

    // fetch local player's position from hyperdb
    get(id).then(function(position) {
        position = JSON.parse(position)
        if (!position) {
            // new player, place them at the center
            console.log("new player")
            position = {x: 0, y: 0}
        }
        get("aliases").then(function(aliases) {
            if (!aliases) { console.log("oops"); aliases = JSON.stringify({}) }
            readCommand({pos: position, aliases: JSON.parse(aliases)})
        })
    })
})

function update(key, val) {
    return new Promise(function(resolve, reject) {
        db.put(key, val, function(err, nodes) {
            if (err) {
                console.log(err)
                reject(err)
            }
            resolve()
        })
    })
}

function get(key) {
    return new Promise(function(resolve, reject) {
        db.get(key, function(err, nodes) {
            if (err) { 
                console.log("err")
                console.log(err) 
                resolve(null)
            } else if (nodes && nodes[0]) {
                resolve(nodes[0].value)
            } else {
                resolve(null)
            }
        })
    })
}

function storage (name) {
    if (name === "data") return pages("dungeon.map/data")
    return raf("dungeon.map/" + name)
}

function noop () {}
