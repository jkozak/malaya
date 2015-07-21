var React = require('react');

var Logon = exports.Logon = React.createClass({
    render: function() {
	var     data = {user:this.props.user};
	var onChange = function(event) {
	    data[event.target.name] = event.target.value;
	};
	var  onLogon = function() {
	    this.props.onLogon(data);
	};
	return (
	    <form onSubmit={function(){return false;}} action="javascript:void(0);">
	    <table style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",backgroundColor:"grey"}}>
	    <tr><td colSpan="2" style={{textAlign:'center',fontWeight:'bold'}}>Malaya Auctions</td></tr>
	    <tr><td>Name</td><td><input type="text" name="user" value={data.user} onChange={onChange}></input></td></tr>
	    <tr><td>Password</td><td><input type="password" name="pw" onChange={onChange}></input></td></tr>
	    <tr><td colSpan="2"><input type="submit" value="logon" onClick={onLogon.bind(this)}></input></td></tr>
	    <tr><td colSpan="2"><span>{this.props.text}</span></td></tr>
	    </table>
	    </form>
	);
    }
});

