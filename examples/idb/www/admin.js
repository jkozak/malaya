var sock = new WebSocket('ws://localhost:3000/admin/websocket');

var cUsers  = 0;
var cSlaves = 0;

function showConnection(type,exists) {
    switch (type) {
    case 'data':
        cUsers += (exists ? +1 : -1)
        document.getElementById('cUsers').innerText  = cUsers;
        break;
    case 'replication':
        cSlaves += (exists ? +1 : -1)
        document.getElementById('cSlaves').innerText = cSlaves;
        break;
    }
};

function send(js) {
    sock.send(JSON.stringify(js)+'\n');
}

document.getElementById('bIdle').onclick = function() {
    document.getElementById('mode').innerHTML   = "<s>"+document.getElementById('mode').innerText+"</s>";
    send(['mode','idle']);
};

function showMode(mode) {
    document.getElementById('mode').innerText   = mode;
    document.getElementById('bIdle').disabled   = mode==='idle';
    document.getElementById('bSlave').disabled  = mode==='slave';
    document.getElementById('bMaster').disabled = mode==='master';
}

sock.onmessage = function(e) {
    console.log("*** admin: ",e.data);
    var     js = JSON.parse(e.data);

    switch (js[0]) {
    case 'engine':
        ['data','replication'].forEach(function(type) {
            for (var i=0;i<js[1].connects[type];i++)
                showConnection(type,1);
        });
        document.getElementById('syshash').innerText = js[1].syshash;
        showMode(js[1].mode);
        break;
    case 'mode':
        showMode(js[1]);
        break;
    case 'connection':
        showConnection(js[2],js[3]);
        break;
    case 'close':
        window.close();
        break;
    }
};
