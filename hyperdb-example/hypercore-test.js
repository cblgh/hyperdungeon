var hypercore = require('hypercore')
var feed = hypercore('./test-db', {valueEncoding: 'utf-8'})
feed.append("potatoruma", function(err) {
    if (err) throw err
})
