var hypercore = require("hypercore")
var ram = require("random-access-memory")
var pages = require("random-access-page-files")
var st = process.argv.indexOf("--storage") > -1 ? storage : ram
var local = hypercore("./dungeon-dir", {valueEncoding: "json", sparse: true})

module.exports = {local: local, feeds: [
    local, // macbook
    hypercore(st, "5c73d8199d83875b62b19b28893b374189e439e760dc070497cfbd643bfb8fbe", {valueEncoding: "json", sparse: true}), // wintermute
]}

function storage (name) {
    if (name === "data") return pages("dungeon.map/data")
    return raf("dungeon.map/" + name)
}
