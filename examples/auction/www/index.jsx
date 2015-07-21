var React   = require('react');
var Logon   = require('./logon.jsx').Logon;
var Prepare = require('./prepare.jsx').Prepare;
var Auction = require('./auction.jsx').Auction;

var SideBar = React.createClass({
    render: function() {
	return (<div style={{
	    position:   'absolute',
	    top:        0,
	    bottom:     0,
	    left:       0,
	    width:      '150px',
	    minHeight:  '100%',
	    background: 'whitesmoke'}}>{this.props.children}</div>);
    }
});

var AuctionSummary = React.createClass({
    render: function() {
	var when = new Date(this.props.auction.start).toISOString().replace(/T/,' ').replace(/\..+/,'');
	return (<tr>
		<td>{this.props.auction.id}</td>
		<td>{when}</td>
		<td>{this.props.auction.description}</td>
		</tr>);
    }
});

var History = React.createClass({
    render: function() {
	if (this.props.auctions.length>0)
	    return (
		<div>
		  <table>
		   <thead style={{fontWeight:"bold"}}>
		    <tr><td>id</td><td>when</td><td>description</td></tr>
		   </thead>
		   <tbody>
		    {this.props.auctions
		        .filter(function(a){return a.state==='done';})
		        .map(function(a){return (<AuctionSummary key={a.id} auction={a}/>);}) }
		   </tbody>
		  </table>
		</div>);
	else
	    return (<div style={{paddingTop:"50px"}}>No auctions have been run.</div>);
    }
});

