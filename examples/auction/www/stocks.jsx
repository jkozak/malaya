"use strict";

var React = require('react');

var Subclass = React.createClass({
    render: function() {
        var subclass = this.props.subclass;
        return (
            <tr>
             <td>{subclass.name}</td>
             <td>{subclass.description}</td>
            </tr> );
    }
});

var Subclasses = React.createClass({
    render: function() {
        var subclasses = this.props.subclasses;
        var      nCols = 2;
        var     onPlus = function() {
        };
        return (
            <div>
             <table>
              <thead style={{fontWeight:"bold"}}>
               <tr><td colSpan={nCols} style={{textAlign:'center'}}>subclasses</td></tr>
               <tr>
                <td>name</td>
                <td>description</td>
               </tr>
              </thead>
              <tbody>
               {Object.keys(subclasses).map(function(s){return <Subclass subclass={subclasses[s]}/>;})}
               <tr>
                <td colSpan={nCols} style={{textAlign:'center'}}>
                 <button type="button" onClick={onPlus}>+ subclass</button>
                </td>
               </tr>
              </tbody>
             </table>
            </div> );
    }
});

var Stock = React.createClass({
    render: function() {
        var stock = this.props.stock;
        return (
            <tr>
             <td>{stock.name}</td>
             <td>{stock.subclass}</td>
            </tr> );
    }
});

var Stocks = React.createClass({
    render: function() {
        var stocks = this.props.stocks;
        var  nCols = 2;
        var onPlus = function() {
        };
        return (
            <div>
             <table>
              <thead style={{fontWeight:"bold"}}>
               <tr><td colSpan={nCols} style={{textAlign:'center'}}>stocks</td></tr>
               <tr>
                <td>name</td>
                <td>subclass</td>
               </tr>
              </thead>
              <tbody>
               {Object.keys(stocks).map(function(s){return <Stock stock={stocks[s]}/>;})}
               <tr>
                <td colSpan={nCols} style={{textAlign:'center'}}>
                 <button type="button" onClick={onPlus}>+ stock</button>
                </td>
               </tr>
              </tbody>
             </table>
            </div> );
    }
});

exports.Subclasses = Subclasses;

exports.Stocks     = Stocks;

