
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../src/daily-goals-card.js'),'utf8');
const elements=new Map();
class HTMLElementStub {attachShadow(){const root={innerHTML:'',listeners:{},children:[],addEventListener(name,handler){this.listeners[name]=handler},appendChild(child){this.children.push(child)},getElementById(){return null}};this.shadowRoot=root;return root}}
const storedValues=new Map();
const globals={Date,Math,Intl,Number,Set,Map,Array,console,setInterval(){return 1},clearInterval(){},HTMLElement:HTMLElementStub,window:{__DAILY_GOALS_TEST__:{},localStorage:{getItem(key){return storedValues.get(key)??null},setItem(key,value){storedValues.set(key,value)}}},customElements:{get(n){return elements.get(n)},define(n,cls){elements.set(n,cls)}},document:{createElement(){return {addEventListener(){},attachShadow(){return {appendChild(){}}}}}}};
vm.runInNewContext(source,globals);
const L=globals.window.__DAILY_GOALS_TEST__;
test('aggregation choices use native secondary descriptions',()=>{
 assert.equal(L.AGGREGATION_OPTIONS.length,5);
 assert.equal(L.AGGREGATION_OPTIONS.find(option=>option.value==='max').label,'Highest value per day');
 assert.match(L.AGGREGATION_OPTIONS.find(option=>option.value==='max').description,/single high reading/);
 assert.match(L.AGGREGATION_OPTIONS.find(option=>option.value==='change').description,/carries over from one day to the next/);
 assert.match(L.AGGREGATION_OPTIONS.find(option=>option.value==='state').description,/ignores earlier readings/);
 assert.match(L.AGGREGATION_OPTIONS.find(option=>option.value==='mean').description,/brief high or low reading/);
 assert.match(L.AGGREGATION_OPTIONS.find(option=>option.value==='min').description,/single low reading/);
 for(const option of L.AGGREGATION_OPTIONS){
  assert.match(option.description,/^Uses /);
  assert.match(option.description,/Choose this /);
  assert.doesNotMatch(option.label,/\(/);
 }
 const aggregation=L.localizedFormSchema('en').find(field=>field.name==='aggregation').selector.select;
 assert.equal(aggregation.mode,'box');
 assert.equal(aggregation.box_max_columns,1);
 assert.equal(aggregation.options.length,5);
});
test('day range and leap-year months',()=>{
 assert.equal(L.keyPlus('2026-10-31',1),'2026-11-01');
 assert.equal(L.dayDiff('2026-09-01','2026-09-30'),29);
 assert.equal(L.daysInMonth(2024,2),29);
 assert.equal(L.makeKeys('2026-09-22','2026-09-24').join(','),'2026-09-22,2026-09-23,2026-09-24');
 assert.throws(()=>L.makeKeys('2024-01-01','2026-12-31'),/no more than 750/);
 assert.equal(L.weekOffset(2025,1),2);
 assert.equal(L.weekOffset(2025,1,1,true),3);
 assert.equal(L.weekdayLabels('en',false)[0],'Mon');
 assert.equal(L.weekdayLabels('en',true)[0],'Sun');
 assert.equal(L.weekStartsSunday({}),false);
 assert.equal(L.weekStartsSunday({start_week_on_sunday:true}),true);
 const weekStart=L.localizedFormSchema('en').find(field=>field.name==='start_week_on_sunday');
 assert.equal(typeof weekStart.selector.boolean,'object');
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
 assert.equal(layout('2026-09-19','2026-10-19'),'rolling-month');
 assert.equal(layout('2026-01-01','2026-12-31'),'year');
 assert.equal(layout('2026-09-18','2026-10-05'),'months');
 assert.equal(layout('2026-01-22','2026-08-25'),'mini-months');
});
test('energy collection key matches HA connection property',()=>{
 const collection={start:new Date('2026-09-01')};
 assert.equal(L.relevantEnergyCollection({connection:{_energy_lovelace:collection},panelUrl:'lovelace'},undefined),collection);
 assert.equal(L.relevantEnergyCollection({connection:{_energy_custom:collection},panelUrl:'lovelace'},'energy_custom'),collection);
 assert.equal(L.relevantEnergyCollection({connection:{_energy:collection},panelUrl:'lovelace'},undefined),null);
 assert.equal(L.relevantEnergyCollection({connection:{_energy:collection}},undefined),collection);
});

test('an interrupted history load restarts after reconnect',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={entity:'sensor.energy',goal:10};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{},connection:{},panelUrl:'lovelace'};
 let loads=0;
 card._load=()=>{loads++;card._loading=true};
 card._syncPeriod(true);
 assert.equal(loads,1);
 card.connectedCallback();
 assert.equal(loads,1);
 card.disconnectedCallback();
 assert.equal(card._loading,false);
 assert.equal(card._restartOnConnect,true);
 card.connectedCallback();
 assert.equal(loads,2);
 assert.equal(card._restartOnConnect,false);
 card.disconnectedCallback();
});

