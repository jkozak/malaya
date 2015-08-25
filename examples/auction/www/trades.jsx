"use strict";

var React  = require('react');

var Row    = React.createClass({
    render: function() {
        var extraColumns = this.props.extraColumns;
        var      auction = this.props.auction;
        var        trade = this.props.trade;
        var         user = this.props.user;
        var           bs = trade.buyer===user ? 'B'          : trade.seller===user ? 'S'      : '';
        var counterparty = trade.buyer===user ? trade.seller : trade.seller===user ? trade.buyer : '';
        return (
            <tr>
             {extraColumns.indexOf('auction')===-1 ?
              '' :
              (<td style={{textAlign:'right'}}>{auction.description}</td>) }
             <td style={{textAlign:'center'}}>{trade.stock}</td>
             <td style={{textAlign:'center'}}>{bs}</td>
             <td style={{textAlign:'right'}}>{trade.rate}</td>
             <td style={{textAlign:'right'}}>{trade.volume}</td>
             {extraColumns.indexOf('counterparty')===-1 ? '' : (<td>{counterparty}</td>)}
            </tr>);
    }
});

var Trades = React.createClass({
    render: function() {
        var extraColumns = this.props.extraColumns || [];
        var     auctions = this.props.auctions;
        var         user = this.props.user;
        var          map = this.props.map || function(t) {
            if ([t.buyer,t.seller].indexOf(user)!==-1)
                return t;
        };
        var        title = this.props.title || "my trades";
        var     headings = [];
        var         rows = [];
        headings.push(<td>stock</td>);
        headings.push(<td>BS</td>);
        headings.push(<td>rate</td>);
        headings.push(<td>volume</td>);
        if (extraColumns.indexOf('auction')!==-1) 
            headings.unshift((<td>auction</td>));
        if (extraColumns.indexOf('counterparty')!==-1)
            headings.push((<td>counterparty</td>));
        auctions.forEach(function(a){
            a.trades.forEach(function(t0){
                var t = map(t0);
                if (t)
                    rows.push(<Row extraColumns={extraColumns} auction={a} trade={t} user={user}/>);
            });
        });
        return (
            <div>
             <table>
              <thead>
               <tr><td colSpan={headings.length}>{title}</td></tr>
               {headings}
              </thead>
              <tbody>
               {rows}
              </tbody>
             </table>
            </div> );
    }
});

exports.Trades = Trades;
