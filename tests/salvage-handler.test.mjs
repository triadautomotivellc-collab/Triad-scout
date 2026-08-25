import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/salvage-search.js';

function response(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}})}
function mockRes(){return {statusCode:200,headers:{},payload:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.payload=v;return this}}}
const originalFetch=globalThis.fetch, originalKey=process.env.SALVAGEALERT_KEY;
test.afterEach(()=>{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.SALVAGEALERT_KEY;else process.env.SALVAGEALERT_KEY=originalKey});

test('Camaro SS sends Camaro model and filters LT',async()=>{
 process.env.SALVAGEALERT_KEY='test';
 globalThis.fetch=async(_u,o)=>{const b=JSON.parse(o.body);assert.deepEqual(b.models,['Camaro']);return response({lots:[
  {source:b.source,lot_number:'1',make:'CHEVROLET',model:'CAMARO',trim:'SS'},
  {source:b.source,lot_number:'2',make:'CHEVROLET',model:'CAMARO',trim:'LT'}]})};
 const res=mockRes();await handler({method:'POST',body:{source:'copart_us',query:'camaro ss'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.payload.lots.length,1);assert.equal(res.payload.lots[0].trim,'SS');
});

test('smart stops when IAA has enough',async()=>{
 process.env.SALVAGEALERT_KEY='test';let calls=0;
 globalThis.fetch=async(_u,o)=>{calls++;const b=JSON.parse(o.body);assert.equal(b.source,'iaai_us');return response({lots:[
  {source:'iaai_us',lot_number:'1',make:'CHEVROLET',model:'CAMARO',trim:'SS'},
  {source:'iaai_us',lot_number:'2',make:'CHEVROLET',model:'CAMARO',trim:'SS'}]})};
 const res=mockRes();await handler({method:'POST',body:{source:'smart',query:'camaro ss',smart_min:2}},res);
 assert.equal(calls,1);assert.equal(res.payload.lots.length,2);assert.equal(res.payload.strategy,'smart');
});

test('smart falls through when IAA has no verified trim',async()=>{
 process.env.SALVAGEALERT_KEY='test';const seen=[];
 globalThis.fetch=async(_u,o)=>{const b=JSON.parse(o.body);seen.push(b.source);
  if(b.source==='iaai_us')return response({lots:[{source:b.source,lot_number:'x',make:'CHEVROLET',model:'CAMARO',trim:'LT'}]});
  if(b.source==='copart_us')return response({lots:[{source:b.source,lot_number:'y',make:'CHEVROLET',model:'CAMARO',trim:'SS'}]});
  return response({lots:[]});
 };
 const res=mockRes();await handler({method:'POST',body:{source:'smart',query:'camaro ss',smart_min:1}},res);
 assert.deepEqual(seen,['iaai_us','copart_us']);assert.equal(res.payload.lots.length,1);
});

test('one-source failure does not kill all-source search',async()=>{
 process.env.SALVAGEALERT_KEY='test';
 globalThis.fetch=async(_u,o)=>{const b=JSON.parse(o.body);if(b.source==='iaai_us')return response({error:'x'},503);return response({lots:[{source:b.source,lot_number:b.source,make:'FORD',model:'Explorer'}]})};
 const res=mockRes();await handler({method:'POST',body:{source:'all',query:'explorer'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.payload.lots.length,2);assert.equal(res.payload.sources.length,3);
});

test('zero verified is valid empty success',async()=>{
 process.env.SALVAGEALERT_KEY='test';globalThis.fetch=async()=>response({lots:[{make:'TOYOTA',model:'CAMRY'}]});
 const res=mockRes();await handler({method:'POST',body:{source:'copart_us',query:'camaro ss'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.payload.ok,true);assert.deepEqual(res.payload.lots,[]);
});
