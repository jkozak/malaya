"use strict";

var _      = require('underscore');
var React  = require('react');
var Trades = require('./trades.jsx').Trades;

var ActiveMatchRow = React.createClass({
    render: function() {
        var   props = this.props;
        var auction = props.auction;
        var   stock = props.stock;
        var    onPC = function(buy) {
            return function() {
                var  elem = document.getElementById((buy?'sb':'ss')+stock);
                var value = parseFloat(elem.options[elem.selectedIndex].value);
                props.onPriceChange(auction,stock,buy,value);
            };
        };
        var  active = false;
        var  traded = false;
        var     bid = null;
        var   offer = null;
        var  bought = 0;
        var    sold = 0;
        auction.prices.forEach(function(p) {
            if (p.stock===stock) {
                if (p.user===props.user) {
                    if (p.buy)
                        bid   = p.volume;
                    else
                        offer = p.volume;
                }
                active = true;
            }
        });
        auction.trades.forEach(function(t) {
            if (t.stock===stock) {
                if (t.buyer===props.user)
                    bought += t.volume;
                if (t.seller===props.user)
                    sold += t.volume;
                traded = true;
            }
        });
        var stockColour = traded ? 'red' : active ? 'green' : 'inherit';
        return (
            <tr>
             <td style={{color:stockColour}}>{stock}</td>
             <td>{bought===0 ? '' : bought}</td>
             <td>
              <select id={'sb'+stock} value={bid} onChange={onPC(true)}>
               {[0,5,10,15,20,25].map(function(n) {
                   return (<option value={n}>{n}</option>);
                })}
              </select>
             </td>
             <td>100</td>
             <td>
              <select id={'ss'+stock} value={offer} onChange={onPC(false)}>
               {[0,5,10,15,20,25].map(function(n){
                   return (<option value={n}>{n}</option>);
                })}
              </select>
             </td>
             <td>{sold===0 ? '' : sold}</td>
            </tr> );
    }
});

var ActiveMatchAuction = React.createClass({
    render: function() {
        var   props = this.props;
        var auction = props.auction;
        return (
            <table>
             <thead>
              <tr><td>stock</td><td>bought</td><td>buy</td><td>rate</td><td>sell</td><td>sold</td></tr>
             </thead>
             <tbody>
              {auction.stocks.map(function(s) {
                  return (<ActiveMatchRow user={props.user} onPriceChange={props.onPriceChange} auction={auction} stock={s}/>);
               })}
             </tbody>
            </table> );
    }
});

var ActiveDutchAuction = React.createClass({
    render: function() {return (<div>oops</div>);}
});

var ActiveEnglishAuction = React.createClass({
    render: function() {return (<div>oops</div>);}
});

var ActiveNthPriceSealedBidAuction = React.createClass({
    render: function() {return (<div>oops</div>);}
});

var PrepareMatchRow = React.createClass({
    render: function() {
        var      props = this.props;
        var      stock = props.stock;
        return (
            <tr>
             <td>{stock}</td>
             <td><input type="text" size="6" defaultValue="100" onChange={function(v){/* +++ */}}/></td>
             <td><input type="text" defaultValue="0 5 10 15 20 25" onChange={function(v){/* +++ */}}/></td>
             <td>
              <button type="button" style={{color:'red',padding:'0 2 0'}} onClick={props.delThisRow}>
               {'\u2212'}
              </button>
             </td>
            </tr>);
    }
});

var PrepareMatchNewRow = React.createClass({
    getInitialState: function() {
        return {
            name:    Object.keys(this.props.stocks)[0],
            rate:    100,
            volumes: [0,5,10,15,20,25]
        };
    },
    render: function() {
        var       self = this;
        var      props = self.props;
        var stockNames = Object.keys(props.stocks);
        var     accept = function() {
            props.accept({
                name:   self.state.name,
                rate:   self.state.rate,
                volumes:self.state.volumes});
        };
        return (
            <tr>
             <td>
              <select defaultValue={self.state.name}
                      onChange={function(e){
                                self.setState({name:e.target.value});
                                }}>
               {stockNames.map(function(s) {
                   return (<option value={s} disabled={props.auction.stocks.indexOf(s)!==-1}>{s}</option>);
                })}
              </select>
             </td>
             <td>
              <input type="text"
                     size="6"
                     defaultValue={self.state.rate}
                     onChange={function(v){self.setState({rate:parseFloat(v)});}}/>
             </td>
             <td>
              <input type="text"
                     defaultValue={self.state.volumes.join(' ')}
                     onChange={function(v){self.setState({volumes:v.split(' ').map(parseFloat)});}}/>
             </td>
             <td>
              <button type="button" style={{color:'red',padding:'0 2 0'}} onClick={props.delThisRow}>
               {'\u2212'}
              </button>
              <button type="button" style={{color:'green',padding:0}} onClick={accept}>
               {'\u2714'}
              </button>
             </td>
            </tr>);
    }
});

