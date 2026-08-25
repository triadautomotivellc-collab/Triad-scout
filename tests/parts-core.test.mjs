import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePartQuery, resolveInterchange, normalizePartListing, rankPartListings,
  cheapestCompatible, rebuildBasketCost
} from '../lib/parts-core.js';

const vehicle={year:2009,make:'Chevrolet',model:'Silverado 1500',engine:'5.3L'};
const interchangeRows=[
 {interchange_group:'T-6L80-A',part_type:'Transmission',year:2009,make:'Chevrolet',model:'Silverado 1500',engine:'5.3L'},
 {interchange_group:'T-6L80-A',part_type:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe',engine:'5.3L'},
 {interchange_group:'T-6L80-A',part_type:'Transmission',year:2011,make:'GMC',model:'Sierra 1500',engine:'5.3L'},
 {interchange_group:'DOOR-LH-1',part_type:'Door Assembly',year:2017,make:'GMC',model:'Yukon',position:'LH'}
];

test('6L80 query resolves transmission alias',()=>{
 const q=parsePartQuery('6l80 transmission',vehicle);
 assert.equal(q.partType,'Transmission');
 assert.deepEqual(q.variantTokens,['6L80']);
});

test('left door query resolves LH position',()=>{
 const q=parsePartQuery('left front door',vehicle);
 assert.equal(q.partType,'Door Assembly');
 assert.equal(q.side,'LH');
});

test('licensed interchange expands compatible donor vehicles',()=>{
 const q=parsePartQuery('6l80 transmission',vehicle);
 const r=resolveInterchange(q,interchangeRows);
 assert.equal(r.resolved,true);
 assert.deepEqual(r.groupIds,['T-6L80-A']);
 assert.equal(r.compatibleVehicles.length,3);
 assert.ok(r.compatibleVehicles.some(v=>v.make==='GMC'&&v.model==='Sierra 1500'));
});

test('interchange number match outranks exact donor without interchange number',()=>{
 const q=parsePartQuery('6l80 transmission',vehicle);
 const interchange=resolveInterchange(q,interchangeRows);
 const rows=[
  normalizePartListing({stock_number:'A',part_description:'Transmission',year:2009,make:'Chevrolet',model:'Silverado 1500',price:700,shipping:0},'YardLink'),
  normalizePartListing({stock_number:'B',part_description:'Transmission',year:2011,make:'GMC',model:'Sierra 1500',interchange_number:'T-6L80-A',price:725,shipping:0},'YardLink')
 ];
 const ranked=rankPartListings(rows,q,interchange,{maxPrice:100000});
 assert.equal(ranked.length,2);
 assert.equal(ranked[0].id,'A'); // cheapest landed still wins
 assert.ok(ranked.find(x=>x.id==='B').match.confidence>ranked.find(x=>x.id==='A').match.confidence);
});

test('wrong part type is rejected',()=>{
 const q=parsePartQuery('6l80 transmission',vehicle);
 const interchange=resolveInterchange(q,interchangeRows);
 const rows=[normalizePartListing({stock_number:'X',part_description:'Engine',year:2009,make:'Chevrolet',model:'Silverado 1500',price:100},'YardLink')];
 assert.equal(rankPartListings(rows,q,interchange,{maxPrice:100000}).length,0);
});

test('cheapest compatible uses landed cost including shipping/core',()=>{
 const q=parsePartQuery('6l80 transmission',vehicle);
 const interchange=resolveInterchange(q,interchangeRows);
 const rows=[
  {stock_number:'cheap-list',part_description:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe',interchange_number:'T-6L80-A',price:500,shipping:400,core_charge:150},
  {stock_number:'better-landed',part_description:'Transmission',year:2011,make:'GMC',model:'Sierra 1500',interchange_number:'T-6L80-A',price:700,shipping:50,core_charge:0}
 ];
 const best=cheapestCompatible(rows.map(x=>normalizePartListing(x,'YardLink')),q,interchange,{maxPrice:100000});
 assert.equal(best.id,'better-landed');
 assert.equal(best.landed.total,750);
});

test('default parts cap supports $100k',()=>{
 const q=parsePartQuery('engine',vehicle);
 const rows=[normalizePartListing({stock_number:'E',part_description:'Engine',year:2009,make:'Chevrolet',model:'Silverado 1500',price:99999},'YardLink')];
 const ranked=rankPartListings(rows,q,{compatibleVehicles:[],groupIds:[]},{maxPrice:100000});
 assert.equal(ranked.length,1);
});

test('rebuild basket sums cheapest compatible parts and reports unresolved',()=>{
 const transQ=parsePartQuery('6l80 transmission',vehicle);
 const transInter=resolveInterchange(transQ,interchangeRows);
 const inventory=[normalizePartListing({stock_number:'T',part_description:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe',interchange_number:'T-6L80-A',price:800,shipping:100},'YardLink')];
 const basket=rebuildBasketCost([{partType:'Transmission',vehicle},{partType:'Headlamp Assembly',vehicle}],inventory,{'Transmission':transInter},{maxPrice:100000});
 assert.equal(basket.total,900);
 assert.equal(basket.resolved,1);
 assert.equal(basket.unresolved,1);
 assert.equal(basket.complete,false);
});
