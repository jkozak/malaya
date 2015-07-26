"use strict";

var React   = require('react');

var User = React.createClass({
    render: function() {
        var user = this.props.user;
        return (<tr>
                <td>{user.name}</td>
                <td>{user.port?'\u2713':''}</td>
                </tr>);
    }
});

var Users =  React.createClass({
    render: function() {
        return (<div>
                <table>
                <thead style={{fontWeight:"bold"}}>
                 <tr><td colSpan="2" style={{textAlign:'center'}}>users</td></tr>
                 <tr>
                  <td>name</td>
                  <td>on</td>
                 </tr>
                </thead>
                <tbody>
                 {this.props.users.map(function(u){return <User user={u}/>;})}
                </tbody>
                </table>
                </div>);
    }
});

exports.Users = Users;

