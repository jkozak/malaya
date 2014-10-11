var _ = require("underscore");
var fs = require("fs");
var exec = require("child_process").exec;

var dateToYYYYMMDD = function(md) {
    var d = new Date(md).toISOString();
    return d.substr(0, 4) + d.substr(5, 2) + d.substr(8, 2);
};

var IDB = function() {
    var store = this;
    var _ = require("underscore");
    var assert = require("assert");
    var ee = new (require("events").EventEmitter)();

    // must be > 0 always?
    var t = 1;

    // 't' -> fact; this is the main fact store
    var facts = {};

    var adds = [];
    var dels = [];
    var err = null;

    var _add = function(fact) {
        if (fact instanceof Array && fact.length > 0) {
            // `t_fact` is a string
            var t_fact = "" + t++;

            facts[t_fact] = fact;
            adds.push(t_fact);

            switch (fact[0]) {
            case "logon":
                rules[0][0](t_fact);
                rules[1][0](t_fact);
                rules[2][0](t_fact);
                rules[3][0](t_fact);
                break;
            case "Permissions":
                rules[0][1](t_fact);
                rules[1][1](t_fact);
                rules[2][1](t_fact);
                break;
            }

            return t_fact;
        } else
            throw new Error("unloved fact format: " + JSON.stringify(fact));
    };

    var obj = {
        on: function(ev, cb) {
            ee.on(ev, cb);
        },

        once: function(ev, cb) {
            ee.once(ev, cb);
        },

        get: function(t) {
            assert.equal(typeof t, "string");
            return facts[t];
        },

        add: function(fact) {
            assert.strictEqual(adds.length, 0);
            assert.strictEqual(dels.length, 0);
            _add(fact);
            ee.emit("fire", obj, fact, adds, dels);

            var ans = {
                err: null,
                adds: adds,
                dels: dels
            };

            adds = [];
            dels = [];
            return ans;
        },

        get t() {
            return t;
        },

        get queries() {
            return queries;
        },

        reset: function() {
            t = 1;
            facts = {};
            init();
        },

        // business logic protocol
        get_root: function() {
            return {
                t: obj.t,
                facts: obj.facts
            };
        },

        set_root: function(r) {
            obj.t = r.t;
            obj.facts = r.facts;
        },

        update: function(u) {
            return obj.add(u);
        }
    };

    if (process.env.NODE_ENV === "test") obj._private = {
        get facts() {
            return facts;
        },

        get size() {
            return Object.keys(facts).length;
        }
    };

    var rules = [[function(t_fact) {
        var fact;
        var in_play = [];

        {
            var user_, password_, Password_, rs_;
            fact = facts[t_fact];

            if (fact === undefined)
                return;

            if (in_play.indexOf(t_fact) === -1) {
                in_play.push(t_fact);

                if ("logon" === fact[0]) {
                    password_ = fact[1].password;
                    user_ = fact[1].user;

                    for (var t1 in facts) if (in_play.indexOf(t1) === -1) {
                        in_play.push(t1);
                        fact = facts[t1];

                        if (false === fact[1].LoggedOn && _.isEqual(user_, fact[1].ApplicationName) && "Permissions" === fact[0]) {
                            rs_ = _.omit(fact[1], "ApplicationName", "Password", "LoggedOn");
                            Password_ = fact[1].Password;

                            if (Password_.trimRight() === password_) {
                                var del_t;
                                del_t = adds.indexOf(t_fact);

                                if (del_t !== -1)
                                    adds.splice(del_t, 1);
                                else
                                    dels.push(facts[t_fact]);

                                delete facts[t_fact];
                                del_t = adds.indexOf(t1);

                                if (del_t !== -1)
                                    adds.splice(del_t, 1);
                                else
                                    dels.push(facts[t1]);

                                delete facts[t1];

                                var t3 = _add(["Permissions", _.extend(rs_, {
                                    ApplicationName: user_,
                                    Password: Password_,
                                    LoggedOn: true
                                })]);
                            }
                        }

                        in_play.pop();
                    }
                }

                in_play.pop();
            }
        }
    }, function(t_fact) {
        var fact;
        var in_play = [];

        {
            var user_, password_, Password_, rs_;

            for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                in_play.push(t0);
                fact = facts[t0];

                if ("logon" === fact[0]) {
                    password_ = fact[1].password;
                    user_ = fact[1].user;
                    fact = facts[t_fact];

                    if (fact === undefined)
                        return;

                    if (in_play.indexOf(t_fact) === -1) {
                        in_play.push(t_fact);

                        if (false === fact[1].LoggedOn && _.isEqual(user_, fact[1].ApplicationName) && "Permissions" === fact[0]) {
                            rs_ = _.omit(fact[1], "ApplicationName", "Password", "LoggedOn");
                            Password_ = fact[1].Password;

                            if (Password_.trimRight() === password_) {
                                var del_t;
                                del_t = adds.indexOf(t0);

                                if (del_t !== -1)
                                    adds.splice(del_t, 1);
                                else
                                    dels.push(facts[t0]);

                                delete facts[t0];
                                del_t = adds.indexOf(t_fact);

                                if (del_t !== -1)
                                    adds.splice(del_t, 1);
                                else
                                    dels.push(facts[t_fact]);

                                delete facts[t_fact];

                                var t3 = _add(["Permissions", _.extend(rs_, {
                                    ApplicationName: user_,
                                    Password: Password_,
                                    LoggedOn: true
                                })]);
                            }
                        }

                        in_play.pop();
                    }
                }

                in_play.pop();
            }
        }
    }], [function(t_fact) {
        var fact;
        var in_play = [];

        {
            var user_, password_, Password_, rs_;
            fact = facts[t_fact];

            if (fact === undefined)
                return;

            if (in_play.indexOf(t_fact) === -1) {
                in_play.push(t_fact);

                if ("logon" === fact[0]) {
                    password_ = fact[1].password;
                    user_ = fact[1].user;

                    for (var t1 in facts) if (in_play.indexOf(t1) === -1) {
                        in_play.push(t1);
                        fact = facts[t1];

                        if (true === fact[1].LoggedOn && _.isEqual(user_, fact[1].ApplicationName) && "Permissions" === fact[0]) {
                            rs_ = _.omit(fact[1], "ApplicationName", "Password", "LoggedOn");
                            Password_ = fact[1].Password;

                            if (Password_.trimRight() === password_) {
                                var del_t;
                                del_t = adds.indexOf(t_fact);

                                if (del_t !== -1)
                                    adds.splice(del_t, 1);
                                else
                                    dels.push(facts[t_fact]);

                                delete facts[t_fact];
                                var t3 = _add(["msg", user_, "already logged on"]);
                            }
                        }

                        in_play.pop();
                    }
                }

                in_play.pop();
            }
        }
    }, function(t_fact) {
        var fact;
        var in_play = [];

        {
            var user_, password_, Password_, rs_;

            for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                in_play.push(t0);
                fact = facts[t0];

                if ("logon" === fact[0]) {
                    password_ = fact[1].password;
                    user_ = fact[1].user;
                    fact = facts[t_fact];

                    if (fact === undefined)
                        return;

                    if (in_play.indexOf(t_fact) === -1) {
                        in_play.push(t_fact);

                        if (true === fact[1].LoggedOn && _.isEqual(user_, fact[1].ApplicationName) && "Permissions" === fact[0]) {
                            rs_ = _.omit(fact[1], "ApplicationName", "Password", "LoggedOn");
                            Password_ = fact[1].Password;

                            if (Password_.trimRight() === password_) {
                                var del_t;
                                del_t = adds.indexOf(t0);

                                if (del_t !== -1)
                                    adds.splice(del_t, 1);
                                else
                                    dels.push(facts[t0]);

                                delete facts[t0];
                                var t3 = _add(["msg", user_, "already logged on"]);
                            }
                        }

                        in_play.pop();
                    }
                }

                in_play.pop();
            }
        }
    }], [function(t_fact) {
        var fact;
        var in_play = [];

        {
            var user_, password_, rs_;
            fact = facts[t_fact];

            if (fact === undefined)
                return;

            if (in_play.indexOf(t_fact) === -1) {
                in_play.push(t_fact);

                if ("logon" === fact[0]) {
                    password_ = fact[1].password;
                    user_ = fact[1].user;

                    for (var t1 in facts) if (in_play.indexOf(t1) === -1) {
                        in_play.push(t1);
                        fact = facts[t1];

                        if (_.isEqual(user_, fact[1].ApplicationName) && "Permissions" === fact[0]) {
                            rs_ = _.omit(fact[1], "ApplicationName");
                            var del_t;
                            del_t = adds.indexOf(t_fact);

                            if (del_t !== -1)
                                adds.splice(del_t, 1);
                            else
                                dels.push(facts[t_fact]);

                            delete facts[t_fact];
                            var t2 = _add(["msg", user_, "bad password"]);
                        }

                        in_play.pop();
                    }
                }

                in_play.pop();
            }
        }
    }, function(t_fact) {
        var fact;
        var in_play = [];

        {
            var user_, password_, rs_;

            for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                in_play.push(t0);
                fact = facts[t0];

                if ("logon" === fact[0]) {
                    password_ = fact[1].password;
                    user_ = fact[1].user;
                    fact = facts[t_fact];

                    if (fact === undefined)
                        return;

                    if (in_play.indexOf(t_fact) === -1) {
                        in_play.push(t_fact);

                        if (_.isEqual(user_, fact[1].ApplicationName) && "Permissions" === fact[0]) {
                            rs_ = _.omit(fact[1], "ApplicationName");
                            var del_t;
                            del_t = adds.indexOf(t0);

                            if (del_t !== -1)
                                adds.splice(del_t, 1);
                            else
                                dels.push(facts[t0]);

                            delete facts[t0];
                            var t2 = _add(["msg", user_, "bad password"]);
                        }

                        in_play.pop();
                    }
                }

                in_play.pop();
            }
        }
    }], [function(t_fact) {
        var fact;
        var in_play = [];

        {
            var user_, password_;
            fact = facts[t_fact];

            if (fact === undefined)
                return;

            if (in_play.indexOf(t_fact) === -1) {
                in_play.push(t_fact);

                if ("logon" === fact[0]) {
                    password_ = fact[1].password;
                    user_ = fact[1].user;
                    var del_t;
                    del_t = adds.indexOf(t_fact);

                    if (del_t !== -1)
                        adds.splice(del_t, 1);
                    else
                        dels.push(facts[t_fact]);

                    delete facts[t_fact];
                    var t1 = _add(["msg", user_, "user unknown"]);
                }

                in_play.pop();
            }
        }
    }]];

    var queries = {
        users: function() {
            var a_ = [];
            var fact;
            var in_play = [];

            {
                var ApplicationID_, ApplicationName_;

                for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                    in_play.push(t0);
                    fact = facts[t0];

                    if ("Permissions" === fact[0]) {
                        ApplicationName_ = fact[1].ApplicationName;
                        ApplicationID_ = fact[1].ApplicationID;
                        a_ = a_.concat([[ApplicationID_, ApplicationName_]]);
                    }

                    in_play.pop();
                }
            }

            return {
                t: t,
                result: a_
            };
        },

        user: function(appId_) {
            var a_ = [];
            var fact;
            var in_play = [];

            {
                var rs_;

                for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                    in_play.push(t0);
                    fact = facts[t0];

                    if (_.isEqual(appId_, fact[1].ApplicationID) && "Permissions" === fact[0]) {
                        rs_ = _.omit(fact[1], "ApplicationID");
                        a_ = a_.concat([rs_]);
                    }

                    in_play.pop();
                }
            }

            return {
                t: t,
                result: a_
            };
        },

        staticdata: function() {
            var a_ = [];
            var fact;
            var in_play = [];

            {
                var appId_, teamId_, companyId_, team_;

                for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                    in_play.push(t0);
                    fact = facts[t0];

                    if ("Permissions" === fact[0]) {
                        companyId_ = fact[1].CompanyID;
                        teamId_ = fact[1].TeamID;
                        appId_ = fact[1].ApplicationID;

                        for (var t1 in facts) if (in_play.indexOf(t1) === -1) {
                            in_play.push(t1);
                            fact = facts[t1];

                            if (_.isEqual(teamId_, fact[1].TeamID) && "Team" === fact[0]) {
                                team_ = fact[1].TeamName;

                                a_ = a_.concat([{
                                    app: appId_,
                                    team: teamId_,
                                    Name: companyId_
                                }]);
                            }

                            in_play.pop();
                        }
                    }

                    in_play.pop();
                }
            }

            return {
                t: t,
                result: a_
            };
        },

        instruments: function(appId_) {
            var a_ = [];
            var fact;
            var in_play = [];

            {
                var inst_;

                for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                    in_play.push(t0);
                    fact = facts[t0];

                    if ("Instrument" === fact[0]) {
                        inst_ = fact[1];

                        a_ = a_.concat([{
                            ID: inst_.InstID,
                            Name: inst_.InstName,
                            SubClass: inst_.InstSubClassID,
                            Maturity: dateToYYYYMMDD(inst_.MaturityDate),
                            "new": 0,
                            Visible: inst_.VisibleFlag,
                            Description: inst_.InstDesc,
                            AuctionInstTitle: inst_.AuctionInstTitle,
                            PriceTick: inst_.PriceTick
                        }]);
                    }

                    in_play.pop();
                }
            }

            return {
                t: t,
                result: a_
            };
        },

        subclasses: function() {
            var a_ = [];
            var fact;
            var in_play = [];

            {
                var sc_;

                for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                    in_play.push(t0);
                    fact = facts[t0];

                    if ("InstrumentClass" === fact[0]) {
                        sc_ = fact[1];

                        a_ = a_.concat([{
                            ID: sc_.InstSubClassID,
                            Name: sc_.InstSubClassName,
                            AssociatedTitleID: sc_.AssociatedTitle,
                            Title: sc_.Title,
                            DefltVol: sc_.DefaultVolume,
                            PriceTick: sc_.PriceTick,
                            ShowSign: sc_.Display_ShowPlusMinus,
                            xBidMinus1: sc_.Match_xBidMinus1,
                            AuctionVolumes: sc_.AuctionVolumes
                        }]);
                    }

                    in_play.pop();
                }
            }

            return {
                t: t,
                result: a_
            };
        },

        cookie: function(appId_, id_) {
            var a_ = [];
            var fact;
            var in_play = [];

            {
                var Cookie_;

                for (var t0 in facts) if (in_play.indexOf(t0) === -1) {
                    in_play.push(t0);
                    fact = facts[t0];

                    if (_.isEqual(id_, fact[1].CookieID) && _.isEqual(appId_, fact[1].ApplicationID) && "Cookies" === fact[0]) {
                        Cookie_ = fact[1].Cookie;
                        a_ = a_.concat(Cookie_);
                    }

                    in_play.pop();
                }
            }

            return {
                t: t,
                result: a_
            };
        }
    };

    var init = function() {};
    init();
    return obj;
}();

if (false) {
    var json = JSON.parse(fs.readFileSync("init_db.json"));

    for (var i in json) {
        IDB.add(json[i]);
    }
} else {
    var child = exec("python import_init_db.py ~/giltking/thrift/tests/init_db.py", {
        maxBuffer: 10 * 1024 * 1024
    }, function(err, stdout, stderr) {
        var json = JSON.parse(stdout);

        for (var i in json)
            IDB.add(json[i]);
    });

    child.on("exit", function(code, signal) {
        if (code !== 0)
            console.log("failed: %j", code);
    });

    child.on("close", function() {
        var resp = IDB.add(["logon", {
            user: "John Kozak",
            password: "kvass2"
        }]);

        console.log("*** logon resp: %j", resp);

        console.log("*** logon resp.adds: %j", _.map(resp.adds, function(t) {
            return IDB.get(t);
        }));

        console.log("*** JK: %j", IDB.queries.user(51));
    });
}