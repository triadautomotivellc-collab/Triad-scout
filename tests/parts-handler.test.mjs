import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/parts-search.js';

function resMock(){return {statusCode:200,payload:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.payload=v;return this;}}}

const vehicle={year:2009,make:'Chevrolet',model:'Silverado 1500',engine:'5.3L'};

test('parts endpoint uses YardLink and licensed interchange without external connectors',async()=>{
 delete process.env.HOLLANDER_CONNECTOR_URL;delete process.env.CARPART_CONNECTOR_URL;delete process.env.EDEN_CONNECTOR_URL;
 const req={method:'POST',body:{query:'6l80 transmission',vehicle,max_price:100000,
  licensed_interchange:[
   {interchange_group:'G1',part_type:'Transmission',year:2009,make:'Chevrolet',model:'Silverado 1500'},
   {interchange_group:'G1',part_type:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe'}
  ],
  yardlink_inventory:[
   {stock_number:'P1',yard_name:'Test Yard',part_description:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe',interchange_number:'G1',price:650,shipping:100}
  ]}};
 const res=resMock();await handler(req,res);
 assert.equal(res.statusCode,200);assert.equal(res.payload.ok,true);assert.equal(res.payload.interchange.resolved,true);assert.equal(res.payload.parts.length,1);assert.equal(res.payload.cheapest.landed.total,750);
 const hollander=res.payload.providers.find(p=>p.id==='hollander');assert.equal(hollander.status,'not_configured');
});

test('parts endpoint refuses empty query',async()=>{
 const res=resMock();await handler({method:'POST',body:{query:'',vehicle}},res);assert.equal(res.statusCode,400);
});

test('authorized connector payload includes resolved interchange groups',async()=>{
 process.env.HOLLANDER_CONNECTOR_URL='https://adapter.test/search';process.env.HOLLANDER_CONNECTOR_KEY='secret';
 const seen=[];
 globalThis.fetch=async(_url,opts)=>{seen.push(JSON.parse(opts.body));return new Response(JSON.stringify({parts:[{stock_number:'H1',yard_name:'Licensed Yard',part_description:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe',interchange_number:'G1',price:500}]}),{status:200,headers:{'content-type':'application/json'}})};
 const res=resMock();await handler({method:'POST',body:{query:'6l80 transmission',vehicle,licensed_interchange:[{interchange_group:'G1',part_type:'Transmission',year:2009,make:'Chevrolet',model:'Silverado 1500'},{interchange_group:'G1',part_type:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe'}]}},res);
 assert.equal(res.statusCode,200);assert.ok(seen.length>=1);assert.deepEqual(seen[0].interchange.group_ids,['G1']);assert.equal(res.payload.parts.length,1);
 delete process.env.HOLLANDER_CONNECTOR_URL;delete process.env.HOLLANDER_CONNECTOR_KEY;
});


test('vehicle-only query returns without calling licensed parts connectors',async()=>{
 let called=false;
 globalThis.fetch=async()=>{called=true;throw new Error('connector should not be called')};
 const req={method:'POST',body:{query:'camaro',vehicle:{},yardlink_inventory:[],licensed_interchange:[]}};
 const res=resMock();
 await handler(req,res);
 assert.equal(res.statusCode,200);
 assert.equal(res.payload.intent,'vehicle_only');
 assert.equal(res.payload.query.partType,'');
 assert.deepEqual(res.payload.parts,[]);
 assert.equal(called,false);
});
