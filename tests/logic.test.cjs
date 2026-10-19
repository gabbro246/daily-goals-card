const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../src/daily-goals-card.js'),'utf8');
const elements=new Map();
class HTMLElementStub {attachShadow(){const root={innerHTML:'',addEventListener(){}};this.shadowRoot=root;return root}}
const globals={Date,Math,Intl,Number,Set,Map,Array,console,HTMLElement:HTMLElementStub,window:{__DAILY_GOALS_TEST__:{}},customElements:{get(n){return elements.get(n)},define(n,cls){elements.set(n,cls)}},document:{createElement(){return {addEventListener(){},attachShadow(){return {appendChild(){}}}}}}};
vm.runInNewContext(source,globals);
const L=globals.window.__DAILY_GOALS_TEST__;
test('day range and leap-year months',()=>{
 assert.equal(L.keyPlus('2026-10-31',1),'2026-11-01');
 assert.equal(L.dayDiff('2026-09-01','2026-09-30'),29);
 assert.equal(L.daysInMonth(2024,2),29);
 assert.equal(L.makeKeys('2026-09-22','2026-09-24').join(','),'2026-09-22,2026-09-23,2026-09-24');
 assert.throws(()=>L.makeKeys('2024-01-01','2026-12-31'),/no more than 750/);
});
test('time zone boundaries handle daylight saving',()=>{
 assert.equal(L.zonedMidnight('2026-03-29','Europe/Vienna').toISOString(),'2026-03-28T23:00:00.000Z');
 assert.equal(L.zonedMidnight('2026-03-30','Europe/Vienna').toISOString(),'2026-03-29T22:00:00.000Z');
 assert.equal(L.zonedMidnight('2026-10-25','Europe/Vienna').toISOString(),'2026-10-24T22:00:00.000Z');
 assert.equal(L.zonedMidnight('2026-10-26','Europe/Vienna').toISOString(),'2026-10-25T23:00:00.000Z');
});
test('minimum and maximum direction with zero and absent data',()=>{
 assert.equal(L.evaluate(0,6000,'min','2026-09-20','2026-10-18'),'missed');
 assert.equal(L.evaluate(0,10,'max','2026-09-20','2026-10-18'),'met');
 assert.equal(L.evaluate(null,10,'max','2026-09-20','2026-10-18'),'no-data');
 assert.equal(L.evaluate(6,10,'max','2026-10-18','2026-10-18'),'progress');
 assert.equal(L.evaluate(12,10,'max','2026-10-18','2026-10-18'),'missed');
 assert.equal(L.evaluate(6400,6000,'min','2026-10-18','2026-10-18'),'met');
 assert.equal(L.evaluate(0,null,'min','2026-09-20','2026-10-18'),'no-goal');
 assert.equal(L.evaluate(0,10,'min','2026-10-19','2026-10-18'),'future');
 assert.equal(L.evaluate(0,0,'max','2026-09-20','2026-10-18'),'met');
 assert.equal(L.evaluate(1,0,'max','2026-09-20','2026-10-18'),'missed');
});
test('recorded daily zero kept separate from missing',()=>{
 const map=L.dailyFromStats([{start:Date.parse('2026-09-22T00:00:00Z'),max:0,change:0},{start:Date.parse('2026-09-23T00:00:00Z'),max:2440,change:2440}],'max','UTC');
 assert.equal(map.get('2026-09-22'),0);
 assert.equal(map.get('2026-09-23'),2440);
 assert.equal(map.has('2026-09-24'),false);
});
test('goal state can change every day in history',()=>{
 const states=[{last_updated:'2026-09-21T05:00:00Z',state:'5000'},{last_updated:'2026-09-22T05:00:00Z',state:'6000'}];
 const targets=L.goalFromHistory(states,'UTC','2026-09-21','2026-09-23');
 assert.equal(targets.get('2026-09-21'),5000);
 assert.equal(targets.get('2026-09-22'),6000);
 assert.equal(targets.get('2026-09-23'),6000);
});
test('history change requires baseline instead of guessing',()=>{
 const states=[{last_updated:'2026-09-22T00:00:00Z',state:'100'},{last_updated:'2026-09-22T12:00:00Z',state:'125'}];
 const result=L.dailyFromHistory(states,'change','UTC','2026-09-22','2026-09-22');
 assert.equal(result.has('2026-09-22'),false);
});
test('daily views based on selected range boundaries',()=>{
 const layout=(a,b)=>L.getLayout(L.makeKeys(a,b));
 assert.equal(layout('2026-09-23','2026-09-23'),'day');
 assert.equal(layout('2026-09-21','2026-09-27'),'week');
 assert.equal(layout('2026-09-01','2026-09-30'),'month');
 assert.equal(layout('2026-01-01','2026-12-31'),'year');
 assert.equal(layout('2026-09-18','2026-10-05'),'months');
 assert.equal(layout('2026-01-22','2026-08-25'),'mini-months');
});
test('energy collection key matches HA connection property',()=>{
 const collection={start:new Date('2026-09-01')};
 assert.equal(L.relevantEnergyCollection({connection:{_energy_lovelace:collection},panelUrl:'lovelace'},undefined),collection);
 assert.equal(L.relevantEnergyCollection({connection:{_energy_custom:collection},panelUrl:'lovelace'},'energy_custom'),collection);
});

test('progress indicators begin at 12 o’clock and advance clockwise',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 const ring=card._progressRing(25);
 assert.match(ring,/stroke-dasharray="25 100"/);
 assert.match(ring,/transform="rotate\(-90 16 16\)"/);
 card._config={entity:'sensor.steps',goal:100};
 card._hass={locale:{language:'en'},states:{'sensor.steps':{attributes:{unit_of_measurement:'steps'}}}};
 const day=card._dayView({key:'2026-10-19',value:25,goal:100,status:'progress'});
 assert.match(day,/d="M 190 12 H 307/);
 assert.match(day,/stroke-dasharray="25 100"/);
});