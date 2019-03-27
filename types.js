"use strict";

// type system

// scalar types:
//  Number  (should be refined)
//  String
//  null

// aggregates:
//  Or(T,...)
//  Record(<name>:T,...)
//  Map(String,T)         -- always String pro tem (JSON)
//  List(T)
//  Tuple(T,...)

const   _ = require('underscore');

class TypeError extends Error {}

const Type = exports.Type = class {
    constructor() {
        this.bindings = null;
    }
    toString() {
        return this.constructor.name || '??type';
    }
    instancedBy(x) {
        throw new Error('SNO');
    }
    equal(type) {
        return _.isEqual(this,type);
    }
    unify(type) {
        // +++ stop infinite recursion +++
        if (this.equal(type))
            return this;
        else
            return type.unify(this);
    }
};

const Var = exports.Var = new class Var extends Type {
    constructor(name) {
        super();
        this.name = name;
    }
    instancedBy(x) {
        const type = this.bindings[this.name];
        if (type)
            return type.instancedBy(x);
        throw new Error('NYI');
    }
    unify(type) {
        const type1 = this.bindings[this.name];
        if (type1)
            return type1.unify(type);
        else {
            this.bindings[this.name] = type;
            return type;
        }
    }
};

const Void = exports.Void = new class Void extends Type {  // eslint-disable-line no-unused-vars
    instancedBy(x) {
        return false;
    }
};

const Bool = exports.Bool = new class Bool extends Type {  // eslint-disable-line no-unused-vars
    instancedBy(x) {
        return [true,false].includes(x);
    }
};

const Numeric = exports.Numeric = class extends Type {
};

const Number = exports.Number = new class extends Type {   // eslint-disable-line no-unused-vars
    toString() {
        return 'Number';
    }
    instancedBy(x) {
        return typeof x==='number';
    }
};

const Int = exports.Int = class extends Numeric {          // eslint-disable-line no-unused-vars
    constructor(signed,bits) {
        super();
        this.signed = signed;
        this.bits   = bits;
    }
    toString() {
        return `${this.signed?'':'U'}Int${this.bits||''}`;
    }
    instancedBy(x) {
        if (typeof x==='number' && x===Math.floor(x)) {
            if (this.signed) {
                if (!this.bits)
                    return true;
                else
                    return Math.abs(x)<Math.pow(2,this.bits-1);
            } else {
                if (x<0)
                    return false;
                else if (!this.bits)
                    return true;
                else
                    return x<Math.pow(2,this.bits);
            }
        } else
            return false;
    }
};

exports.UInt1  = new Int(false,1);
exports.UInt2  = new Int(false,2);
exports.UInt4  = new Int(false,4);
exports.UInt8  = new Int(false,8);
exports.UInt16 = new Int(false,16);
exports.UInt24 = new Int(false,24);
exports.UInt32 = new Int(false,32);

exports.Int4  = new Int(true,4);
exports.Int8  = new Int(true,8);
exports.Int16 = new Int(true,16);
exports.Int24 = new Int(true,24);
exports.Int32 = new Int(true,32);

const String = exports.String = new class extends Type {   // eslint-disable-line no-unused-vars
    toString() {
        return `String`;
    }
    instancedBy(x) {
        return typeof x==='string';
    }
};

const Null = exports.Null = new class Null extends Type {  // eslint-disable-line no-unused-vars
    instancedBy(x) {
        return x===null;
    }
};

const Or = exports.Or = class extends Type {               // eslint-disable-line no-unused-vars
    constructor(types) {        // types :: [<type>,...]
        super();
        this.types = types;
    }
    toString() {
        return `Or(${this.types.map(t=>t.toString()).join(',')})`;
    }
    instancedBy(x) {
        for (const t of this.types)
            if (t.instancedBy(x))
                return true;
        return false;
    }
    unify(type) {
        for (const t of this.types)
            if (type.equal(t))
                return this;
        return Or(this.types.concat([type]));
    }
};