test('measurement entities support legacy cards and prefer plural config',()=>{
 assert.equal(Array.from(L.measurementEntities({entity:'sensor.one'})).join(','),'sensor.one');
 assert.equal(Array.from(L.measurementEntities({entity:'sensor.one',entities:['sensor.two','sensor.two']})).join(','),'sensor.two');
});
test('legend visibility is controlled by one boolean setting',()=>{
 const Card=elements.get('daily-goals-card');
 assert.equal(Card.getStubConfig({},['sensor.one']).show_legend,false);
 assert.equal(L.shouldShowLegend({entities:['sensor.one']}),false);
 assert.equal(L.shouldShowLegend({entities:['sensor.one','sensor.two']}),false);
 assert.equal(L.shouldShowLegend({entities:['sensor.one'],show_legend:true}),true);
 assert.equal(L.shouldShowLegend({entities:['sensor.one','sensor.two'],show_legend:false}),false);
 const legend=L.localizedFormSchema('en').find(field=>field.name==='show_legend');
 assert.equal(typeof legend.selector.boolean,'object');
});
test('day states have independent filled, outlined, and symbol styles',()=>{
 const Card=elements.get('daily-goals-card');
 const stub=Card.getStubConfig({},['sensor.one']);
 assert.equal(stub.success_style,'filled');
 assert.equal(stub.failure_style,'filled');
 assert.equal(stub.no_data_style,'outline');
 assert.equal(stub.start_week_on_sunday,false);
 assert.equal(L.finishedStyle({}),'filled');
 assert.equal(L.finishedStyle({finished_style:'outline'}),'outline');
 assert.equal(L.finishedStyle({finished_style:'symbols'}),'symbols');
 assert.equal(L.finishedStyle({finished_style:'invalid'}),'filled');
 assert.equal(L.markerStyle({},'met'),'filled');
 assert.equal(L.markerStyle({},'missed'),'filled');
 assert.equal(L.markerStyle({},'no-data'),'outline');
 assert.equal(L.markerStyle({finished_style:'outline'},'met'),'outline');
 assert.equal(L.markerStyle({finished_style:'symbols'},'missed'),'symbols');
 assert.equal(L.markerStyle({finished_style:'symbols',success_style:'filled'},'met'),'filled');
 assert.equal(L.markerStyle({success_style:'filled',failure_style:'symbols',no_data_style:'symbols'},'missed'),'symbols');
 assert.equal(L.markerStyle({no_data_style:'filled'},'no-data'),'filled');
 assert.equal(L.markerStyle({no_data_style:'filled'},'no-goal'),'filled');
 assert.equal(L.STYLE_ROWS.length,3);
 const Editor=elements.get('daily-goals-card-editor');
 const editor=new Editor();
 editor.setConfig({entity:'sensor.steps',goal:100});
 assert.equal(editor._styles.className,'style-grid');
 assert.match(editor._styles.innerHTML,/type="radio" name="success_style"/);
 assert.match(editor._styles.innerHTML,/type="radio" name="failure_style"/);
 assert.match(editor._styles.innerHTML,/type="radio" name="no_data_style"/);
 const card=new Card();
 card._config={entity:'sensor.steps',goal:100};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 const met={key:'2020-01-01',value:100,goal:100,status:'met'};
 const missed={key:'2020-01-02',value:20,goal:100,status:'missed'};
 const noData={key:'2020-01-03',value:null,goal:100,status:'no-data'};
 const noGoal={key:'2020-01-04',value:20,goal:null,status:'no-goal'};
 assert.match(card._renderDot(met),/class="dot met marker-filled"/);
 card._config.success_style='outline';
 assert.match(card._renderDot(met),/class="dot met marker-outline"/);
 card._config.failure_style='symbols';
 assert.match(card._renderDot(missed,true),/class="mini-dot missed marker-symbols"/);
 assert.match(card._renderDot(missed),/<span>&times;<\/span>/);
 card._config.success_style='symbols';
 assert.match(card._renderDot(met),/<span>&#10003;<\/span>/);
 assert.match(card._renderDot(met,true),/class="mini-dot met marker-symbols"/);
 card._config.no_data_style='outline';
 assert.match(card._renderDot(noData),/class="unavailable-ring"/);
 assert.match(card._renderDot(noData),/<span>3<\/span>/);
 card._config.no_data_style='symbols';
 for(const row of [noData,noGoal,{...noGoal,value:null}]){
  const symbol=card._renderDot(row),miniSymbol=card._renderDot(row,true);
  assert.match(symbol,/marker-symbols"/);
  assert.match(symbol,/<span>–<\/span>/);
  assert.doesNotMatch(symbol,/unavailable-ring/);
  assert.match(miniSymbol,/marker-symbols"/);
  assert.doesNotMatch(miniSymbol,/unavailable-ring/);
 }
 card._config.no_data_style='outline';
 assert.match(card._renderDot(noGoal),/unavailable-ring/);
 assert.throws(()=>card.setConfig({entity:'sensor.steps',goal:100,failure_style:'invalid'}),/failure_style/);
 assert.throws(()=>card.setConfig({entity:'sensor.steps',goal:100,start_week_on_sunday:'yes'}),/start_week_on_sunday/);
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
 assert.match(day,/stroke-width="10"/);
 assert.match(day,/stroke-dasharray="25 100"/);
});
test('status colors, sizes, and outlines are consistent within each visual scale',()=>{
 assert.match(source,/\.series-value\{fill:none;stroke-linecap:butt/);
 assert.match(source,/\.series-cap\{fill:none;stroke-linecap:round/);
 assert.match(source,/\.subtitle,.weekday,.month-button,.series-legend li,.detail\{font-size:var\(--ha-font-size-s,12px\);font-weight:var\(--ha-font-weight-normal,400\)/);
 assert.match(source,/\.weekday,.month-button\{color:var\(--goal-muted\)\}/);
 assert.match(source,/--goal-success:var\([^\n]+#43a047/);
 assert.match(source,/--goal-error:var\([^\n]+#db4437/);
 assert.doesNotMatch(source,/goal-small-(?:met|missed)/);
 assert.match(source,/\.dot\{border:3px solid var\(--goal-track\)[^\n]+width:32px;height:32px/);
 assert.match(source,/\.mini-dot\{[^\n]+width:12px;height:12px/);
 assert.match(source,/\.mini-dot::after\{[^\n]+border:1\.5px solid var\(--goal-track\)/);
 assert.match(source,/\.dot\.met,.mini-dot\.met\{--marker-color:var\(--goal-success\)/);
 assert.match(source,/\.dot\.missed,.mini-dot\.missed\{--marker-color:var\(--goal-error\)/);
 assert.match(source,/\.dot\.met,.dot\.missed,.mini-dot\.met::after,.mini-dot\.missed::after\{background:var\(--marker-color\);border-color:var\(--marker-color\)/);
 assert.match(source,/\.dot\.progress,.dot\.multi-current\{border-width:0\}/);
 assert.match(source,/\.unavailable-ring circle\{fill:none;stroke:var\(--goal-unavailable\);stroke-linecap:round\}/);
 assert.match(source,/\.dot\.future\{border-color:var\(--goal-unavailable\);color:var\(--goal-unavailable\)\}/);
 assert.match(source,/\.mini-dot\.future::after\{border-color:var\(--goal-unavailable\)\}/);
 assert.doesNotMatch(source,/\.dot\.future\{opacity:/);
 assert.doesNotMatch(source,/\.mini-dot\.future\{opacity:/);
 assert.doesNotMatch(source,/\.month-grid \.dot\{width:clamp/);
 assert.doesNotMatch(source,/\.strip \.dot\{width:28px/);
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
 card._config={entities:['sensor.one','sensor.two'],goal:100,show_legend:true};
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
 assert.match(day,/class="series-value[^"]*"[^>]+stroke-width="10"/);
 assert.equal((day.match(/class="series-value"[^>]+stroke-linecap="butt"/g)||[]).length,2);
 assert.equal((day.match(/class="series-cap"[^>]+stroke-linecap="round"/g)||[]).length,2);
 assert.match(day,/stroke-dasharray="0 100"/);
 assert.match(day,/stroke-dasharray="30\.000 70\.000"/);
 assert.match(day,/stroke-dasharray="20\.000 80\.000"/);
 assert.match(day,/stroke-dashoffset="-30\.000"/);
 const dot=card._renderDot(row);
 assert.match(dot,/class="dot progress multi-current"/);
 assert.match(dot,/stroke-width="3"/);
 assert.equal((dot.match(/class="series-value"[^>]+stroke-linecap="butt"/g)||[]).length,2);
 assert.equal((dot.match(/class="series-cap"[^>]+stroke-linecap="round"/g)||[]).length,2);
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
 card._config.show_legend=false;
 assert.equal(card._seriesLegend(),'');
 card._config={entities:['sensor.one'],goal:100,show_legend:true};
 card._days=[{...row,parts:[{entity:'sensor.one',value:30}]}];
 const singleLegend=card._seriesLegend();
 assert.match(singleLegend,/First counter/);
 assert.doesNotMatch(singleLegend,/data-toggle-entity/);
});
test('rolling month and progress rings use fixed marker scales',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 const today=L.dateParts(new Date(),'UTC');
 card._config={entity:'sensor.steps',goal:100};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 const unavailable=card._unavailableRing();
 assert.match(unavailable,/viewBox="0 0 32 32".*r="14\.5".*pathLength="21".*stroke-width="3".*stroke-dasharray="1 2"/);
 const miniUnavailable=card._unavailableRing(true);
 assert.match(miniUnavailable,/viewBox="0 0 12 12".*r="5\.25".*pathLength="15".*stroke-width="1\.5".*stroke-dasharray="1 2"/);
 card._days=L.makeKeys(L.keyPlus(today,-30),today).map(key=>({key,value:25,goal:100,status:key===today?'progress':'missed',parts:[{entity:'sensor.steps',value:25}]}));
 const rolling=card._rollingMonthView();
 assert.match(rolling,/class="month-grid"/);
 assert.doesNotMatch(rolling,/class="mini-grid"/);
 assert.match(card._weekView(),/stroke-width="3"/);
 assert.match(rolling,/stroke-width="3"/);
 assert.match(card._renderDot(card._days.at(-1),true),/viewBox="0 0 12 12".*r="5\.25".*stroke-width="1\.5"/);
 card._days=L.makeKeys(L.keyPlus(today,-365),today).map(key=>({key,value:25,goal:100,status:key===today?'progress':'missed',parts:[{entity:'sensor.steps',value:25}]}));
 assert.match(card._miniMonths(),/stroke-width="1\.5"/);
 assert.doesNotMatch(card._miniMonths(),/stroke-width="2.75"/);
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
test('short ranges show weekday headings once and calendars can start on Sunday',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={entity:'sensor.steps',goal:100};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 card._days=L.makeKeys('2026-10-12','2026-10-19').map(key=>({key,value:20,goal:100,status:'missed'}));
 const week=card._weekView();
 assert.equal((week.match(/class="weekday"/g)||[]).length,7);
 assert.equal((week.match(/class="dot missed/g)||[]).length,8);
 assert.equal((week.match(/>Mon<\/span>/g)||[]).length,1);
 assert.match(week,/style="--day-columns:7"/);
 assert.doesNotMatch(week,/class="cell"/);
 assert.match(card._monthGrid(2025,1),/class="weekday">Mon<\/span>/);
 card._config.start_week_on_sunday=true;
 assert.match(card._monthGrid(2025,1),/class="weekday">Sun<\/span>/);
 const rolling=card._rollingMonthView();
 assert.match(rolling,/class="weekday">Sun<\/span>/);
});
test('every day view exposes toggleable day selection',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={entity:'sensor.steps',goal:100};
 card._hass={locale:{language:'en'},states:{'sensor.steps':{attributes:{unit_of_measurement:'steps'}}}};
 const row={key:'2026-10-19',value:25,goal:100,status:'progress'};
 card._days=[row];
 const collapsedDay=card._dayView(row);
 assert.match(collapsedDay,/class="oval progress" data-day="2026-10-19" aria-pressed="false"/);
 assert.doesNotMatch(collapsedDay,/class="calculation"/);
 assert.match(card._renderDot(row,true),/class="mini-dot progress" data-day="2026-10-19" aria-pressed="false"/);
 card._selected=row.key;
 const selectedDay=card._dayView(row);
 assert.match(selectedDay,/aria-pressed="true"/);
 assert.match(selectedDay,/class="detail oval-detail"/);
 assert.match(selectedDay,/class="calculation">Highest<\/span><strong class="measurement">25<\/strong><span class="unit">steps/);
 assert.equal((selectedDay.match(/>25</g)||[]).length,1);
 assert.doesNotMatch(selectedDay,/<strong>Highest 25 steps<\/strong>/);
 assert.match(selectedDay,/25% of goal/);
 assert.match(selectedDay,/class="detail oval-detail"[\s\S]*<\/button><\/div>$/);
 assert.doesNotMatch(selectedDay,/In progress<\/div>/);
 assert.match(card._weekView(),/<\/div><span class="detail">/);
 assert.match(card._renderDot(row,true),/aria-pressed="true"/);
 const click={target:{closest:()=>({dataset:{day:row.key}})}};
 card.shadowRoot.listeners.click(click);
 assert.equal(card._selected,null);
 assert.doesNotMatch(card._dayView(row),/class="calculation"/);
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
 assert.equal(card._stateText('week'),'100 steps or less on 1 of 3 days');
});
test('selected-day details identify every aggregation and summaries show changing goals',()=>{
 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 card._selected='2020-01-01';
 card._days=[{key:'2020-01-01',value:10,goal:20,status:'missed'}];
 const labels={max:'Highest',change:'Total change',state:'Last value',mean:'Average',min:'Lowest'};
 for(const [aggregation,label] of Object.entries(labels)){
  card._config={aggregation,goal:20,direction:'min',unit:'ms'};
  assert.match(card._selectionDetail(),new RegExp(`<strong>${label} 10 ms<\\/strong>`));
 }
 card._days=[
  {key:'2020-01-01',value:10,goal:20,status:'missed'},
  {key:'2020-01-02',value:30,goal:25,status:'met'},
 ];
 assert.equal(card._summaryText(),'20–25 ms or more on 1 of 2 days');
 card._config.direction='max';
 assert.equal(card._summaryText(),'20–25 ms or less on 1 of 2 days');
});
test('German translations cover the card and visual editor',()=>{
 assert.equal(L.translate('de-DE','goalMet'),'Ziel erreicht');
 assert.equal(L.translate('de','ofGoal',{value:'25'}),'25 % des Ziels');
 assert.equal(L.translate('fr','goalMet'),'Goal met');
 assert.equal(L.translate('de','limitLine'),'Limit');
 assert.throws(()=>L.makeKeys('2024-01-01','2026-12-31','de'),/höchstens 750 Tagen/);

 const options=L.localizedAggregationOptions('de-AT');
 assert.equal(options.find(option=>option.value==='max').label,'Höchster Tageswert');
 assert.match(options.find(option=>option.value==='change').description,/fortlaufenden Zählers/);
 const schema=L.localizedFormSchema('de');
 assert.equal(schema.find(field=>field.name==='direction').selector.select.options[0].label,'Mindestens (Minimum)');
 assert.equal(schema.find(field=>field.name==='aggregation').selector.select.options[4].label,'Niedrigster Tageswert');

 const Card=elements.get('daily-goals-card');
 const card=new Card();
 card._config={entities:['sensor.one','sensor.two'],goal:100,direction:'min',unit:'Schritte',show_legend:true};
 card._hass={config:{time_zone:'UTC'},locale:{language:'de-DE'},states:{
  'sensor.one':{attributes:{friendly_name:'Erster Zähler'}},
  'sensor.two':{attributes:{friendly_name:'Zweiter Zähler'}},
 }};
 card._days=[
  {key:'2020-01-01',value:25,goal:100,status:'missed',parts:[]},
  {key:'2020-01-02',value:100,goal:100,status:'met',parts:[]},
 ];
 assert.equal(card._label(card._days[1]),'Ziel erreicht');
 assert.equal(card._stateText('day'),'Noch 75 Schritte');
 assert.equal(card._percentageText(card._days[0]),'25 % des Ziels');
 assert.equal(card._stateText('week'),'Mindestens 100 Schritte an 1 von 2 Tagen');
 card._days=[{key:L.dateParts(new Date(),'UTC'),value:50,goal:100,status:'progress',parts:[{entity:'sensor.one',value:30},{entity:'sensor.two',value:20}]}];
 card._selected=card._days[0].key;
 card._config.aggregation='mean';
 assert.match(card._selectionDetail(),/Durchschnitt 50 Schritte/);
 assert.match(card._seriesLegend(),/aria-label="Messentitäten"/);
 assert.match(card._seriesLegend(),/aria-label="Ausblenden Erster Zähler"/);

 const Editor=elements.get('daily-goals-card-editor');
 const editor=new Editor();
 editor.hass={locale:{language:'de'}};
 assert.equal(editor._form.computeLabel({name:'entities'}),'Messentitäten');
 assert.match(editor._styles.innerHTML,/Darstellung der Tagesmarkierungen/);
 assert.match(editor._styles.innerHTML,/Ausgefüllt/);
});

test('appearance changes preserve selection and an in-flight history request',async()=>{
 const card=new (elements.get('daily-goals-card'))();
 let requests=0,finish;
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{},callWS(){requests++;return new Promise(resolve=>{finish=resolve})}};
 const config={entity:'sensor.steps',goal:100};
 card.setConfig(config);
 card._selected=card._period.start;
 card._selectedMonth=card._period.start.slice(0,7);
 card._hiddenEntities.add('sensor.steps');
 const selection=card._selected,month=card._selectedMonth,fetchId=card._fetchId;
 card.setConfig({...config,title:'Steps',icon:'mdi:walk',success_style:'symbols',failure_style:'outline',no_data_style:'filled',show_legend:true,start_week_on_sunday:true,unit:'steps',precision:2});
 assert.equal(requests,1);
 assert.equal(card._fetchId,fetchId);
 assert.equal(card._loading,true);
 assert.equal(card._selected,selection);
 assert.equal(card._selectedMonth,month);
 assert.equal(card._hiddenEntities.has('sensor.steps'),true);
 finish({'sensor.steps':[{start:new Date().toISOString(),max:25}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(card._loading,false);
 assert.equal(card._days[0].value,25);
 assert.equal(card._config.title,'Steps');
 assert.equal(card._selected,selection);
});

test('only history inputs reload while goal rules re-evaluate locally',()=>{
 const card=new (elements.get('daily-goals-card'))();
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 let requests=0;
 card._load=()=>{requests++};
 card.setConfig({entity:'sensor.steps',goal:100});
 assert.equal(requests,1);
 card.setConfig({entities:['sensor.steps','sensor.steps'],goal:'100',aggregation:'max',direction:'min'});
 assert.equal(requests,1);

 const key='2020-01-01';
 card._days=[{key}];
 card._metrics=new Map([['sensor.steps',new Map([[key,150]])]]);
 card._targets=new Map();
 card._selected=key;
 card._selectedMonth='2020-01';
 card.setConfig({...card._config,goal:200});
 assert.equal(requests,1);
 assert.equal(card._days[0].goal,200);
 assert.equal(card._days[0].status,'missed');
 assert.equal(card._selected,key);
 assert.equal(card._selectedMonth,'2020-01');
 card.setConfig({...card._config,direction:'max'});
 assert.equal(requests,1);
 assert.equal(card._days[0].status,'met');
 assert.equal(card._selected,key);

 for(const change of [{entities:['sensor.other']},{aggregation:'mean'},{goal_entity:'input_number.target'},{collection_key:'energy_other'}]){
  const before=requests;
  card._selected=key;
  card.setConfig({...card._config,...change});
  assert.equal(requests,before+1,JSON.stringify(change));
  assert.equal(card._selected,null);
 }
});

test('unchanged Energy periods skip repeated date conversion',()=>{
 let datePartsCalls=0;
 const trackedIntl={
  DateTimeFormat:function(...args){
   const fmt=new Intl.DateTimeFormat(...args),parts=fmt.formatToParts.bind(fmt);
   fmt.formatToParts=(date)=>{datePartsCalls++;return parts(date)};
   return fmt;
  },
  NumberFormat:Intl.NumberFormat,
 };
 const registered=new Map();
 vm.runInNewContext(source,{...globals,Intl:trackedIntl,window:{},customElements:{get:name=>registered.get(name),define:(name,cls)=>registered.set(name,cls)}});
 const card=new (registered.get('daily-goals-card'))();
 const collection={start:new Date('2026-10-01T00:00:00Z'),end:new Date('2026-10-02T00:00:00Z')};
 card._config={entity:'sensor.steps',goal:100};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{},connection:{_energy:collection}};
 let loads=0;
 card._load=()=>{loads++};
 card._syncPeriod();
 assert.equal(loads,1);
 assert.equal(datePartsCalls,2);
 card._syncPeriod();
 assert.equal(loads,1);
 assert.equal(datePartsCalls,2);
 collection.end=new Date('2026-10-03T00:00:00Z');
 card._syncPeriod();
 assert.equal(loads,2);
 assert.equal(datePartsCalls,4);
});

test('renders reuse formatters and refresh shared values when settings change',()=>{
 let dates=0,numbers=0,datePartsCalls=0;
 const trackedIntl={
  DateTimeFormat:function(...args){
   dates++;
   const fmt=new Intl.DateTimeFormat(...args),parts=fmt.formatToParts.bind(fmt);
   fmt.formatToParts=(date)=>{datePartsCalls++;return parts(date)};
   return fmt;
  },
  NumberFormat:function(...args){numbers++;return new Intl.NumberFormat(...args)},
 };
 const registered=new Map();
 vm.runInNewContext(source,{...globals,Intl:trackedIntl,window:{},customElements:{get:name=>registered.get(name),define:(name,cls)=>registered.set(name,cls)}});
 const card=new (registered.get('daily-goals-card'))();
 const root={innerHTML:'',querySelector(){return null}};
 card.shadowRoot.getElementById=()=>root;
 card._config={entities:['sensor.one','sensor.two'],goal:100,unit:'steps',show_legend:true};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 const today=L.dateParts(new Date(),'UTC');
 card._days=L.makeKeys(L.keyPlus(today,-30),today).map(key=>({key,value:25.5,goal:100,status:key===today?'progress':'missed',parts:[{entity:'sensor.one',value:20},{entity:'sensor.two',value:5.5}]}));
 card._selected=today;
 card._render();
 assert.match(root.innerHTML,/25\.5 steps/);
 assert.equal(datePartsCalls,1);
 const first=root.innerHTML,initialDates=dates,initialNumbers=numbers;
 card._render();
 assert.equal(root.innerHTML,first);
 assert.equal(dates,initialDates);
 assert.equal(numbers,initialNumbers);
 assert.equal(datePartsCalls,2);
 assert.equal(card._renderContext,null);
 card._hass.locale.language='de';
 card._config.unit='Schritte';
 card._render();
 assert.match(root.innerHTML,/25,5 Schritte/);
 card._config.precision=0;
 assert.equal(card._format(25.5),'26');
 card._config.entities=['sensor.one'];
 assert.equal(card._isMultiCurrent(card._days.at(-1)),false);
});

test('status labels translate only the requested state',()=>{
 const card=new (elements.get('daily-goals-card'))();
 const requested=[];
 card._t=key=>{requested.push(key);return key};
 assert.equal(card._label({status:'missed'}),'goalMissed');
 assert.deepEqual(requested,['goalMissed']);
 assert.equal(card._label({status:'custom'}),'custom');
 assert.equal(requested.length,1);
});

test('graph helpers keep hourly progress cumulative and use marker-scale bar widths',()=>{
 const response={
  'sensor.one':[
   {start:'2026-10-20T00:00:00Z',max:10,change:2},
   {start:'2026-10-20T01:00:00Z',max:20,change:3},
  ],
  'sensor.two':[
   {start:'2026-10-20T00:00:00Z',max:5,change:1},
   {start:'2026-10-20T01:00:00Z',max:7,change:4},
  ],
 };
 const maximum=L.hourlyProgressFromStats(response,['sensor.one','sensor.two'],'max');
 assert.deepEqual(Array.from(maximum,value=>value.value),[15,27]);
 assert.equal(maximum[0].time,Date.parse('2026-10-20T01:00:00Z'));
 const change=L.hourlyProgressFromStats(response,['sensor.one','sensor.two'],'change');
 assert.deepEqual(Array.from(change,value=>value.value),[3,10]);
 const history=new Map([
  ['sensor.one',[
   {last_updated:'2026-10-19T23:59:00Z',state:'100'},
   {last_updated:'2026-10-20T00:30:00Z',state:'110'},
   {last_updated:'2026-10-20T01:30:00Z',state:'120'},
  ]],
  ['sensor.two',[
   {last_updated:'2026-10-19T23:59:00Z',state:'200'},
   {last_updated:'2026-10-20T00:45:00Z',state:'205'},
   {last_updated:'2026-10-20T01:45:00Z',state:'215'},
  ]],
 ]);
 const historyChange=L.hourlyProgressFromHistory(history,['sensor.one','sensor.two'],'change',Date.parse('2026-10-20T00:00:00Z'),Date.parse('2026-10-20T03:00:00Z'));
 assert.deepEqual(Array.from(historyChange,point=>point.value),[15,35,35]);
 assert.equal(L.chartBarWidth(2),10);
 assert.equal(L.chartBarWidth(8),10);
 assert.equal(L.chartBarWidth(9),3);
 assert.equal(L.chartBarWidth(31),3);
 assert.equal(L.chartBarWidth(32),1.5);
});

test('graph view stays focused on goal status and uses the native-style header switch',()=>{
 const card=new (elements.get('daily-goals-card'))();
 assert.match(card.shadowRoot.innerHTML,/\.chart-goal\{fill:none;stroke:var\(--goal-unavailable\);stroke-width:3;stroke-dasharray:4 8;stroke-linecap:round/);
 assert.match(card.shadowRoot.innerHTML,/\.chart-scroll\{[^}]*overflow-x:hidden/);
 assert.match(card.shadowRoot.innerHTML,/\.chart-goal-label\.minimum\{transform:translateY\(-100%\)\}/);
 assert.match(card.shadowRoot.innerHTML,/\.chart-goal-label\.maximum\{transform:none\}/);
 const root={innerHTML:'',querySelector(){return null}};
 card.shadowRoot.getElementById=()=>root;
 card._config={entity:'sensor.steps',goal:100,unit:'steps'};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{}};
 const today=L.dateParts(new Date(),'UTC');
 card._days=L.makeKeys(L.keyPlus(today,-7),today).map((key,index)=>({
  key,value:20+index*10,goal:100,status:key===today?'progress':index%2?'met':'missed',parts:[{entity:'sensor.steps',value:20+index*10}],
 }));
 card._viewMode='chart';
 card._render();
 assert.match(root.innerHTML,/class="view-toggle"/);
 assert.match(root.innerHTML,/label="Show circle view"/);
 assert.match(root.innerHTML,/mdi:calendar-month-outline/);
 assert.match(root.innerHTML,/class="chart-goal"/);
 assert.match(root.innerHTML,/stroke-width="10"/);
 assert.match(root.innerHTML,/class="chart-bar met"/);
 assert.match(root.innerHTML,/class="chart-bar missed"/);
 assert.match(root.innerHTML,/class="chart-cap met"/);
 assert.doesNotMatch(root.innerHTML,/y-axis|chart-grid/);

 card._config={entities:['sensor.one','sensor.two'],goal:100};
 card._days=[{key:today,value:50,goal:100,status:'progress',parts:[{entity:'sensor.one',value:49.9},{entity:'sensor.two',value:.1}]}];
 const stackedChart=card._barChart();
 const stackedSegments=[...stackedChart.matchAll(/class="chart-stack" x1="[^"]+" y1="([^"]+)" x2="[^"]+" y2="([^"]+)"/g)];
 assert.equal(stackedSegments.length,2);
 assert.equal((stackedChart.match(/class="chart-stack chart-cap/g)||[]).length,1);
 assert.match(stackedChart,/<clipPath id="chart-stack-clip-0"><rect[^>]*height="[^"]+"\/><\/clipPath>/);
 assert.equal(stackedSegments[0][2],stackedSegments[1][1]);
 assert.ok(Number(stackedSegments[1][1])-Number(stackedSegments[1][2])>0);
 assert.ok(Number(stackedSegments[1][1])-Number(stackedSegments[1][2])<5);
 assert.match(stackedChart,new RegExp(`class="chart-stack chart-cap[^"]*" x1="[^"]+" y1="${stackedSegments[1][2]}"[^>]+y2="${stackedSegments[1][2]}"`));

 card._config={entity:'sensor.steps',goal:100,unit:'steps'};
 card._days=[
  {key:L.keyPlus(today,-1),value:null,goal:100,status:'no-data',parts:[]},
  {key:L.keyPlus(today,1),value:null,goal:100,status:'future',parts:[]},
 ];
 const missingChart=card._barChart();
 assert.equal((missingChart.match(/class="chart-cap no-data chart-missing"/g)||[]).length,1);
 assert.match(missingChart,/<clipPath id="chart-missing-clip-0"><rect[^>]*height="245"\/><\/clipPath>/);
 assert.match(missingChart,/class="chart-cap no-data chart-missing"[^>]*y1="145"[^>]*y2="145"[^>]*stroke-width="10"[^>]*clip-path="url\(#chart-missing-clip-0\)"/);
 assert.match(missingChart,/class="chart-goal" d="M 0\.5 [^"]+H 99\.5"/);

 assert.match(missingChart,/class="chart-goal-label minimum"[^>]*>Goal ▲<\/span>/);
 const minimumLabelTop=Number(missingChart.match(/chart-goal-label minimum" style="top:([\d.]+)px/)[1]);
 card._config.direction='max';
 const limitChart=card._barChart();
 assert.match(limitChart,/class="chart-goal-label maximum"[^>]*>Limit ▼<\/span>/);
 const maximumLabelTop=Number(limitChart.match(/chart-goal-label maximum" style="top:([\d.]+)px/)[1]);
 assert.ok(maximumLabelTop>minimumLabelTop);
 card._config.direction='min';
 card._days=L.makeKeys('2026-10-01','2026-10-31').map(key=>({key,value:50,goal:100,status:'missed',parts:[]}));
 const monthChart=card._barChart();
 assert.equal((monthChart.match(/class="chart-axis-label/g)||[]).length,4);
 assert.match(monthChart,/class="chart-axis-label start"/);
 assert.match(monthChart,/class="chart-axis-label end"/);
 assert.match(monthChart,/class="chart-axis-label start"[^>]*>[^<]*Oct[^<]*<\/span>/);
 const monthLabels=[...monthChart.matchAll(/class="chart-axis-label[^"]*"[^>]*>([^<]*)<\/span>/g)].map(match=>match[1]);
 assert.equal(monthLabels.slice(1).some(label=>label.includes('Oct')),false);

 card._days=L.makeKeys(L.keyPlus(today,-31),today).map(key=>({key,value:50,goal:100,status:key===today?'progress':'missed',parts:[]}));
 const longChart=card._barChart();
 assert.match(longChart,/stroke-width="1.5"/);
 assert.match(longChart,/class="chart-scroll"/);
 assert.doesNotMatch(longChart,/chart-scroll scrollable/);
 assert.doesNotMatch(longChart,/class="chart-canvas" style=/);

 card._days=L.makeKeys(L.keyPlus(today,-91),today).map(key=>({key,value:50,goal:100,status:'missed',parts:[]}));
 const quarterChart=card._barChart();
 assert.doesNotMatch(quarterChart,/class="chart-canvas" style=/);
 assert.doesNotMatch(quarterChart,/chart-scroll scrollable/);

 card._days=L.makeKeys(L.keyPlus(today,-92),today).map(key=>({key,value:50,goal:100,status:'missed',parts:[]}));
 const overQuarterChart=card._barChart();
 assert.match(overQuarterChart,/class="chart-canvas" style="width:500px"/);
 assert.match(overQuarterChart,/class="chart-scroll scrollable"/);

 card._days=L.makeKeys(L.keyPlus(today,-364),today).map(key=>({key,value:50,goal:100,status:'missed',parts:[]}));
 const yearChart=card._barChart();
 assert.match(yearChart,/class="chart-canvas" style="width:758px"/);

 let activeScroll={scrollLeft:286};
 card.shadowRoot.querySelector=selector=>selector==='.chart-scroll.scrollable'?activeScroll:null;
 const originalRender=card._render;
 card._render=()=>{activeScroll={scrollLeft:0}};
 card.shadowRoot.listeners.click({target:{closest(){return {dataset:{day:today}}}}});
 assert.equal(activeScroll.scrollLeft,286);
 card._render=originalRender;
 card.shadowRoot.querySelector=()=>null;

 card._period={start:L.keyPlus(today,-1),end:today};
 card.shadowRoot.listeners.click({target:{closest(){return {dataset:{viewToggle:''}}}}});
 assert.equal(card._viewMode,'circles');
 card.shadowRoot.listeners.click({target:{closest(){return {dataset:{viewToggle:''}}}}});
 assert.equal(card._viewMode,'chart');
 const otherCard=new (elements.get('daily-goals-card'))();
 assert.equal(storedValues.size,0);
 assert.equal(otherCard._viewMode,'circles');
});

test('single-day graph requests hourly statistics and renders stacked entity areas',async()=>{
 const card=new (elements.get('daily-goals-card'))();
 const key='2026-10-20';
 let request;
 card._period={start:key,end:key};
 card._config={entities:['sensor.one','sensor.two'],goal:100,aggregation:'max',unit:'steps',show_legend:true};
 card._hass={config:{time_zone:'UTC'},locale:{language:'en'},states:{
  'sensor.one':{attributes:{friendly_name:'First counter'}},
  'sensor.two':{attributes:{friendly_name:'Second counter'}},
 },callWS(message){
  request=message;
  return Promise.resolve({
   'sensor.one':[{start:key+'T00:00:00Z',max:10},{start:key+'T01:00:00Z',max:30}],
   'sensor.two':[{start:key+'T00:00:00Z',max:5},{start:key+'T01:00:00Z',max:20}],
  });
 }};
 card._days=[{key,value:50,goal:100,status:'missed',parts:[{entity:'sensor.one',value:30},{entity:'sensor.two',value:20}]}];
 const render=card._render;
 card._render=()=>{};
 await card._loadHourly();
 assert.equal(request.period,'hour');
 assert.deepEqual(Array.from(request.statistic_ids),['sensor.one','sensor.two']);
 assert.deepEqual(Array.from(card._hourly,point=>point.value),[15,50]);
 assert.deepEqual(Array.from(card._hourly[1].parts,part=>part.value),[30,20]);
 const graph=card._lineChart(card._days[0]);
 assert.equal((graph.match(/class="chart-area"/g)||[]).length,2);
 assert.match(graph,/class="chart-area" d="M [^"]+ C [^"]+ L [^"]+ C [^"]+ Z" style="--series-color:var\(--color-1,#4269d0\)"/);
 assert.doesNotMatch(graph,/chart-area-line/);
 assert.match(graph,/style="--series-color:var\(--color-2,#f4bd4a\)"/);
 assert.doesNotMatch(graph,/class="chart-line/);
 assert.match(source,/\.chart-area\{fill:var\(--series-color\);stroke:none/);
 assert.doesNotMatch(source,/\.chart-area\{[^}]*fill-opacity/);
 assert.match(graph,/class="chart-goal" d="M \.5 [^"]+ H 99\.5"/);
 assert.match(graph,/class="chart-goal"/);
 assert.match(graph,/data-day="2026-10-20"/);
 assert.doesNotMatch(graph,/chart-grid/);
 assert.match(graph,/>6(?: |\u202f)AM<\/span>/);
 assert.doesNotMatch(graph,/:00/);

 card._viewMode='chart';
 assert.match(graph,/class="chart-goal-label minimum"[^>]*>Goal ▲<\/span>/);
 const root={innerHTML:'',querySelector(){return null}};
 card.shadowRoot.getElementById=()=>root;
 card._render=render;
 card._render();
 assert.match(root.innerHTML,/class="series-legend"/);
 assert.match(root.innerHTML,/First counter/);
 assert.match(root.innerHTML,/30 steps/);
 card._config.direction='max';
 assert.match(card._lineChart(card._days[0]),/class="chart-goal-label maximum"[^>]*>Limit ▼<\/span>/);
 card._config.direction='min';
 card._syncPeriod=()=>{};
 card._observeSize=()=>{};
 let reloads=0;
 card._loadHourly=()=>{reloads++};
 card._hourlyLoading=true;
 card.disconnectedCallback();
 assert.equal(card._restartHourlyOnConnect,true);
 card.connectedCallback();
 assert.equal(reloads,1);
 card.disconnectedCallback();
});