document.body.onload = function() {
    var      sock = null;
    var connected = false;
    var     hosts = [window.location.host];
    var     iHost = 0;
    var  loggedOn = false;
    var      user = null;
    var        pw = null;
    var  auctions = null;
    var   urlpath = window.location.pathname.split('/').slice(1);
    var      show = ['static','history'];
    var      send = function(js) {
	console.log("*** send",js);
	sock.send(JSON.stringify(js)+'\n');
    };
    var buildSock = function() {
	var ws = {'http:':'ws:','https:':'wss:'}[window.location.protocol];

	iHost = (iHost+1)%hosts.length;
	
	sock =  new WebSocket(ws+'//'+hosts[iHost]+'/data/websocket');

	sock.onopen = function() {
	    console.log('*** open',user,pw,connected);
	    if (user && pw && !connected) {
		send(['logon',{name:user,pw:pw}]);
		connected = true;
	    }
	    render();
	};
	sock.onmessage = function(e) {
	    var js = JSON.parse(e.data);
	    console.log('*** read: ',e.data);
	    switch (js[0]) {
	    case 'logon':
		if (js[1].ok) {
		    loggedOn = true;
		    send(['init',{path:urlpath}]);
		} else
		    renderLogon(js[1].msg);
		break;
	    case 'auctions':	// send in response to ['init',{...}]
		auctions = js[1];
		render();
		break;
	    case 'auction':	// send in response to ['start',{path:['auction',id]}]
		auctions = auctions.filter(function(a){return a.id!==js[1].id;});
		if (js[1].state==='run' && js[1].remaining===undefined)
		    js[1].remaining = js[1].duration;
		auctions.push(js[1]);
		render();
		break;
	    case 'tick': {
		var aucts = auctions.filter(function(a){return a.id===js[1].id;});
		aucts.forEach(function(a) {
		    a.remaining = js[1].remaining;
		});
		render();
		break;
	    }
	    case 'price':	// async, optional
		break;
	    case 'trade':	// async, optional
		break;
	    case 'activity':	// async, optional
		// ['activity',{stock,type:['price'|'trade'|...,...]}]
		break;
	    }
	};
	sock.onerror = function(e) {
	    console.log("*** error",e);
	};
	sock.onclose = function(e) {
	    console.log("*** close",e);
	    connected = false;
	    sock      = null;
	    setTimeout(function() {
		if (sock===null)
		    buildSock();
	    },1000);
	    render();
	};
    };
    
    var onLogon = function(data) {
	console.log("*** logon "+JSON.stringify(data));
	user = data.user;
	pw   = data.pw;
	buildSock();
    };
    var onLogoff = function() {
	send(['logoff',{}]);
	loggedOn = false;
	render();
    };
    var onHistory = function() {
	show = ['static','history'];
	render();
    };
    var onPrepare = function(auction) {
	show = ['ready',auction];
	console.log("*** prepare auction",auction);
	render();
    };

    var onAuction = function(auction) {
	show = ['run',auction];
	render();
    };

    var onStart = function(auction) {
	send(['auction',{id:auction.id,state:'run'}]);
    };

    var onPriceChange = function(auction,stock,buy,volume) {
	console.log("*** onPriceChange: ",stock,buy,volume);
	send(['price',{auction:auction.id,stock:stock,buy:buy,volume:volume,user:user}]);
    };
    
    var renderLogon = function(text) {
	React.render(<Logon user={user} text={text} onLogon={onLogon}/>,document.body);
    };
    var renderAll = function() {
	var    main;
	var pending = [];
	var running = [];
	if (connected) {
	    switch (show[0]) {
	    case 'static':
		switch (show[1]) {
		case 'history':
		    main = (<History auctions={auctions.filter(function(a){return a.state==='done';})}/>);
		    break;
		case 'prepare':
		    // +++ new auction +++
		    main = (<Prepare/>);
		    break;
		}
		break;
	    case 'ready':
	    case 'run': {
		var aucts = auctions.filter(function(a){return a.id===show[1].id;});
		if (aucts.length===1) {
		    switch (show[0]) {
		    case 'ready':
			main = (<Prepare onStart={function(){onStart(aucts[0])}} auction={aucts[0]}/>);
			break;
		    case 'run':
			main = (<Auction onPriceChange={onPriceChange} auction={aucts[0]}/>);
			break;
		    }
		} else
		    console.log("*** bad aucts",aucts);
		break;
	    } }	
	} else
	    main = (<div style={{fontSize:'60pt'}}>OFFLINE</div>);
	auctions.forEach(function(a) {
	    switch (a.state) {
	    case 'ready':
		pending.push(
		    <div className="tbtn" style={{background:"#FFFF00"}}>
		    <a nohref onClick={function(){onPrepare(a);}}>
		     {a.id}
		    </a>
		    </div>);
		break;
	    case 'run': {
		var pc = (((a.duration-a.remaining)/a.duration)*100)+'%';
		console.log("*** a: ",a);
		console.log("*** pc: ",pc);
		running.push(
		    <div className="tbtn" style={{position:'relative',background:'#00FF00'}}>
		    <div style={{position:'absolute'}}>
 		     <a nohref onClick={function(){onAuction(a);}}>
		      {a.id}
		     </a>
		    </div>
		    <div style={{background:'whitesmoke',width:pc,height:'20px'}}/>
		    </div>);
		break;
	    } } });
	React.render((
	    <div style={{position:'relative',padding:"0 0 0 155px",minHeight:'100%'}}>
	     <SideBar>
	       <div style={{paddingBottom:"5px"}}>{user}</div>
	       <div className="tbtn" style={{paddingBottom:"30px"}}><a nohref onClick={onLogoff}>logoff</a></div>
	       <div className="tbtn" style={{fontWeight:"bold",background:"inherit"}}><a nohref onClick={onHistory}>past auctions</a></div>
	       <div style={{paddingBottom:"30px"}}/>
	       <div className="tbtn" style={{background:"inherit"}}><a nohref onClick={onPrepare}>prepare auction</a></div>
	       <div style={{paddingTop:"30px"}}></div>
	       {pending}
	       <div style={{paddingTop:"30px"}}></div>
	       {running}
	     </SideBar>
 	     <div>{main}</div>
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
    
    render();
};
