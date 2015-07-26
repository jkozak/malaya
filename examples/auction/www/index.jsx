"use strict";

var React   = require('react');
var Logon   = require('./logon.jsx').Logon;
var Prepare = require('./prepare.jsx').Prepare;
var Auction = require('./auction.jsx').Auction;
var Trades  = require('./trades.jsx').Trades;
var Users   = require('./users.jsx').Users;

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
                   <thead>
                    <tr><td colSpan="3" style={{textAlign:'center'}}>past auctions</td></tr>
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
    var        sock = null;
    var   connected = false;
    var       hosts = [window.location.host];
    var       users = [];
    var      trades = [];
    var       iHost = 0;
    var    loggedOn = false;
    var        user = sessionStorage.getItem('name');
    var          pw = sessionStorage.getItem('pw');
    var    auctions = null;
    var     urlpath = window.location.pathname.split('/').slice(1);
    var        show = ['static','history'];
    var        send = function(js) {
        console.log("*** send",js);
        sock.send(JSON.stringify(js)+'\n');
    };
    var    rankProp = function(k) {
        return function(p,q) {
            return p[k]>q[k];
        }; };
    var findAuction = function(id) {
        var aucts = auctions.filter(function(a){return a.id===id;});
        if (aucts.length===1)
            return aucts[0];
        else {
            console.log("*** bad aucts: ",id,aucts);
            return null;
        }
    };
    var renderLogon;
    var      render;
    var   buildSock = function() {
        var ws = {'http:':'ws:','https:':'wss:'}[window.location.protocol];

        iHost = (iHost+1)%hosts.length;
        
        sock =  new WebSocket(ws+'//'+hosts[iHost]+'/data/websocket');

        sock.onopen = function() {
            console.log('*** open',user,pw,connected,loggedOn);
            connected = true;
            if (user && pw && !loggedOn) {
                send(['logon',{name:user,pw:pw}]);
            } else
                render();
        };
        sock.onmessage = function(e) {
            var js = JSON.parse(e.data);
            console.log('*** read: ',e.data);
            switch (js[0]) {
            case 'logon':
                if (js[1].ok) {
                    loggedOn = true;
                    send(['lsAuctions',{path:urlpath}]);
                    sessionStorage.setItem('name',user);
                    sessionStorage.setItem('pw',  pw);
                } else
                    renderLogon(js[1].msg);
                break;
            case 'users':
                users = js[1];
                users.sort(rankProp('name'));
                render();
                break;
            case 'user': 
                users = users.filter(function(u){return u.name!==js[1].name;});
                users.push(js[1]);
                users.sort(rankProp('name'));
                render();
                break;
            case 'auctions':    // send in response to ['lsAuctions',{...}]
                auctions = js[1];
                auctions.forEach(function(a) {
                    a.prices = [];
                    a.trades = [];
                });
                render();
                break;
            case 'auction': {   // send in response to ['start',{path:['auction',id]}]
                var previous = findAuction(js[1].id);
                auctions = auctions.filter(function(a){return a.id!==js[1].id;});
                if (js[1].state==='run' && js[1].remaining===undefined) {
                    js[1].remaining = js[1].duration;
                    js[1].prices    = previous.prices;
                    js[1].trades    = previous.trades;
                }
                auctions.push(js[1]);
                render();
                break;
            }
            case 'tick': {
                var aucts = auctions.filter(function(a){return a.id===js[1].id;});
                aucts.forEach(function(a) {
                    a.remaining = js[1].remaining;
                });
                render();
                break;
            }
            case 'price': {
                var auction = findAuction(js[1].auction);
                if (auction) {
                    auction.prices.push(js[1]);
                    render();
                }
                break;
            }
            case 'trade': {
                var auction1 = findAuction(js[1].auction);
                if (auction1) {
                    auction1.trades.push(js[1]);
                    render();
                }
                break;
            }
            case 'activity':    // async, optional
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
        user = data.user;
        pw   = data.pw;
        buildSock();
    };
    var onLogoff = function() {
        send(['logoff',{}]);
        loggedOn = false;
        render();
    };
    var onUsers = function() {
        show = ['static','users'];
        send(['lsUsers',{subscribe:true}]); // +++ unsubscribe on moving away +++
        render();
    };
    var onStart = function(auction) {
        send(['auction',{id:auction.id,state:'run'}]);
    };
    var onPriceChange = function(auction,stock,buy,volume) {
        send(['price',{auction:auction.id,stock:stock,buy:buy,volume:volume,user:user}]);
    };
    var mkShow = function(s) {
        return function() {
            show = (typeof s)==='string' ? ['static',s] : s;
            render();
        };
    };
    
    var renderAll = function() {
        var    main = (<div>oops</div>);
        var pending = [];
        var running = [];
        var    auct;
        if (connected) {
            switch (show[0]) {
            case 'static':
                switch (show[1]) {
                case 'users':
                    main = (<Users users={users}/>);
                    break;
                case 'trades':
                    main = (<Trades trades={trades}/>);
                    //send(['lsTrades',{}]);
                    break;
                case 'history':
                    main = (<History auctions={auctions.filter(function(a){return a.state==='done';})}/>);
                    break;
                case 'prepare':
                    // +++ new auction +++
                    main = (<Prepare auction={{id:'???'}}/>);
                    break;
                }
                break;
            case 'ready': {
                auct = findAuction(show[1].id);
                if (auct)
                    main = (<Prepare user={user} onStart={function(){onStart(auct);}} auction={auct}/>);
                break;
            }
            case 'run': {
                auct = findAuction(show[1].id);
                if (auct)
                    main = (<Auction user={user} onPriceChange={onPriceChange} auction={auct}/>);
                break;
            } }
        } else
            main = (<div style={{fontSize:'60pt'}}>OFFLINE</div>);
        auctions.forEach(function(a) {
            switch (a.state) {
            case 'ready':
                pending.push(
                    <div style={{background:"#FFFFC0",
                                 fontWeight:(show[0]==='ready' && show[1].id===a.id?'bold':'normal') }}>
                    <a className="tbtn" nohref onClick={mkShow(['ready',a])}>
                     {a.id}
                    </a>
                    </div>);
                break;
            case 'run': {
                var pc = (((a.duration-a.remaining)/a.duration)*100)+'%';
                running.push(
                    <div style={{position:'relative',background:'#C0FFC0',
                                 fontWeight:(show[0]==='run' && show[1].id===a.id?'bold':'normal') }}>
                    <div style={{position:'absolute'}}>
                     <a nohref className="tbtn" onClick={mkShow(['run',a])}>
                      {a.id}
                     </a>
                    </div>
                    <div style={{background:'#80E680',width:pc,height:'20px'}}/>
                    </div>);
                break;
            } } });
        React.render((
            <div style={{position:'relative',padding:"0 0 0 155px",minHeight:'100%'}}>
            <div style={{position:'absolute',top:0,right:0,background:'whitesmoke',textAlign:'right',padding:'10'}}>
             <div>{user}</div>
             <div><a nohref className="tbtn" onClick={onLogoff}>logoff</a></div>
            </div>
             <SideBar>
               <div style={{fontWeight:(show[0]==='static' && show[1]==='users'?'bold':'normal'),
                            background:"inherit"}}>
                <a nohref className="tbtn" onClick={onUsers}>users</a>
               </div>
               <div style={{paddingTop:'30px'}}/>
               <div style={{fontWeight:(show[0]==='static' && show[1]==='trades'?'bold':'normal'),
                            background:"inherit"}}>
                <a nohref className="tbtn" onClick={mkShow('trades')}>trades</a>
               </div>
               <div style={{paddingTop:'10px'}}/>
               <div style={{fontWeight:(show[0]==='static' && show[1]==='history'?'bold':'normal'),
                            background:"inherit"}}>
                <a nohref className="tbtn" onClick={mkShow('history')}>past auctions</a>
               </div>
               <div style={{paddingTop:'10px'}}/>
               <div style={{fontWeight:(show[0]==='static' && show[1]==='prepare'?'bold':'normal'),
                            background:"inherit"}}>
                <a nohref className="tbtn" onClick={mkShow('prepare')}>prepare auction</a>
               </div>
               <div style={{background:'#E6E680'}}>
                <div style={{fontStyle:'italic',textAlign:'center',marginTop:'30px',paddingBottom:'5px'}}>ready to run</div>
                {pending}
                <div style={{paddingBottom:'10px'}}/>
               </div>
               <div style={{background:'#80E680'}}>
                <div style={{fontStyle:'italic',textAlign:'center',marginTop:'30px',paddingBottom:'5px'}}>running</div>
                {running}
                <div style={{paddingBottom:'10px'}}/>
               </div>
             </SideBar>
             <div>{main}</div>
            </div>),
            document.body);
    };
    renderLogon = function(text) {
        React.render(<Logon user={user} pw={pw} text={text} onLogon={onLogon}/>,document.body);
    };
    render = function() {
        if (loggedOn)
            renderAll();
        else
            renderLogon('');
    };
    

    if (!connected && user && pw)
        onLogon({user:user,pw:pw});
    else
        render();
};
