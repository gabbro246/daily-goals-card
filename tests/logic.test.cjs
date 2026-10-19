const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../src/daily-goals-card.js'),'utf8');
const elements=new Map();
class HTMLElementStub {attachShadow(){const root={innerHTML:'',listeners:{},addEventListener(name,handler){this.listeners[name]=handler},getElementById(){return null}};this.shadowRoot=root;return root}}
const globals={Date,Math,Intl,Number,Set,Map,Array,console,HTMLElement:HTMLElementStub,window:{__DAILY_GOALS_TEST__:{}},customElements:{get(n){return elements.get(n)},define(n,cls){elements.set(n,cls)}},document:{createElement(){return {addEventListener(){},attachShadow(){return {appendChild(){}}}}}}};
vm.runInNewContext(source,globals);
const L=globals.window.__DAILY_GOALS_TEST__;
test('aggregation choices use native secondary descriptions',()=>{
 assert.equal(L.AGGREGATION_OPTIONS.length,5);
 assert.equal(L.AGGREGATION_OPTIONS.find(option=>option.value==='max').label,'Highest value per day');
 assert.match(L.AGGREGATION_OPTIONS.find(option=>option.value==='max').description,/steps/);
 assert.match(L.AGGREGATION_OPTIONS.find(option=>option.value==='change').description,/energy/);
 for(const option of L.AGGREGATION_OPTIONS){
  assert.ok(option.description.length>30);
  assert.doesNotMatch(option.label,/\(/);
 }
 assert.match(source,/name:'aggregation',selector:\{select:\{mode:'box',box_max_columns:1,options:AGGREGATION_OPTIONS\}\}/);
});
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

test('measurement entities support legacy cards and prefer plural config',()=>{
 assert.equal(Array.from(L.measurementEntities({entity:'sensor.one'})).join(','),'sensor.one');
 assert.equal(Array.from(L.measurementEntities({entity:'sensor.one',entities:['sensor.two','sensor.two']})).join(','),'sensor.two');
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
 assert.match(day,/viewBox="0 0 250 100"/);
 assert.match(day,/d="M 125 8 H 200 A 42 42/);
 assert.match(day,/stroke-dasharray="25 100"/);
});
test('compact status visuals are consistent and readable',()=>{
 assert.match(source,/\.series-value\{fill:none;stroke-linecap:butt/);
 assert.match(source,/\.series-cap\{fill:none;stroke-linecap:round/);
 assert.match(source,/\.dot\.met\{background:var\(--goal-success\)/);
 assert.match(source,/\.dot\.missed\{background:var\(--goal-error\)/);
 assert.match(source,/\.mini-dot\.met::after\{background:var\(--goal-success\)/);
 assert.match(source,/\.mini-dot\.missed::after\{border-color:var\(--goal-error\);background:var\(--goal-error\)/);
 assert.match(source,/\.dot\.no-data,.dot\.no-goal\{border-color:var\(--goal-unavailable\);border-style:dashed/);
 assert.match(source,/\.mini-dot\.future\{opacity:\.55\}/);
 assert.match(source,/\.mini-dot\.future::after\{border-color:var\(--goal-muted\)\}/);
 assert.match(source,/\.month-collection\{display:grid;grid-template-columns:repeat\(3,/);
 assert.match(source,/\.many-months\.unscrolled\{max-height:none;overflow:visible\}/);
 assert.doesNotMatch(source,/class="summary"/);
});
test('multiple measurement entities are summed only when all have data',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={entities:['sensor.one','sensor.two'],goal:100,direction:'min'};
 card._hass={config:{time_zone:'UTC'},states:{}};
 card._period={start:'2020-01-01',end:'2020-01-02'};
 card._days=[{key:'2020-01-01'},{key:'2020-01-02'}];
 card._metrics=new Map([
  ['sensor.one',new Map([['2020-01-01',30],['2020-01-02',40]])],
  ['sensor.two',new Map([['2020-01-01',70]])],
 ]);
 card._rebuildDays();
 assert.equal(card._days[0].value,100);
 assert.equal(card._days[0].status,'met');
 assert.equal(card._days[0].parts.map(part=>part.value).join(','),'30,70');
 assert.equal(card._days[1].value,null);
 assert.equal(card._days[1].status,'no-data');
});
test('current day uses stacked entity colors and a toggleable graph legend',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 const today=L.dateParts(new Date(),'UTC');
 card._config={entities:['sensor.one','sensor.two'],goal:100};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{
  'sensor.one':{attributes:{friendly_name:'First counter',unit_of_measurement:'steps'}},
  'sensor.two':{attributes:{friendly_name:'Second counter',unit_of_measurement:'steps'}},
 }};
 const row={key:today,value:50,goal:100,status:'progress',parts:[{entity:'sensor.one',value:30},{entity:'sensor.two',value:20}]};
 card._days=[row];
 const day=card._dayView(row);
 assert.match(day,/class="oval progress multi-current"/);
 assert.equal((day.match(/class="series-value/g)||[]).length,2);
 assert.equal((day.match(/class="series-cap/g)||[]).length,2);
 assert.match(day,/stroke-dasharray="0 100"/);
 assert.match(day,/stroke-dasharray="30\.000 70\.000"/);
 assert.match(day,/stroke-dasharray="20\.000 80\.000"/);
 assert.match(day,/stroke-dashoffset="-30\.000"/);
 assert.match(card._renderDot(row),/class="dot progress multi-current"/);
 const legend=card._seriesLegend();
 assert.match(legend,/First counter/);
 assert.match(legend,/30 steps/);
 assert.match(legend,/data-toggle-entity="sensor.two"/);
 card.shadowRoot.listeners.click({target:{closest:()=>({dataset:{toggleEntity:'sensor.two'}})}});
 assert.equal(card._hiddenEntities.has('sensor.two'),true);
 assert.match(card._seriesLegend(),/<li class="hidden"[^>]*>.*data-toggle-entity="sensor.two"/);
 const full={...row,value:100,status:'met',parts:[{entity:'sensor.one',value:30},{entity:'sensor.two',value:70}]};
 assert.doesNotMatch(card._dayView(full),/class="series-cap/);
 const finished={...row,key:'2020-01-01',status:'met'};
 assert.doesNotMatch(card._renderDot(finished),/series-value/);
});
test('calendar labels and long ranges use one consistent layout',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={entity:'sensor.steps',goal:100};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 card._days=[{key:'2025-01-01',value:null,goal:100,status:'no-data'}];
 const month=card._monthGrid(2025,1);
 assert.match(month,/<span class="weekday">Mon<\/span>/);
 assert.doesNotMatch(month,/<span class="weekday">M<\/span>/);
 card._days=Array.from({length:13},(_,index)=>{
  const date=new Date(Date.UTC(2025,index,1));
  return {key:date.toISOString().slice(0,10),value:null,goal:100,status:'no-data'};
 });
 const thirteen=card._miniMonths();
 assert.match(thirteen,/class="many-months unscrolled"/);
 assert.match(thirteen,/>Jan 2025<\/button>/);
 assert.match(thirteen,/>Jan 2026<\/button>/);
 card._days.push({key:'2026-02-01',value:null,goal:100,status:'no-data'});
 assert.doesNotMatch(card._miniMonths(),/class="many-months unscrolled"/);
});
test('every day view exposes toggleable day selection',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={entity:'sensor.steps',goal:100};
 card._hass={locale:{language:'en'},states:{'sensor.steps':{attributes:{unit_of_measurement:'steps'}}}};
 const row={key:'2026-10-19',value:25,goal:100,status:'progress'};
 card._days=[row];
 assert.match(card._dayView(row),/class="oval progress" data-day="2026-10-19" aria-pressed="false"/);
 assert.match(card._renderDot(row,true),/class="mini-dot progress" data-day="2026-10-19" aria-pressed="false"/);
 card._selected=row.key;
 assert.match(card._dayView(row),/aria-pressed="true"/);
 assert.match(card._dayView(row),/class="detail"/);
 assert.match(card._dayView(row),/25% of goal/);
 assert.doesNotMatch(card._dayView(row),/In progress<\/div>/);
 assert.match(card._renderDot(row,true),/aria-pressed="true"/);
 const click={target:{closest:()=>({dataset:{day:row.key}})}};
 card.shadowRoot.listeners.click(click);
 assert.equal(card._selected,null);
 card.shadowRoot.listeners.click(click);
 assert.equal(card._selected,row.key);
 assert.equal(Object.hasOwn(card.getGridOptions(),'rows'),false);
});
test('card state uses remaining amount for a day and completion count for ranges',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={goal:100,direction:'min',unit:'steps'};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 card._days=[{key:'2020-01-01',value:25,goal:100,status:'missed'}];
 assert.equal(card._stateText('day'),'75 steps left');
 assert.equal(card._percentageText(card._days[0]),'25% of goal');
 card._config.direction='max';
 assert.equal(card._stateText('day'),'75 steps remaining');
 assert.equal(card._percentageText(card._days[0]),'25% of limit');
 card._days=[
  {key:'2020-01-01',status:'met'},
  {key:'2020-01-02',status:'missed'},
  {key:'2020-01-03',status:'progress'},
  {key:'2999-01-01',status:'future'},
 ];
 assert.equal(card._stateText('week'),'1 of 3 days met');
});
