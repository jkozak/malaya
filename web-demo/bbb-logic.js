"use strict";
/*eslint-env browser */
/*eslint no-var:0 */
/*eslint no-unused-vars:0 */

var ws = new WebSocket('ws://localhost:3001', 'echo-protocol');

function sendMessage(){
    var message = document.getElementById('message').value;
    ws.send(message);
}

function startKernel(){
    var message = 'start-kernel';
    ws.send(message);
}
function stopKernel(){
    var message = 'stop-kernel';
    ws.send(message);
}

ws.addEventListener("message", function(e) {
    // The data is simply the message that we're sending back
    var msg = e.data;
    var json = JSON.parse(e);
    // Append the message
    document.getElementById('factlog').innerHTML += '<br> <p>' + msg;
});
