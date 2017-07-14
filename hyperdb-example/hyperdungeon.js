var hyperdb = require("hyperdb")
var hypercore = require("hypercore")
var hyperdiscovery = require("hyperdiscovery")
var readline = require("readline")
var config = require("./config.js")

var local = config.local
var db = hyperdb(config.feeds)

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

var direction = process.argv[2] || "north"

function printHelp() {
    console.log("directions: north, south, east, west")
    console.log("commands: look, whereis <nick|id>, alias <nick>=<id>, describe <description>, exit")
}

function savePlayers(playerId, state) {
    get("players", function(players) {
        if (!players) { players = JSON.stringify({}) }
        players = JSON.parse(players)
        players[playerId] = state
        update("players", JSON.stringify(players))
    })
}

function split(input) {
    input = input.split(" ")
    var command = input.splice(0, 1)[0] // splice out the command 
    return [command, input.join(" ")] // and keep the rest of the string
}

// i don't need to JSON.parse, JSON.stringify all the time do i?
// check out valueEncoding of hyperdb / ask mafintosh about it / check out his code for hyperdictionary
db.ready(function () {
    var id = local.key.toString("hex")
    console.log("local key", id)

    var sw = hyperdiscovery(db, {live: true})
    if (process.argv.indexOf("--sync") > -1) {
        db.feeds[0].download({start: 0, end: -1})
        return
    }

    sw.on("connection", function(peer, type) {
        var peerId = peer.key.toString("hex")
        console.log("a new peer has joined, zarathystras's forces grow stronger (" + peerId + ")")
        savePlayers(peerId, "connected")
        peer.on("close", function() {
            console.log("a peer has left, zarathystras's forces grow weaker (" + peerId + ")")
            savePlayers(peerId, "disconnected")
        })
    })

    function getState(playerId) {
        return new Promise(function(reject, resolve) {
            get(id + "/pos", function(pos) {
                if (!pos) { pos = JSON.stringify({x: 0, y: 0}) }
                return JSON.parse(pos)
            }).then(function(pos) {
                return get(id + "/aliases", function(aliases) {
                    if (!aliases) { aliases = JSON.stringify({}) }
                     resolve({id: id, pos: pos, aliases: JSON.parse(aliases)})
                })
            })
        })
    }

    // is this how promise chaining ought to be written? prod lykkin
    function saveState(player) {
        return new Promise(function(reject, resolve) {
            update(player.id + "/pos", player.pos)
            .then(function() {
                return update(player.id + "/aliases", player.aliases)
            }).then(function() {
                resolve()
            })
        })
    }

    var readCommand = function() {
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

            // get latest state information (useful in case of a warp by another player)
            getState(id)
            .then(function(player) {
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
                    case "warp":
                        // syntax: warp <nick|id>=<x,y
                        var x, y, target, location
                        input = input.split("=")
                        target = input[0]
                        // remap from alias if used and alias exists
                        if (target in player.aliases) { target = player.aliases[target] }
                        // get the location
                        location = input[1].split(",")
                        location = {x: parseInt(location[0]), y: parseInt(location[1])}
                        console.log("warping %s to %s", target, location)
                        // update target's location
                        update(target + "/pos", JSON.stringify(location))
                        break
                    case "whereis":
                        // syntax: whereis <id|alias>
                        var target = input
                        // get id if alias was used
                        if (target in player.aliases) { target = player.aliases[target] }
                        get(target + "/pos").then(function(pos) {
                            if (pos) {
                                console.log("%s is at %s", target, pos)
                            } else {
                                console.log("%s appears to be lost in the void..", target)
                            }
                            readCommand()
                        })
                        return
                    case "alias":
                        // syntax: alias <nick>=<id>
                        [alias, friendId] = input.split("=")
                        player.aliases[alias] = friendId
                        console.log("%s is now known as %s", friendId, alias)
                        break
                    case "whoami":
                        console.log("you are " + player.id)
                        console.log("your position is currently %j", player.pos)
                        break
                    case "aliases":
                        console.log("%j", player.aliases)
                        break
                    case "look":
                        console.log("your position is currently %s", player.pos)
                        get(player.pos + "/description").then(function(description) {
                            if (!description) {
                                description = "you're surrounded by the rock walls you've known since birth"
                            }
                            console.log(description) 
                            readCommand()
                        })
                        return
                    case "describe":
                        update(player.pos + "/description", input).then(function() {
                            console.log("your description will be remembered..")
                            readCommand()
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
                readCommand()
                // save state data to db
                saveState(player)
            })
        })
    }

    // start reading input from the player
    readCommand()
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
                // not found
                // console.log("err")
                // console.log(err) 
                resolve(null)
            } else if (nodes && nodes[0]) {
                resolve(nodes[0].value)
            } else {
                resolve(null)
            }
        })
    })
}

function noop () {}
