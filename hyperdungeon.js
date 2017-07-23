var hyperdb = require("hyperdb")
var Readable = require("stream").Readable
var hyperdiscovery = require("hyperdiscovery")
var readline = require("readline")
var util = require("./util.js")
var mock = require("./mock-server.js")
// use peer-network to connect new peers to the distributed mud instance
var peernet  = require("peer-network")
var network = peernet()
var server = network.createServer()
var local = util.local
var db 

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// META TODO: somehow allow people to just get this entire codebase as a dat itself

function printHelp() {
    console.log("directions: north, south, east, west")
    console.log("commands: look, whereis <nick|id>, alias <nick>=<id>, describe <description>, exit, warp <id|nick>=x,y")
}

function split(input) {
    input = input.split(" ")
    var command = input.splice(0, 1)[0] // splice out the first command part
    return [command, input.join(" ")] // and keep the rest of the string
}

// before we do anything else, we try to connect to the peernet hyperdungeon server.
// if that fails, we create an instance ourselves
local.ready(function() {
    var localKey = local.key.toString("hex") 
    // try to connect to an existing server
    var stream = network.connect("hyperdungeon")
    stream.write(localKey) // tell server our id
    
    // if that fails, start a server
    stream.on("error", function() {
        console.log("no such server found")
        mock("hyperdungeon", localKey).then(function(feeds) {
            start(feeds)
        })
    })

    // server replies with a list all of the instances that have connected to hyperdb
    // (including our key)
    stream.on("data", function (data) { 
        var feeds = JSON.parse(data.toString())
        start(feeds)
    })

    function start(keys) {
        var feeds = util.join(keys, local.key.toString("hex"))
        db = hyperdb(feeds)
        db.ready(hyperdungeon)
    }
})

function hyperdungeon() {
    var id = local.key.toString("hex")
    console.log("local key", id)

    var sw = hyperdiscovery(db, {live: true})
    if (process.argv.indexOf("--sync") > -1) {
        db.feeds[0].download({start: 0, end: -1})
        return
    }

    sw.on("connection", function(peer, type) {
        var peerId = peer.key.toString("hex")
        console.log("a new peer has joined, zarathystras's forces grow stronger")
        peer.on("close", function() {
            console.log("a peer has left, zarathystras's forces grow weaker")
        })
    })

    function getState(playerId) {
        var getPos = get(playerId + "/pos")
        var getAlias = get(playerId + "/aliases")
        return Promise.all([getPos, getAlias]).then(function(values) {
            // console.log(values)
            var pos = values[0] || {x: 0, y: 0}
            var aliases = values[1] || {}
            return {id: playerId, pos: pos, aliases: aliases}
        })
    }

    function monitorMessages(channel) {
        var lastIndex = -1
        get(channel + "/messages").then(function(msgs) {
            msgs = msgs || []
            lastIndex = msgs.length - 1
            // check for new messages every second
            setInterval(function() {
                var getMessages = get(channel + "/messages")
                var getAliases = get(id + "/aliases") // aliases belongs to this user, thus id is used and not channel
                Promise.all([getMessages, getAliases]).then(function(values) {
                    var msgs, aliases
                    msgs = values[0] || []
                    aliases = values[1] || {}
                    // if we have a new message
                    if (msgs.length > lastIndex) {
                        // go through each new message
                        for (var i = lastIndex + 1; i < msgs.length; i++) {
                            // getting its contents & sender
                            var msg = msgs[i]
                            var sender = msg.sender
                            // reverse lookup in our aliases for a nickname of the sender
                            for (var key in aliases) { 
                                if (aliases[key] === sender) {
                                    sender = key
                                    break
                                }
                            }
                            // and printing it out
                            console.log(sender + ":", msg.msg)
                        }
                        lastIndex = msgs.length - 1
                    }
                })
            }, 1000)
        })
    }

    // monitor messages adress to ourself
    monitorMessages(id)
    // monitor global messages
    monitorMessages("global")

    var cursor = "> "
    var readCommand = function() {
        rl.question(cursor, function(reply) {
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
                    case "reply":
                        // syntax: reply <msg>
                        // reply to the latest received correspondent
                        return get(player.id + "/messages").then(function(msgs) {
                            return msgs[msgs.length - 1]
                        }).then(function(last) {
                            var msg = {sender: player.id, msg: input}
                            return append(last.sender + "/messages", msg)
                        }).then(function() {
                            return player
                        })
                    case "write":
                        // syntax: write <alias|id|global> msg
                        var recipient, msg
                        input = input.split(" ")
                        recipient = input.splice(0, 1)
                        // remap if an alias used and it exists
                        if (recipient in player.aliases) { recipient = player.aliases[recipient] }
                        msg = input.join(" ")
                        // console.log("to:", recipient, "msg:", msg)
                        msg = {msg: msg, sender: player.id}
                        return append(recipient + "/messages", msg).then(function() {
                            return player
                        })
                    case "messages":
                        return get(player.id + "/messages").then(function(msgs) {
                            msgs = msgs || []
                            msgs.forEach(function(msg) { 
                                var sender = msg.sender
                                // reverse lookup in our aliases for a nickname of the sender
                                for (var key in player.aliases) { 
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
                        var target, location
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
                    case "alias":
                        // syntax: alias <nick>=<id>
                        var alias, friendId
                        [alias, friendId] = input.split("=")
                        player.aliases[alias] = friendId
                        console.log("%s is now known as %s", friendId, alias)
                        update(player.id + "/aliases", player.aliases)
                        break
                    case "whoami":
                        var pos = player.pos.x + "," + player.pos.y
                        console.log("you are " + player.id)
                        console.log("your position is currently %s", pos)
                        break
                    case "aliases":
                        console.log("%j", player.aliases)
                        break
                    case "look":
                        var pos = player.pos.x + "," + player.pos.y 
                        console.log("your position is currently %s", pos)
                        return get(pos + "/description").then(function(description) {
                            if (!description) {
                                description = "you're surrounded by the rock walls you've known since birth"
                            }
                            console.log(description) 
                            return player
                        })
                    case "describe":
                        var pos = player.pos.x + "," + player.pos.y 
                        return update(pos + "/description", input).then(function() {
                            console.log("your description will be remembered..")
                            return player
                        })
                    case "quit":
                    case "exit":
                        console.log("Closing...")
                        sw.destroy()
                        process.exit()
                        break
                    default:
                        console.log("didn't recognize " + reply)
                }
                return player
            }).then(function(player) {
                cursor = player.pos.x + "," + player.pos.y + " > "
                readCommand()
            })
        })
    }

    // start reading input from the player
    get(id + "/pos").then(function(pos) {
        pos = pos || {x: 0, y: 0}
        cursor = pos.x + "," + pos.y + " > "
        readCommand()
    })
}

function append(key, val) {
    return get(key).then(function(arr) {
        if (!arr) { arr = [] }
        arr.push(val)
        return arr
    }).then(function(arr) {
        return update(key, arr)
    })
}

function update(key, val) {
    return new Promise(function(resolve, reject) {
        db.put(key, val, function(err) {
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
