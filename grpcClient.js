var PROTO_PATH = __dirname + '/proto/ReaderPlugin.proto';

var grpc = require('grpc');
var pluginService = grpc.load(PROTO_PATH).devmand.channels.cli.plugin.ReaderPlugin;
var client = new pluginService('localhost:50051', grpc.credentials.createInsecure());

var sending = function(obj){console.log("Sending", obj); return obj;}

var call = client.read();
call.on('data', function(readResponse) {
    console.log('Got message "', readResponse);
    if (readResponse.cliRequest) {
        call.write(sending({cliResponse:{output:"foo"}}));
    } else if (readResponse.actualReadResponse) {
        console.log("Got ", readResponse.actualReadResponse); // both sides should close the rpc
        call.end();
    } else {
        throw "Undefined"
    }
});

call.on('end', function() {
    console.log('got end');
    //call.end();
});

call.write(sending({actualReadRequest:{path:"p"}}));
//call.end();
