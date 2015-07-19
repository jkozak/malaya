var      ws = {'http:':'ws:','https:':'wss:'}[window.location.protocol];
var    sock = new WebSocket(ws+'//'+window.location.host+'/admin/websocket');
var cUsers  = 0;
var cSlaves = 0;

var masterUrl = null;

function showConnection(type,exists) {
    switch (type) {
    case 'data':
        cUsers += (exists ? +1 : -1)
        break;
    case 'replication':
        cSlaves += (exists ? +1 : -1)
        break;
    }
    document.getElementById('connCounts').innerText = cUsers+" users, "+cSlaves+" spares";
};

function send(js) {
    sock.send(JSON.stringify(js)+'\n');
}

function disableAllModeButtons() {
    document.getElementById('bIdle').disabled   = true;
    document.getElementById('bSlave').disabled  = true;
    document.getElementById('bMaster').disabled = true;
}

document.getElementById('bIdle').onclick = function() {
    document.getElementById('mode').innerHTML   = "<s>"+document.getElementById('mode').innerText+"</s>";
    disableAllModeButtons();
    send(['mode','idle']);
};

document.getElementById('bMaster').onclick = function() {
    document.getElementById('mode').innerHTML   = "<s>"+document.getElementById('mode').innerText+"</s>";
    disableAllModeButtons();
    send(['mode','master']);
};

document.getElementById('bSlave').onclick = function() {
    document.getElementById('mode').innerHTML   = "<s>"+document.getElementById('mode').innerText+"</s>";
    disableAllModeButtons();
    send(['mode','slave']);
};

function showMode(mode) {
    document.getElementById('mode').innerText   = {idle:'idle',master:'live',slave:'spare'}[mode];
    document.getElementById('bIdle').disabled   = mode==='idle';
    document.getElementById('bSlave').disabled  = mode==='slave' || masterUrl===null;
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
        masterUrl = js[1].masterUrl;
        document.getElementById('ipAddr').innerText  = js[1].ip;
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
