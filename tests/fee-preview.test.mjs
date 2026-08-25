import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/fee-preview.js';
function resMock(){return {statusCode:200,payload:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.payload=v;return this;}}}

test('fee preview returns Copart fee without external API call',async()=>{
 const res=resMock();await handler({method:'POST',body:{source:'Copart',bid:5000,titleStatus:'Salvage',profile:{bidMode:'live',copartProfileConfirmed:true}}},res);assert.equal(res.statusCode,200);assert.equal(res.payload.fee.known,true);assert.ok(res.payload.fee.total>0);
});

test('IAA fee preview remains unknown without user override',async()=>{
 const res=resMock();await handler({method:'POST',body:{source:'IAA',bid:5000,titleStatus:'Salvage',profile:{}}},res);assert.equal(res.statusCode,200);assert.equal(res.payload.fee.known,false);
});