const Record = exports.Record = class extends Type {       // eslint-disable-line no-unused-vars
    constructor(fields) {       // fields :: {<name>:<type>,...}
        super();
        this.fields = fields;
    }
    toString() {
        const flds = Object.keys(this.fields).map(k=>`${k}:${this.fields[k].toString()}`);
        return `Record(${flds.join(',')})`;
    }
    instancedBy(x) {
        if (typeof x!=='object' || x===null)
            return false;
        if (Object.keys(x).length!==Object.keys(this.fields).length)
            return false;
        for (const k in this.fields)
            if (!this.fields[k].instancedBy(x[k]))
                return false;
        return true;
    }
};

const Map = exports.Map = class extends Type {             // eslint-disable-line no-unused-vars
    constructor(key,type) {  // type :: <type>
        super();
        if (key!==String)
            throw new TypeError(`key type must be String`);
        this.key  = key;
        this.type = type;
    }
    toString() {
        return `Map(String,${this.type.toString()})`;
    }
    instancedBy(x) {
        if (typeof x!=='object')
            return false;
        for (const k in x)
            if (!this.type.instancedBy(x[k]))
                return false;
        return true;
    }
};

const List = exports.List = class extends Type {           // eslint-disable-line no-unused-vars
    constructor(type) {
        super();
        this.type = type;
    }
    toString() {
        return `List(${this.type.toString()})`;
    }
    instancedBy(xs) {
        if (!Array.isArray(xs))
            return false;
        for (const x of xs)
            if (!this.type.instancedBy(x))
                return false;
        return true;
    }
};

const Tuple = exports.Tuple = class extends Type {         // eslint-disable-line no-unused-vars
    constructor(types) {        // types :: [<type>,...]
        super();
        this.types = types;
    }
    toString() {
        return `Tuple(${this.types.map(t=>t.toString()).join(',')})`;
    }
    instancedBy(xs) {
        if (!Array.isArray(xs) || xs.length!==this.types.length)
            return false;
        for (const i in xs)
            if (!this.types[i].instancedBy(xs[i]))
                return false;
        return true;
    }
};

const Any = exports.Any = new class extends Type {         // eslint-disable-line no-unused-vars
    instancedBy(x) {
        return true;
    }
};

const Const = exports.Const = class extends Type {         // eslint-disable-line no-unused-vars
    constructor(value) {
        super();
        this.value = value;
    }
    toString() {
        return `Const(${JSON.stringify(this.value)})`;
    }
    instancedBy(x) {
        return _.isEqual(x,this.value);
    }
};

const Function = exports.Function = class extends Type {      // eslint-disable-line no-unused-vars
    constructor(args,ret) {
        super();
        this.args = args;       // [<type>,...]
        this.ret  = ret;
    }
    toString() {
        return `(${this.args.map(a=>a.toString()).join(',')})=>${this.ret.toString()}`;
    }
    instancedBy(x) {
        throw new Error('NYI');
    }
};

function walk(type,fn) {
    fn(type);
    Object.keys(type).forEach(k=>{
        const v = type[k];
        if (v instanceof Type)
            walk(v,fn);
        else if (Array.isArray(v))
            v.forEach(w=>{
                if (w instanceof Type)
                    walk(w,fn);
            });
        else if (typeof v==='object' && v!==null)
            Object.keys(v).forEach(k1=>{
                if (v[k1] instanceof Type)
                    walk(v[k1],fn);
            });
    });
}

const findVars = type=>{
    const o = {};
    walk(type,t=>{
        if (t instanceof Var)
            o[t.name] = true;
    });
    return Object.keys(o);
}

const reset = exports.reset = type=>{                         // eslint-disable-line no-unused-vars
    const bindings = {};
    findVars(type).forEach(v=>{bindings[v]=null;});
    walk(type,t=>{t.bindings=bindings;});
}

const NoMatch = exports.NoMatch = class extends TypeError {}; // eslint-disable-line no-unused-vars

exports.fromEst = (est,bindings)=>{ // bindings: name->type
    switch (est.type) {
    case 'Identifier': {
        //const t = bindings[est.name];
        throw new NoMatch(`NYI: ${JSON.stringify(est)}`);
    }
    default:
        throw new NoMatch(JSON.stringify(est));
    }
    // returns updated bindings or throws NoMatch
};

const unify = exports.unify = types=>{
    if (types.length===0)
        return null;
    else if (types.length===1)
        return types[0];
    else
        return types[0].unify(unify(types.slice(1)));
};
