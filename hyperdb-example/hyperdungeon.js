var hyperdb = require("hyperdb")
var hypercore = require("hypercore")
var hyperdiscovery = require("hyperdiscovery")
var pages = require("random-access-page-files")
var raf = require("random-access-file")
var ram = require("random-access-memory")

var st = process.argv.indexOf("--ram") > -1 ? ram : storage
var optimized = process.argv.indexOf("--optimized") > -1

var local = hypercore("./dungeon-dir", {valueEncoding: "json", sparse: true})
var db = hyperdb([
  // st <- <dat:hash>: put what you sync from <dat:hash> into the storage st
  hypercore(st, "48e2619899edb24f4d5031b5e0cf16e6caef0cc20710c8c60783428f4e8d2ef3", {valueEncoding: "json", sparse: true}),
  local
])

var direction = process.argv[2] || "north"

db.ready(function () {
  var id = local.key.toString("hex");
  id = "teiast";
  console.log("local key", id);
  var sw = hyperdiscovery(db, {live: true})
  if (process.argv.indexOf("--sync") > -1) {
    db.feeds[0].download({start: 0, end: -1})
    return
  }

  console.log("Joining swarm ...")

  db.feeds[0].get(0, function () {
    // haxx to make sure we have a connection lol
    var now = Date.now()

    db.feeds[0].on("download", function (index) {
      console.log("Downloaded block", index)
    })

    // fetch local player's position from hyperdb
    get(id).then(function(position) {
        if (!position) {
            // new player, place them at the center
            console.log("new player");
            var position = {x: 0, y: 0}
        }
        // update the position with the direction the player traveled
        if (direction === "north") {
            position.y += 1;
        } else if (direction === "south") {
            position.y -= 1;
        } else if (direction === "west") {
            position.x -= 1;
        } else if (direction === "east") {
            position.x += 1;
        }
        console.log(position);

        // TODO: how do i save information to a tile?
        // if every client saves to the same position, "0-0": "{data: ...}", will i be able to iterate through all
        // of the information, composing a large collection?
        
        // save the local player's new position
        update(id, JSON.stringify(position)).then(function() {
            // update current tile with this player's id
            return update(JSON.stringify(position), id)
        }).then(function() {
            console.log("Closing...");
            sw.destroy();
        });
    })
  })
})

function update(key, val) {
    return new Promise(function(resolve, reject) {
        db.put(key, val, function(err, nodes) {
            if (err) {
                console.log(err);
                reject(err);
            }
            resolve();
        });
    });
}

function get(key) {
    return new Promise(function(resolve, reject) {
        db.get(key, function(err, nodes) {
            if (err) { 
                console.log("err");
                console.log(err); 
                resolve(null);
            } else if (nodes && nodes[0]) {
                // TODO: insert code to check if many nodes have their own value at this spot
                // console.log("GOT EM");
                resolve(JSON.parse(nodes[0].value))
            } else {
                resolve(null);
            }
        })
    })
}
  // if (process.argv.indexOf("--add") > -1) {
  //       // try to put in a nonsense word to prove that i can write to my feed
  //       db.put(word, 1, function (err, nodes) {
  //           // probably no callback for put, but idk
  //           console.log("Adding " + word + " to the dictionary!")
  //           if (err)  console.log(err);
  //           console.log(nodes)
  //           console.log("Shutting down swarm ...")
  //           sw.destroy()
  //       });
  // } else {
  //       db.get(word, function (err, nodes) {
  //         console.log("Query took", Date.now() - now, "ms")
  //         console.log()
  //           
  //         console.log(nodes);
  //         if (nodes && nodes[0] && nodes[0].key === word) {
  //           console.log(""" + word + "" is an English word")
  //         } else {
  //           console.log(""" + word + "" is *not* an English word")
  //         }
  //
  //         console.log()
  //         console.log("Shutting down swarm ...")
  //         sw.destroy()
  //       })
  // }

function storage (name) {
  if (name === "data") return pages("words.db/data")
  return raf("words.db/" + name)
}

function noop () {}
