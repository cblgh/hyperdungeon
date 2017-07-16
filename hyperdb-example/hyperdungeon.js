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

function printHelp() {
    console.log("directions: north, south, east, west")
    console.log("commands: look, whereis <nick|id>, alias <nick>=<id>, describe <description>, exit, warp <id|nick>=x,y")
}

// keep track of which player ids have entered the mud 
function savePlayers(playerId, state) {
    get("players", function(players) {
        if (!players) { players = {} }
        players[playerId] = state
        update("players", players)
    })
}

function split(input) {
    input = input.split(" ")
    var command = input.splice(0, 1)[0] // splice out the first command part
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

    // test getState to see if Promise.all(...).then() returns the player object as a promise with resolve(player) would
    function getState(playerId) {
        console.log("get state")
        console.log("playerId", playerId)
        var getPos = get(playerId + "/pos")
        var getAlias = get(playerId + "/aliases")
        return Promise.all([getPos, getAlias]).then(function(values) {
            console.log(values)
            var pos = values[0] || {x: 0, y: 0}
            var aliases = values[1] || {}
            return {id: playerId, pos: pos, aliases: aliases}
        })
    }

    var readCommand = function() {
        console.log("OK READ COMMAND")
        rl.question("> ", function(reply) {
            var command, input
            [command, input] = split(reply)
            
            // replace movement verbs with direction
            switch (command) {
                case "go":
                case "move":
                case "walk":
                case "tunnel":
                case "crawl":
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
                        update(player.id + "/pos", player.pos)
                        break
                    case "s":
                    case "south":
                        console.log("you move south")
                        player.pos.y -= 1
                        update(player.id + "/pos", player.pos)
                        break
                    case "e":
                    case "east":
                        console.log("you move east")
                        player.pos.x += 1
                        update(player.id + "/pos", player.pos)
                        break
                    case "w":
                    case "west":
                        console.log("you move west")
                        player.pos.x -= 1
                        update(player.id + "/pos", player.pos)
                        break
                    case "help":
                        printHelp()
                        break
                    case "write":
                        // syntax: write <alias|id> msg
                        var recipient, msg
                        input = input.split(" ")
                        recipient = input.splice(0, 1)
                        // remap if an alias used and it exists
                        if (recipient in player.aliases) { recipient = player.aliases[recipient] }
                        msg = input.join(" ")
                        console.log("to:", recipient, "msg:", msg)
                        msg = {msg: msg, sender: player.id}
                        return append(recipient + "/messages", msg).then(function() {
                            console.log("write: finished the append business")
                            return player
                        })
                        break
                    case "messages":
                        return get(player.id + "/messages").then(function(msgs) {
                            msgs.forEach(function(msg) { 
                                var sender = msg.sender;
                                // reverse lookup in our aliases for a nickname of the sender
                                for (key in player.aliases) { 
                                    if (player.aliases[key] === sender) {
                                        sender = key
                                        break
                                    }
                                }
                                console.log(sender + ":", msg.msg) })
                            return player
                        })
                    case "warp":
                        // syntax: warp <nick|id>=<x,y
                        var x, y, target, location
                        input = input.split("=")
                        target = input[0]
                        // remap if an alias used and it exists
                        if (target in player.aliases) { target = player.aliases[target] }
                        // get the location
                        location = input[1].split(",")
                        location = {x: parseInt(location[0]), y: parseInt(location[1])}
                        console.log("warping %s to %j", target, location)
                        // update target's location
                        update(target + "/pos", location)
                        break
                    case "whereis":
                        // syntax: whereis <id|alias>
                        var target = input
                        // get id if alias was used
                        if (target in player.aliases) { target = player.aliases[target] }
                        return get(target + "/pos").then(function(pos) {
                            if (pos) {
                                console.log("%s is at %j", target, pos)
                            } else {
                                console.log("%s appears to be lost in the void..", target)
                            }
                            return player
                        })
                        break
                    case "alias":
                        // syntax: alias <nick>=<id>
                        [alias, friendId] = input.split("=")
                        player.aliases[alias] = friendId
                        console.log("%s is now known as %s", friendId, alias)
                        update(player.id + "/aliases", player.aliases)
                        break
                    case "whoami":
                        console.log("you are " + player.id)
                        console.log("your position is currently %j", player.pos)
                        break
                    case "aliases":
                        console.log("%j", player.aliases)
                        break
                    case "look":
                        console.log("your position is currently %j", player.pos)
                        return get(player.pos.x + "," + player.pos.y + "/description").then(function(description) {
                            if (!description) {
                                description = "you're surrounded by the rock walls you've known since birth"
                            }
                            console.log(description) 
                            return player
                        })
                        break
                    case "describe":
                        return update(player.pos.x + "," + player.pos.y + "/description", input).then(function() {
                            console.log("your description will be remembered..")
                        }).then(function() {
                            return get(player.pos.x + "," + player.pos.y + "/description")
                        }).then(function(descr) {
                            console.log("actually it was", descr)
                            return player
                        })
                        break
                    case "quit":
                    case "exit":
                        console.log("Closing...")
                        sw.destroy()
                        process.exit()
                    default:
                        console.log("didn't recognize " + reply)
                }
                return player
            }).then(function() {
                readCommand()
            })
        })
    }

    // start reading input from the player
    readCommand()
})

function append(key, val) {
    console.log(append)
    return get(key).then(function(arr) {
        if (!arr) { arr = [] }
        console.log("append.get")
        arr.push(val)
        return arr
    }).then(function(arr) {
        console.log("append.update")
        return update(key, arr)
    })
}

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
    // console.log("1: GETTING KEY", key)
    return new Promise(function(resolve, reject) {
        db.get(key, function(err, nodes) {
            // console.log("GETTING KEY", key)
            if (err) { 
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
