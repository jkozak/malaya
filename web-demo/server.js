"use strict";
/*eslint no-var:0 */
/*eslint no-unused-vars:0 */

var http = require('http');
var readline = require('readline');

var server = http.createServer(function(request, response) {});

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var port = 3001;
server.listen(port, function() {
    console.log((new Date()) + ' Server is listening on port ' + port);
});

var WebSocketServer = require('websocket').server;
var wsServer = new WebSocketServer({
    httpServer: server
});

wsServer.on('request', function(r){
    //code to run on connection
    var connection = r.accept('echo-protocol', r.origin);
    var count = 0;
    var clients = {};

    // Specific id for this client & increment count
    var id = count++;

    // Store the connection method so we can loop through & contact all clients
    clients[id] = connection;
    console.log((new Date()) + ' Connection accepted [' + id + ']');

    // Create event listener
    connection.on('message', function(message) {

        // The string message that was sent to us
        var msgString = message.utf8Data;
        console.log(msgString);

        // Loop through all clients
        for (var i in clients){
            // Send a message to the client with the message
            clients[i].sendUTF(msgString);
        }

    });
    rl.setPrompt('OHAI> ');
    rl.prompt();
    rl.on('line', function(answer) {
        console.log('sending' + answer);
        for (var i in clients){
            // Send a message to the client with the message
            clients[i].sendUTF(answer);
        }
    });
    //listen for disconnections
    connection.on('close', function(reasonCode, description) {
        delete clients[id];
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

});
