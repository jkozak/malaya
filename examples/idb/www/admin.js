var sock = new WebSocket('ws://localhost:3000/admin/websocket');

sock.onmessage = function(e) {
    var js = JSON.parse(e.data);

    switch (js[0]) {
    case 'engine':
        document.getElementById('syshash').innerText = js[1].syshash;
        document.getElementById('mode').innerText    = js[1].mode;
        break;
    case 'mode':
        document.getElementById('mode').innerText    = js[1];
        break;
    case 'close':
        window.close();
        break;
    }
};
