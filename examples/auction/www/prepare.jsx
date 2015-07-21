var React   = require('react');

var Prepare = exports.Prepare = React.createClass({
    render: function() {
	return (<div>
		<h2>prepare auction {this.props.auction.id}</h2>
		<p><button onClick={this.props.onStart} type="button">start</button></p>
		</div>);
    }
});