var PrepareMatchAuction = React.createClass({
    getInitialState: function() {
        return {newRow:false};
    },
    render: function() {
        var    self = this;
        var   props = self.props;
        var auction = props.auction;
        var    rows = [];
        var  accept = function(s) {
            var a = _.extend({},
                             auction,
                             {
                                 stocks:auction.stocks.concat(s.name)
                             } );
            props.update(a);
            self.setState({newRow:false});
        };
        auction.stocks.forEach(function(s) {
            rows = rows.concat(
                <PrepareMatchRow key={s}
                                 auction={auction}
                                 delThisRow={function(){
                                             auction.stocks = auction.stocks.filter(function(t){return t!==s;});
                                             props.update(auction);
                                             }}
                                 stock={s}/> );
        });
        if (self.state.newRow)
            rows = rows.concat(<PrepareMatchNewRow key="{newRow}"
                                                   auction={auction}
                                                   delThisRow={function(){self.setState({newRow:false});}}
                                                   accept={accept}
                                                   stocks={props.stocks}/>);
        return (
            <div>
             <table>
              <thead>
               <tr><td>stock</td><td>rate</td><td>volumes</td><td/></tr>
              </thead>
              <tbody>
               {rows}
               <tr>
                <td style={{textAlign:'center'}} colSpan={4}>
                 <button type="button"
                         disabled={self.state.newRow}
                         onClick={function(){self.setState({newRow:true});}}>
                               + stock
                 </button>
                </td>
               </tr>
              </tbody>
             </table>
            </div> );
    }
});

var PrepareDutchRow = React.createClass({
    render: function() {
        var   props = this.props;
        var   stock = props.stock;
        return (
            <tr>
             <td>{stock}</td>
             <td><input type="text" size="4" defaultValue="100.00" onChange={function(v){/* +++ */}}/></td>
             <td><input type="text" size="4" defaultValue="000.00" onChange={function(v){/* +++ */}}/></td>
            </tr> );
    }
});

var PrepareDutchAuction = React.createClass({
    render: function() {
        var   props = this.props;
        var auction = props.auction;
        return (
            <div>
             <table>
              <thead>
               <tr><td>stock</td><td>start</td><td>end</td></tr>
              </thead>
              <tbody>
               {auction.stocks.map(function(s) {
                   return (<PrepareDutchRow key={s} auction={auction} stock={s}/>);
                })}
              </tbody>
             </table>
            </div> );
    }
});

var PrepareEnglishRow = React.createClass({
    render: function() {
        var   props = this.props;
        var   stock = props.stock;
        return (
            <tr>
             <td>{stock}</td>
             <td><input type="text" size="4" defaultValue="000.00" onChange={function(v){/* +++ */}}/></td>
             <td><input type="text" size="4" defaultValue="0" onChange={function(v){/* +++ */}}/></td>
            </tr>);
    }
});

var PrepareEnglishAuction = React.createClass({
    render: function() {
        var   props = this.props;
        var auction = props.auction;
        return (
            <div>
             <table>
              <thead>
               <tr><td>stock</td><td>start</td><td>reserve</td></tr>
              </thead>
              <tbody>
               {auction.stocks.map(function(s) {
                   return (<PrepareEnglishRow key={s} auction={auction} stock={s}/>);
                })}
              </tbody>
             </table>
            </div> );
    }
});

var PrepareNthPriceSealedBidRow = React.createClass({
    render: function() {
        var   props = this.props;
        var   stock = props.stock;
        return (
            <tr>
             <td>{stock}</td>
            </tr>);
    }
});

var PrepareNthPriceSealedBidAuction = React.createClass({
    render: function() {
        var   props = this.props;
        var auction = props.auction;
        return (
            <div>
             <table>
              <thead>
               <tr><td>stock</td></tr>
              </thead>
              <tbody>
               {auction.stocks.map(function(s) {
                   return (<PrepareNthPriceSealedBidRow key={s} n={props.n} auction={auction} stock={s}/>);
                })}
              </tbody>
             </table>
            </div> );
    }
});

var auctionClasses = {
    match: {
        Active:  ActiveMatchAuction,
        Prepare: PrepareMatchAuction
    },
    dutch: {
        Active:  ActiveDutchAuction,
        Prepare: PrepareDutchAuction
    },
    english: {
        Active:  ActiveEnglishAuction,
        Prepare: PrepareEnglishAuction
    },
    blind: {
        Active:  ActiveNthPriceSealedBidAuction,
        Prepare: PrepareNthPriceSealedBidAuction
    },
    vickrey: {
        Active:  ActiveNthPriceSealedBidAuction,
        Prepare: PrepareNthPriceSealedBidAuction
    }
};

