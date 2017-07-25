# hyperdungeon
a distributed mud experiment ontop of [hypercore](https://github.com/mafintosh/hypercore) & [hyperdb](https://github.com/mafintosh/hyperdb)

☠️ _a dire work-in-progress_ ☠️  
⚠️ _to potential adventurers:  
this is not only a work in progress for a distrbuted MUD, it is also built ontop of a distributed database that's currently without a stable release. tread warily, stranger!_ 

## Tutorial
#### `npm install && npm start`
The above installs all the packages needed and runs the game. Currently you'll need at least another peer (that is, a hyperdungeon session/player) running to be able to do anything.

When you start your id will be printed out as (but with your id instead!)  
`local key 94dc2d7a9801034e1159525c1bf29a893a5fdf7a4e998d65e17f44ed86868dd9`

### Commands
#### `[n]orth|[w]est|[s]outh|[e]ast`
####  `alias <nick>=<id>`
`alias me=94dc2d7a9801034e1159525c1bf29a893a5fdf7a4e998d65e17f44ed86868dd9`
#### `warp <id|alias>=x,y`
`warp 94dc2d7a9801034e1159525c1bf29a893a5fdf7a4e998d65e17f44ed86868dd9=1000,1000`
#### `write <global|id|alias> <msg>`
`write global hey anyone else here?`
#### `describe <description>`
```
describe you stand in the middle of a dark hallway. you hear whirring machines in the distance. the hyperlord is nowhere in sight.
```
#### `whereis <id|alias>`
`whereis cblgh`

#### `reply <msg>`  
replies to the person who most recently wrote to you

### Other Commands
##### `whoami|look|aliases|messages|help|exit`
