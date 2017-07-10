var hyperdb = require("hyperdb")
var hypercore = require("hypercore")
var hyperdiscovery = require("hyperdiscovery")
var pages = require("random-access-page-files")
var raf = require("random-access-file")
var ram = require("random-access-memory")
var readline = require("readline")

var st = process.argv.indexOf("--storage") > -1 ? storage : ram

var local = hypercore("./dungeon-dir", {valueEncoding: "json", sparse: true})
var db = hyperdb([
    // st <- <dat:hash>: put what you sync from <dat:hash> into the storage st
    // hypercore(st, "48e2619899edb24f4d5031b5e0cf16e6caef0cc20710c8c60783428f4e8d2ef3", {valueEncoding: "json", sparse: true}), // mafintosh
    // hypercore(st, "5c73d8199d83875b62b19b28893b374189e439e760dc070497cfbd643bfb8fbe", {valueEncoding: "json", sparse: true}), // wintermute
    hypercore(st, "d5d0b189af6b981ab7942c3d71103e9a1cbfa32e203220e830b7a16deac6cc43", {valueEncoding: "json", sparse: true}), // macbook
    local
])

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

var direction = process.argv[2] || "north"

function printHelp() {
    console.log("directions: north, south, east, west")
    console.log("commands: look, whereis <nick|id>, alias <nick>=<id>, describe <description>, exit")
}

function split(input) {
    input = input.split(" ")
    var command = input.splice(0, 1)[0] // splice out the command 
    return [command, input.join(" ")] // and keep the rest of the string
}

db.ready(function () {
    var id = local.key.toString("hex")
    console.log("local key", id)

    var sw = hyperdiscovery(db, {live: true})
    if (process.argv.indexOf("--sync") > -1) {
        db.feeds[0].download({start: 0, end: -1})
        return
    }

    sw.on("connection", function(peer, type) {
        console.log("a new peer has joined, zarathystras's forces grow stronger (" + peer.key.toString("hex") + ")")
        peer.on("close", function() {
            console.log("a peer has left, zarathystras's forces grow weaker (" + peer.key.toString("hex") + ")")
        })
    })


    var readCommand = function(player) {
        rl.question("> ", function(reply) {
            var command, input
            [command, input] = split(reply)
            
            // replace movement verbs with direction
            switch (command) {
                case "go":
                case "move":
                case "ambulate":
                    command = input
            }
            
            // handle commands
            switch (command) {
                case "n":
                case "north": 
                    console.log("you move north")
                    player.pos.y += 1
                    break
                case "s":
                case "south":
                    console.log("you move south")
                    player.pos.y -= 1
                    break
                case "e":
                case "east":
                    console.log("you move east")
                    player.pos.x += 1
                    break
                case "w":
                case "west":
                    console.log("you move west")
                    player.pos.x -= 1
                    break
                case "help":
                    printHelp()
                    break
                case "whereis":
                    if (input in player.aliases) { input = player.aliases[input] }
                    get(input).then(function(pos) {
                        if (!pos) {
                            console.log("%s appears to be lost in the void..", input)
                        } else {
                            console.log("%s is at %s", input, pos)
                        }
                        readCommand(player);
                    })
                    return
                case "alias":
                    [alias, friendId] = input.split("=")
                    player.aliases[alias] = friendId
                    console.log("%s is now known as %s", friendId, alias)
                    update("aliases", JSON.stringify(player.aliases))
                    break
                case "look":
                    get(id).then(function(pos) {
                        console.log("your position is currently %s", pos)
                        get(pos + "/description").then(function(description) {
                            if (description) console.log(description);
                            console.log(player)
                            readCommand(player)
                        }).catch(function() {
                            console.log("you're surrounded by the rock walls you've known since birth")
                            readCommand(player)
                        });
                    })
                    return
                case "describe":
                    get(id).then(function(pos) {
                        update(pos + "/description", input).then(function() {
                            console.log("your description will be remembered..")
                            readCommand(player)
                        })
                    })
                    return
                case "quit":
                case "exit":
                    console.log("Closing...")
                    sw.destroy()
                    process.exit()
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

        // fetch aliases
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
                // console.log("err")
                // console.log(err) 
                reject();
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
