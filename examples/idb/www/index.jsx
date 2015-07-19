var React   = require('react');
var Trader  = require('./trader.jsx').Trader;
var Blotter = require('./trader.jsx').Blotter;
var Logon   = require('./logon.jsx').Logon;

var SideBar = React.createClass({
    render: function() {
	return (<div style={{
	    position:   'absolute',
	    top:        0,
	    bottom:     0,
	    left:       0,
	    width:      '100px',
	    background: 'whitesmoke'}}>{this.props.children}</div>);
    }
});

document.body.onload = function() {
    var      sock = null;
    var connected = false;
    var     hosts = [window.location.host];
    var     iHost = 0;
    var buildSock = function() {
	var ws = {'http:':'ws:','https:':'wss:'}[window.location.protocol];

	iHost = (iHost+1)%hosts.length;
	
	sock =  new WebSocket(ws+'//'+hosts[iHost]+'/data/websocket');

	sock.onopen = function() {
	    console.log('*** open');
	    if (user && pw && !connected) 
		send(['logon',{user:user,pw:pw}]);
	    connected = true;
	    render();
	};
	sock.onmessage = function(e) {
	    var decode = function(js) {
		var ks = Object.keys(js);
		if (ks.length===1)
		    return [ks[0],js[ks[0]]];
		else {
		    console.log("*** didn't like that");
		    return None;
		}
	    };
	    var js = decode(JSON.parse(e.data));
	    console.log('*** read: ',e.data);
	    switch (js[0]) {
	    case 'logon':
		if (js[1].OK) {
		    send(['start',{}]);
		    loggedOn = true;
		}
		else
		    renderLogon(js[1].text);
		break;
	    case 'static-data': {
		for (var c in js[1]._children) {
		    var sd = decode(js[1]._children[c]);
		    if (sd) {
			switch (sd[0]) {
			case 'counterparty':
			    counterparties[sd[1].app] = {
				name: sd[1].Name
			    };
			    break;
			case 'SubClass':
			    subClasses[sd[1].ID] = {
				name:sd[1].Name,
				title:sd[1].Title
				// +++
			    }; 
			    break;
			case 'instrument':
			    instruments[sd[1].ID] = {
				id:       sd[1].ID,
				name:     sd[1].Name,
				subClass: sd[1].SubClass,
				maturity: parseInt(sd[1].Maturity),
				visible:  sd[1].Visible
			    }
			    break;
			}
			// +++ check instruments and subclasses are sane +++
		    }
		}
		break;
	    }
	    case 'contexts': {
		var ctx = decode(js[1]._children[0]);
		market = {};
		if (ctx[0]==='market-status') {
		    market.id      = ctx[1].ID;
		    market.status  = ctx[1].status;
		    market.prices  = {}; // <instId> -> {rate,bids:[],offers:[]}
		    market.trades  = {};
		    market.bigFigs = {};
		    ctx[1]._children.forEach(function(child) {
			var item = decode(child);
			switch (item[0]) {
			case 'price':
			    insertPrice(item[1]);
			    break;
			case 'trade':
			    insertTrade(item[1]);
			    break;
			}
		    });
		} else
		    console.log("*** yuk");
		// +++
		break;
	    }
	    case 'BigFigBlock':
		market.bigFigs = {};
		for (var bf in js[1]._children) {
		    var spec = js[1]._children[bf]['BigFig'];
		    bigFig = market.bigFigs[spec.stock] || {instrument:spec.stock};
		    if (spec.bid)
			bigFig.bid   = spec.figure;
		    else
			bigFig.offer = spec.figure;
		    market.bigFigs[spec.stock] = bigFig;
		}
		break;
	    case 'initialised':
		renderAll();
		break;
	    case '_spare':
		if (js[1].server) {
		    hosts = [hosts[0],js[1].server+':'+js[1].port];
		} else
		    hosts = [hosts[0]];
		console.log("*** spare ",js,hosts);
		break;
	    case 'price':
		insertPrice(js[1]);
		renderMarket();
		break;
	    case 'trade':
		insertTrade(js[1]);
		renderMarket();
		break;
	    }
	};
	sock.onerror = function() {
	    console.log('*** error');
	};
	sock.onclose = function() {
	    console.log('*** close');
	    connected = false;
	    sock      = null;
	    setTimeout(function() {
		if (sock===null)
		    buildSock();
	    },1000);
	    render();
	};
    };
    var send = function(js) {
	sock.send(JSON.stringify(js)+'\n');
    };
    
    var counterparties = {};
    var     subClasses = {};
    var    instruments = {};
    var         market;
    var           user = null;
    var             pw = null;
    var       loggedOn = false;
    var        onLogon = function(data) {
	console.log("*** logon "+JSON.stringify(data));
	user = data.user;
	pw   = data.pw;
	buildSock();
    };
    var       onLogoff = function() {
	send(['logoff',{}]);
	loggedOn = false;
	render();
    };

    var renderLogon = function(text) {
	React.render(<Logon user={user} text={text} onLogon={onLogon}/>,document.body);
    };
    var renderAll = function() {
	var main;
	if (connected)
	    main = (<Blotter subClasses={subClasses} instruments={instruments} market={market}/>);
	else
	    main = (<div style={{fontSize:'60pt'}}>OFFLINE</div>);
	React.render((
	    <div style={{position:'relative',padding:"0 0 0 105px"}}>
	     <SideBar>
	      <ul style={{listStyleType:'none',padding:'0px',margin:'0px'}}>
	       <li>{user}</li>
 	       <li>
	        <ul style={{listStyleType:'none',padding:'5px 0 0 10px',margin:'0px'}}>
	         <li><button onClick={onLogoff}>logoff</button></li>
	        </ul>
	       </li>
	      </ul>
	    </SideBar>
 	     {main}
	    </div>),
	    document.body);
    };
    var renderMarket = function() { // only items in `market` have changed
	renderAll();
    };
    var render = function() {
	if (loggedOn)
	    renderAll();
	else
	    renderLogon('');
    };
    
    var insertPrice = function(price) {
	console.log("*** insertPrice: ",price);
	var instId = price.instrument;
	var prices = market.prices[instId];
	if (!prices || (prices.rate!==price.x))
	    prices = market.prices[instId] = {rate:price.x,bids:[],offers:[]};
	var side = price.isBuy ? prices.bids : prices.offers;
	switch (price.action) {
	case 'C':
	    side.push({id:price.ID,counterparty:price.owner,volume:price.volume});
	    break;
	case 'U':
	    // +++
	    break;
	case 'D': {
	    var newSide = side.filter(function(p){return p.id!=price.ID});
	    if (price.isBuy)
		prices.bids   = newSide;
	    else
		prices.offers = newSide;
	    break;
	}
	default:
	}
	console.log("**** market.prices: ",market.prices);
    };
    var insertTrade = function(trade) {
	console.log("*** insertTrade: ",trade);
	var instId = trade.instrument;
	var trades = market.trades[instId];
	if (!trades)
	    trades = market.trades[instId] = {hits:[],takes:[]};
	// +++
    };

    render();
};
