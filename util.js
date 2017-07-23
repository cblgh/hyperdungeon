var hypercore = require("hypercore")
var ram = require("random-access-memory")
var st = process.argv.indexOf("--storage") > -1 ? storage : ram
var local = hypercore("./dungeon-dir", {valueEncoding: "json", sparse: true})

module.exports = {local: local, feeds: [
    local, // macbook
    hypercore(st, "5c73d8199d83875b62b19b28893b374189e439e760dc070497cfbd643bfb8fbe", {valueEncoding: "json", sparse: true}), // wintermute
    hypercore(st, "7cfc122d7ce9e73d8324f49cb0ab4cd4a92e708e87757102b06d0ed757f7d4aa", {valueEncoding: "json", sparse: true}) // clone client
], join: join}

function createFeed(key) {
    return hypercore(st, key, {valueEncoding: "json", sparse: true}) 
}

function join(arr, key) {
    var feeds = []
    for (var i = 0; i < arr.length; i++) {
        var feed = arr[i]
        if (feed === key) {
            feeds.push(local)
        } else {
            feeds.push(createFeed(feed))
        }
    }
    return feeds
}

function storage (name) {
    return raf("dungeon.map/" + name)
}
