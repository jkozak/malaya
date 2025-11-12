"use strict";

const  plugin = require('../plugin.js');

const    http = require('http');

// Parse a Cookie header string → { name: value, ... }
function parseCookieHeader(header = '') {
  const out = {};
  if (!header) return out;

  // Split on ; and trim pieces
  const parts = header.split(';');
  for (const part of parts) {
    if (!part) continue;
    const [rawK, ...rest] = part.split('=');
    if (!rawK) continue;
    const k = rawK.trim();
    // cookie value may contain '=' characters; join them back
    const vRaw = rest.join('=').trim();

    // RFC allows quoted-values; strip quotes if present
    const vStripped = vRaw.startsWith('"') && vRaw.endsWith('"')
      ? vRaw.slice(1, -1)
      : vRaw;

    // Try URI-decode (many libs store URL-encoded values)
    let v = vStripped;
    try { v = decodeURIComponent(vStripped); } catch { /* keep as-is */ }

    if (k) out[k] = v;
  }
  return out;
}

exports.http = plugin.add('http',class extends plugin.Plugin {
    constructor({port=3000}) {
        super();
        const pl = this;
        pl.port0  = port;
        pl.port   = null;
        pl.index  = 0;
        pl.reqs   = {};
        pl.server = null;
    }
    start(cb) {
        const pl = this;
        pl.server = http.createServer();
        pl.server.on('listening',()=>{
            pl.port = pl.server.address().port;
            super.start(cb);
        });
        pl.server.listen(pl.port0);
    }
    ready() {
        const pl = this;
        pl.using('port',pl.port);
        pl.server.on('request',(req,res)=>{
            const id = ++pl.index;
            let  buf = '';
            pl.reqs[id] = [req,res];
            req.on('data',chunk=>{buf+=chunk;});
            req.on('end',()=>{
                pl.update(['request',{
                    id,
                    method:req.method,headers:req.headers,url:req.url,
                    cookies:parseCookieHeader(req.headers.cookie),
                    body:buf
                }]);
            });
        });
    }
    stop(cb) {
        const pl = this;
        pl.server.close(()=>super.stop(cb));
        // +++ close connections +++
        pl.server = null;
    }
    out([op,args],name,addr) {
        const pl = this;
        switch (op) {
        case 'response': {
            const res = pl.reqs[args.id][1];
            delete pl.reqs[args.id];
            res.statusCode    = args.statusCode || 500;
            res.statusMessage = args.statusMessage;
            if (args.headers)
                Object.keys(args.headers).forEach(k=>res.setHeader(k,args.headers[k]));
            if (args.body)
                res.write(args.body);
            res.end();
            break;
        }
        default:
            throw new Error(`unknown ${name} out: ${op}`);
        }
    }
});