var Auction = React.createClass({
    getInitialState: function() {
        return {type:'match',duration:0,description:'',saveable:false,startable:true};
    },
    render: function() {
        var         self = this;
        var        props = this.props;
        var      auction = props.auction;
        var onChangeType = function() {
            var  elem = document.getElementById('auctionType');
            var value = elem.options[elem.selectedIndex].value;
            auction.type = value;
            self.setState({type:value,saveable:true,startable:value==='match'});
        };
        var onChangeDuration  = function() {
            var  elem = document.getElementById('auctionDuration');
            var value = parseInt(elem.value);
            auction.duration = value;
            self.setState({duration:value,saveable:true});
        };
        var onChangeDescription  = function() {
            var  elem = document.getElementById('auctionDescription');
            var value = elem.value;
            auction.description = value;
            self.setState({description:value,saveable:true});
        };
        var onChangeWantSubclasses = function() {
            var  elem = document.getElementById('wantSubclasses');
            var value = elem.value;
            auction.wantSubclasses = value;
            self.setState({wantSubclasses:value,saveable:true});
        };
        var updateAuction = function(a) {
            props.updateAuction(a);
            self.setState({saveable:true});
        };
        auction.type = self.state.type;
        switch (auction.state) {
            case 'new':
            case 'ready':
                return (
                    <div>
                     <h2><i>prepare auction</i> {auction.description}</h2>
                     <table>
                      <tr>
                       <td>id</td>
                       <td style={{textAlign:'right'}}>{auction.id}</td>
                      </tr>
                      <tr>
                       <td>description</td>
                       <td style={{textAlign:'right'}}>
                        <input id='auctionDescription'
                               style={{textAlign:'center'}}
                               type='text'
                               onChange={onChangeDescription}
                               defaultValue={auction.description}/>
                       </td>
                      </tr>
                      <tr>
                       <td>type</td>
                       <td style={{textAlign:'right'}}>
                        <select id='auctionType' defaultValue={self.state.type} onChange={onChangeType}>
                         {Object.keys(auctionClasses).map(function(n) {
                             return (<option key={n} value={n}>{n}</option>);
                          })}
                        </select>
                       </td>
                      </tr>
                      <tr>
                       <td>duration</td>
                       <td style={{textAlign:'right'}}>
                        <input id='auctionDuration'
                               style={{textAlign:'right'}}
                               type='number' min='10' max='3600' step='5' 
                               onChange={onChangeDuration}
                               defaultValue={auction.duration}/> 
                       </td>
                      </tr>
                      <tr>
                       <td>subclasses</td>
                       <td style={{textAlign:'right'}}>
                        <input id='wantSubclasses'
                               type='checkbox'
                               disabled={true}
                               onChange={onChangeWantSubclasses}
                               defaultValue={false}/> 
                       </td>
                      </tr>
                     </table>
                     <div style={{paddingTop:'30px'}}> </div>
                     {
                         React.createElement(auctionClasses[self.state.type].Prepare,
                                             {
                                                 user:   props.user,
                                                 auction:auction,
                                                 stocks: props.stocks,
                                                 update: updateAuction
                                             } )
                      }
                     <div style={{paddingTop:'30px'}}> </div>
                     <div style={{paddingLeft:'100px'}}>
                      <button onClick={self.props.onSave}  disabled={!self.state.saveable} type="button">
                       save
                      </button>
                      <span style={{paddingLeft:'20px'}}/>
                      <button onClick={self.props.onStart}
                              disabled={!self.state.startable || auction.stocks.length===0}
                              type="button">
                       start
                      </button>
                     </div>
                    </div> );
            case 'run':
                return (
                    <div>
                     <h2><i>auction</i> {auction.description}</h2>
                     {
                         React.createElement(auctionClasses[this.state.type].Active,
                                             {
                                                 user:         props.user,
                                                 auction:      auction,
                                                 onPriceChange:props.onPriceChange
                                             } )
                      }
                     <div style={{paddingTop:'30px'}}> </div>
                     <Trades auctions={[auction]} user={props.user}/>
                    </div> );
            case 'ended':
            case 'done':
                return (
                    <div>
                     <h2><i>auction</i> {auction.description} <i>finished</i></h2>
                     <div style={{paddingTop:'30px'}}> </div>
                     <Trades user={props.user} auctions={[auction]}/>
                    </div> );
        }
    }
});

exports.Auction = Auction;

