"use strict";

var React  = require('react');

var Row    = React.createClass({
    render: function() {
        var extraColumns = this.props.extraColumns;
        var      auction = this.props.auction;
        var        trade = this.props.trade;
        var         user = this.props.user;
        console.log("*** trade: ",trade);
        console.log("*** user: ",user);
        var           bs = trade.buyer===user ? 'bought'     : trade.seller===user ? 'sold'      : '';
        var counterparty = trade.buyer===user ? trade.seller : trade.seller===user ? trade.buyer : '';
        return (
            <tr>
             {extraColumns.indexOf('auction')===-1 ? '' : (<td>{auction.description}</td>)}
             <td>{trade.stock}</td>
             <td>{bs}</td>
             <td>{trade.rate}</td>
             <td>{trade.volume}</td>
             {extraColumns.indexOf('counterparty')===-1 ? '' : (<td>{counterparty}</td>)}
            </tr>);
    }
});

var Trades = React.createClass({
    render: function() {
        var extraColumns = this.props.extraColumns || [];
        var     auctions = this.props.auctions;
        var         user = this.props.user;
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
            a.trades.forEach(function(t){
                rows.push(<Row extraColumns={extraColumns} auction={a} trade={t} user={user}/>);
            });
        });
        return (<div>
                 <table>
                  <thead>
                   <tr><td colSpan={headings.length}>my trades</td></tr>
                   {headings}
                  </thead>
                  <tbody>
                   {rows}
                  </tbody>
                 </table>
                </div>);
    }
});

exports.Trades = Trades;
