"use strict";

var React   = require('react');

var Row = React.createClass({
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
        var     bid = null;
        var   offer = null;
        var  bought = 0;
        var    sold = 0;
        auction.prices.forEach(function(p) {
            if (p.user===props.user && p.stock===stock) {
                if (p.buy)
                    bid   = p.volume;
                else
                    offer = p.volume;
            }
        });
        auction.trades.forEach(function(t) {
            if (t.stock===stock) {
                if (t.buyer===props.user)
                    bought += t.volume;
                if (t.seller===props.user)
                    sold += t.volume;
            }
        });
        console.log("*** stock: ",stock,bid,offer,bought,sold);
        return (
            <tr>
            <td>{bought===0?'':bought}</td>
            <td>
            <select id={'sb'+stock} value={bid} onChange={onPC(true)}>
            {[0,5,10,15,20].map(function(n) {
                return (<option value={n}>{n}</option>);
            })}
            </select>
            </td>
            <td>
            {stock}
            </td>
            <td>
            
            <select id={'ss'+stock} value={offer} onChange={onPC(false)}>
            {[0,5,10,15,20].map(function(n){
                return (<option value={n}>{n}</option>);
            })}
            </select>
            </td>
            <td>{sold===0?'':sold}</td>
            </tr> );
    }
});

var Auction = React.createClass({
    render: function() {
        var   props = this.props;
        var auction = props.auction;
        switch(auction.state) {
        case 'ready':
        return (<div>
                <h2>prepare auction {auction.id}</h2>
                <p><button onClick={this.props.onStart} type="button">start</button></p>
                </div>);
        case 'run':
            return (
                <div>
                <h2>auction {auction.id}</h2>
                <table>
                <thead>
                <tr><td>bought</td><td>buy</td><td>stock</td><td>sell</td><td>sold</td></tr>
                </thead>
                <tbody>
                {auction.stocks.map(function(s) {
                    return (<Row user={props.user} onPriceChange={props.onPriceChange} auction={auction} stock={s}/>);
                })}
                </tbody>
                </table>
                </div> );
        case 'ended':
        case 'done':
            return (
                <div>
                auction {auction.id} finished.
                </div> );
        }
    }
});

exports.Auction = Auction;
