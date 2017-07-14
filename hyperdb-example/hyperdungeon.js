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
                    console.log(location, player.pos)
                    // update target's location
                    update(target + "/pos", JSON.stringify(location))
                    break
                case "whereis":
                    // syntax: whereis <id|alias>
                    // get id if alias was used
                    if (input in player.aliases) { input = player.aliases[input] }
                    get(input + "/pos").then(function(pos) {
                        if (pos) {
                            console.log("%s is at %s", input, pos)
                        } else {
                            console.log("%s appears to be lost in the void..", input)
                        }
                        readCommand(player)
                    })
                    return
                case "alias":
                    // syntax: alias <nick>=<id>
                    [alias, friendId] = input.split("=")
                    player.aliases[alias] = friendId
                    console.log("%s is now known as %s", friendId, alias)
                    update(id + "/aliases", JSON.stringify(player.aliases))
                    break
                case "whoami":
                    get(id + "/pos").then(function(pos) {
                        player.pos = JSON.parse(pos) // update local pos in case we have been warped
                        console.log("you are " + id)
                        console.log("your position is currently %j", pos)
                    })
                    break
                case "aliases":
                    console.log("%j", player.aliases)
                    break
                case "look":
                    get(id + "/pos").then(function(pos) {
                        player.pos = JSON.parse(pos) // update local pos in case we have been warped
                        console.log("your position is currently %s", pos)
                        get(pos + "/description").then(function(description) {
                            if (!description) {
                                description = "you're surrounded by the rock walls you've known since birth"
                            }
                            console.log(description) 
                            readCommand(player)
                        })
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
            update(id + "/pos", JSON.stringify(player.pos))
        })
    }

    // fetch local player's position from hyperdb
    get(id).then(function(position) {
        position = JSON.parse(position)
        if (!position) {
            // new player, place them at the center
            position = {x: 0, y: 0}
            console.log("new player")
        }

        // fetch aliases
        get(id + "/aliases").then(function(aliases) {
            console.log(aliases)
            if (!aliases) {
                readCommand({pos: position, aliases: {}})
            } else {
                readCommand({pos: position, aliases: JSON.parse(aliases)})
            }
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
