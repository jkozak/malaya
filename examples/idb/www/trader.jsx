var React     = require('react');
var ReactTabs = require('react-tabs');
var Tab       = ReactTabs.Tab;
var Tabs      = ReactTabs.Tabs;
var TabList   = ReactTabs.TabList;
var TabPanel  = ReactTabs.TabPanel;

var SubClassSectionHeading = React.createClass({
    render: function() {
	return (
	    <tr><td style={{backgroundColor:'lightgrey',color:'blue',fontSize:'70%'}} colSpan='8'>
	       {this.props.name}
	    </td></tr>
	);
    }
});

var sdot = String.fromCharCode(8729); // vertically centred dot (interpunct)

var fmtPrice = function(p) {
    if (p===null)
	return ['',''];
    
    var ss = p.toString().split('.');
    if (ss.length===1)
	return [ss[0],''];
    else if (ss.length===2)
	return [ss[0],sdot+ss[1]];
    else
	return '???'
};

var Instrument = React.createClass({
    shouldComponentUpdate: function(nextProps,nextState) {
	// +++ also check for deletion +++
	return !!nextProps.market.prices[nextProps.instrument.id];
    },
    getInitialState: function() {
	var prices = this.props.market.prices[this.props.instrument.id]; // !!! bad !!!
	return {fresh:false,nPrices:prices?prices.length:0};
    },
    componentWillReceiveProps: function(props) {
	var       inst = this;
	var nextPrices = props.market.prices[props.instrument.id];
	if (nextPrices && nextPrices.length!==this.state.nPrices) {
	    inst.setState({fresh:true,nPrices:nextPrices.length});
	    setTimeout(function() {	// new instrument wait
		inst.setState({fresh:false});
	    },15000);
	}
    },
    render: function() {
	var     bid = null;
	var   offer = null;
	var    bidC = 'black';
	var  offerC = 'black';
	var   bidBG = 'transparent';
	var offerBG = 'transparent';
	var    bidV = '';
	var  offerV = '';

	var  price = this.props.market.prices[this.props.instrument.id];

	if (price) {
	    var trade = this.props.market.trades[this.props.instrument.id];
	    // price = {rate,bids:[{id,counterparty,volume},...],offers}
	    if (price.bids.length>0) {
		bid  = price.rate;;
		bidV = 0;
		price.bids.forEach(function(v){bidV+=v.volume;});
		bidV /= 1000000;
		if (this.state.fresh) {
		    var x = bidBG;
		    bidBG = bidC;
		    bidC  = 'white';
		}
	    }
	    if (price.offers.length>0) {
		offer  = price.rate;;
		offerV = 0;
		price.offers.forEach(function(v){offerV+=v.volume;});
		offerV /= 1000000;
		if (this.state.fresh) {
		    var x = offerBG;
		    offerBG = offerC;
		    offerC  = 'white';
		}
	    }
	}

	if (bid===null) {
	    var bf = this.props.market.bigFigs[this.props.instrument.id];
	    if (bf && bf.bid) {
		bid = bf.bid|0;
		bidC = 'lightgrey';
	    }
	}
	if (offer===null) {
	    var bf = this.props.market.bigFigs[this.props.instrument.id];
	    if (bf && bf.offer) {
		offer = bf.offer|0;
		offerC = 'lightgrey';
	    }
	}
	
	var   bidS = fmtPrice(bid);
	var offerS = fmtPrice(offer);
	console.log("*** bidV ",bidV);
	return (
	    <tr>
	     <td>{this.props.instrument.name}</td>
	     <td style={{textAlign:'right',padding:0,color:bidC,backgroundColor:bidBG,minWidth:'3em'}}>{bidS[0]}</td>
	     <td style={{color:bidC,backgroundColor:bidBG,minWidth:'3em'}}>{bidS[1]}</td>
	     <td style={{textAlign:'right',padding:0,color:offerC,backgroundColor:offerBG,minWidth:'3em'}}>{offerS[0]}</td>
	     <td style={{color:offerC,backgroundColor:offerBG,minWidth:'3em'}}>{offerS[1]}</td>
	     <td style={{textAlign:'right',padding:0}}>{bidV}</td>
	     <td style={{textAlign:'center',color:'grey',padding:0}}>X</td>
	     <td>{offerV}</td>
	    </tr>
	);
    }
});

var Blotter = exports.Blotter = React.createClass({
    render: function() {
	var               rows = [];
	var             lastSC = -1;
	var         subClasses = this.props.subClasses;
	var             market = this.props.market;
	var orderedInstruments = [];
	for (var k in this.props.instruments) {
	    var inst = this.props.instruments[k];
	    var    o = {};
	    o.name        = inst.name;
	    o.subClass    = inst.subClass;
	    o.maturity    = inst.maturity;
	    o.id          = k;
	    o.bid         = '';
	    o.offer       = '';
	    o.bidVolume   = '';
	    o.offerVolume = '';
	    if (inst.visible)
		orderedInstruments.push(o);
	}
	var sortKey = function(inst) {
	    return inst.subClass*1000*1000*1000+inst.maturity;
	};
	orderedInstruments.sort(function(inst1,inst2) {
	    return sortKey(inst1)-sortKey(inst2);
	});
	orderedInstruments.forEach(function(inst) {
	    if (lastSC!==inst.subClass) {
		rows.push(<SubClassSectionHeading key={'S'+inst.subClass} name={subClasses[inst.subClass].title}/>);
		lastSC = inst.subClass;
		}
	    rows.push(<Instrument key={'I'+inst.id} instrument={inst} market={market}/>);
	});
	return (
	    <table style={{fontFamily:'Verdana',fontSize:'12px',fontWeight:'bold',borderCollapse:'collapse'}}>
	    <thead>
	    <tr style={{backgroundColor:'black',color:'white'}}><th>stock</th><th colSpan='2'>bid</th><th colSpan='2'>offer</th><th colSpan='3'>vols</th></tr>
	    </thead>
	    {rows}
	    </table> );
    }
});

var Trader = exports.Trader = React.createClass({
    handleSelect: function(index,previous){
	console.log("*** handleSelect: %j %j",index,previous);
    },
    render: function() {
	return (
	    <Tabs onSelect={this.handleSelect} selectedIndex={0}>
	    <TabList>
	     <Tab>all</Tab>
	     <Tab>custom 1</Tab>
	     <Tab>custom 2</Tab>
	     <Tab>custom 3</Tab>
	    </TabList>
	    <TabPanel><Blotter instruments={this.props.instruments} subClasses={this.props.subClasses} market={this.props.market}/></TabPanel>
	    <TabPanel>custom one</TabPanel>
	    <TabPanel>custom two</TabPanel>
	    <TabPanel>custom three</TabPanel>
	    </Tabs>)
    }
});

