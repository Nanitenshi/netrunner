import {playWindow} from './interaction';
import TableTools from './TableTools';
import {useTouchLayout} from './useTouchLayout';
import {createPortal} from 'react-dom';
import {denseBoard} from './dense-board';
import PhysicalCounters from './PhysicalCounters';
import LandPlayControl from './LandPlayControl';
import {fitTableCamera} from './table-camera';
import {useTablePanel} from './useTablePanel';
import LifeControl from './LifeControl';
import RandomTools from './RandomTools';
import TavernEnvironment from './TavernEnvironment';
import {cardArt,cardImage} from './artworks';
import {Fragment,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode,type RefObject} from 'react';
import {ArrowLeft,ArrowRight,Compass,Focus,Grid2X2,Home,Layers,Minus,Plus,RotateCcw,Scan,Search,Skull,Swords} from 'lucide-react';
import {commanderCost,commanderTax,type CardInstance,type GameAction,type GameView,type Zone} from '../shared/game';
import {cardCounters,cardCounterTypes,markerCount,type CardCounterType,playerCounters,playerCounterTypes} from '../shared/counters';
import {definition,cards} from './seed';
import type {Settings} from './settings';
import OpponentBattlefield from './OpponentBattlefield';
import './tabletop.css';

type Props={view:GameView;seat:string;active:boolean;settings:Settings;setSettings:(s:Settings)=>void;ownArea:RefObject<HTMLDivElement|null>;renderCard:(card:CardInstance,positioned?:boolean)=>ReactNode;dispatch:(a:GameAction)=>void;playCard:(c:CardInstance)=>void;onInspect:(c:CardInstance)=>void;openZone:(player:string,zone:Zone)=>void;openPlayerCounters:()=>void;onSeatChange?:(id:string)=>void};
const WIDTH=2180,PADDING=40,GAP=36;
const MAT_WIDTH=(WIDTH-PADDING*2-GAP)/2;

export default function Tabletop({view,seat,active,settings,setSettings,ownArea,renderCard,dispatch,playCard,onInspect,openZone,openPlayerCounters,onSeatChange}:Props){
  const {touch}=useTouchLayout();
  const [target,setTarget]=useState(!touch&&settings.tableOverview!==false?'table':seat),[free,setFree]=useState(false),[zoom,setZoom]=useState(1),[rotation,setRotation]=useState(0),[pan,setPan]=useState({x:0,y:0});
  const [pinnedCards,setPinnedCards]=useState<Record<string,number>>({});
  const [boardModes,setBoardModes]=useState<Record<string,'free'|'grouped'>>({}),[expandedGroups,setExpandedGroups]=useState<Set<string>>(new Set()),[groupMenu,setGroupMenu]=useState<{ids:string[];x:number;y:number}|null>(null);
  const groupMenuRef=useRef<HTMLElement>(null),[groupCounter,setGroupCounter]=useState<CardCounterType|'custom'>('plusOne'),[groupStep,setGroupStep]=useState('1'),[groupCustom,setGroupCustom]=useState('');
  const groupStepValid=groupStep.trim()!==''&&Number.isInteger(+groupStep)&&+groupStep>=1&&+groupStep<=999&&(groupCounter!=='custom'||!!groupCustom.trim());
  useLayoutEffect(()=>{if(!groupMenuRef.current)return;const r=groupMenuRef.current.getBoundingClientRect();setGroupMenu(m=>{if(!m)return m;const x=Math.max(8,Math.min(m.x,innerWidth-r.width-8)),y=Math.max(8,Math.min(m.y,innerHeight-r.height-8));return x===m.x&&y===m.y?m:{...m,x,y};});},[groupMenu?.ids.join(','),groupCounter]);
  const groupMarks=(sign:number)=>{if(!groupMenu||!groupStepValid)return;for(let i=0;i<groupMenu.ids.length;i+=200)dispatch({type:'batchCardCounters',cardIds:groupMenu.ids.slice(i,i+200),counter:groupCounter,...(groupCounter==='custom'?{name:groupCustom.trim()}:{}),amount:sign*+groupStep});setGroupMenu(null);};
  useTablePanel('board-group',!!groupMenu,()=>setGroupMenu(null),'.board-group-menu,.tt-group-count');
  useEffect(()=>{const placed=(e:Event)=>{const d=(e as CustomEvent<{cardId:string;incarnation:number}>).detail;setPinnedCards(m=>({...m,[d.cardId]:d.incarnation}));};window.addEventListener('nexus-card-placed',placed);return()=>window.removeEventListener('nexus-card-placed',placed);},[]);
  const [toolsOpen,setToolsOpen]=useState(false);
  useTablePanel('camera',active&&toolsOpen,()=>setToolsOpen(false),'.tt-toolbar,.camera-tools-trigger');
  const [layout,setLayout]=useState<'free'|'ordered'>('free');
  const [size,setSize]=useState({width:1100,height:600});
  const [cameraMoving,setCameraMoving]=useState(false);
  const columns=view.players.length===2?1:2,TABLE_WIDTH=columns===1?MAT_WIDTH+PADDING*2:WIDTH;
  const MAT_HEIGHT=target==='table'?Math.max(400,Math.min(1000,(size.height-40)/Math.max(.1,(size.width-48)/TABLE_WIDTH)/Math.cos(settings.tableTilt*Math.PI/180)*1.08/2-PADDING-GAP/2)):Math.max(380,Math.min(680,MAT_WIDTH*(size.height-42)/Math.max(1,size.width-48))),HEIGHT=MAT_HEIGHT*2+PADDING*2+GAP;
  const viewport=useRef<HTMLDivElement>(null),gesture=useRef<{x:number;y:number;pan:{x:number;y:number};rotation:number;rotate:boolean}|null>(null);
  const index=view.players.findIndex(p=>p.id===seat);
  const relative=view.players.map((_,i)=>view.players[(index+i)%view.players.length]);
  const seating=(relative.length===2?[relative[1],relative[0]]:[relative[1],relative[2],relative[0],relative[3]]).filter(Boolean);
  const focused=view.players.find(p=>p.id===target);
  const overview=target==='table';
  const focusPlayer=(id:string)=>{setCameraMoving(true);setSettings({...settings,tableOverview:id==='table'});setTarget(id);setFree(false);setZoom(1);setPan({x:0,y:0});setRotation(0);};
  useEffect(()=>{if(!cameraMoving)return;const timer=setTimeout(()=>setCameraMoving(false),380);return()=>clearTimeout(timer);},[cameraMoving,target]);
  useEffect(()=>{setTarget(!touch&&settings.tableOverview!==false?'table':seat);setLayout('free');},[seat,touch]);
  useEffect(()=>{if(touch||size.width<600)setLayout('ordered');},[touch,size.width<600]);
  useEffect(()=>{
    const el=viewport.current;if(!el)return;
    const resize=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(width>0&&height>0){setCameraMoving(false);setSize({width,height});}});resize.observe(el);return()=>resize.disconnect();
  },[]);
  useEffect(()=>{
    if(!active)return;
    const handler=(e:KeyboardEvent)=>{
      if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true],[role=dialog]')||document.querySelector('.scrim'))return;
      if(['1','2','3','4'].includes(e.key)&&Number(e.key)<=relative.length){e.preventDefault();focusPlayer(relative[Number(e.key)-1].id);}
      if(e.key==='Escape')setToolsOpen(false);
      if(e.key==='Home'){e.preventDefault();focusPlayer(seat);}
      if(e.key.toLowerCase()==='v'){e.preventDefault();focusPlayer(overview?seat:'table');}
      if(e.key.toLowerCase()==='f'){e.preventDefault();setFree(f=>!f);}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[active,seat,overview,relative.map(p=>p.id).join(',')]);
  const slot=seating.findIndex(p=>p.id===target);
  const center=overview||slot<0?{x:TABLE_WIDTH/2,y:HEIGHT/2}:{x:PADDING+MAT_WIDTH/2+(slot%columns)*(MAT_WIDTH+GAP),y:PADDING+MAT_HEIGHT/2+Math.floor(slot/columns)*(MAT_HEIGHT+GAP)};
  const camera=fitTableCamera(overview?TABLE_WIDTH:MAT_WIDTH,overview?HEIGHT:MAT_HEIGHT,size.width-48,size.height-44,settings.tableTilt);
  const scale=camera.scale*zoom*(overview?1:settings.boardZoom??1);
  const field=(id:string)=>view.cards.filter(c=>c.controllerId===id&&c.zone==='battlefield');
  const commanderFor=(p:GameView['players'][number])=>{const instance=view.cards.find(c=>c.ownerId===p.id&&c.isCommander);return instance?definition(instance.cardId):cards.find(c=>c.name===p.commander.split(' + ')[0])??cards[0];};
  const matImage=(c:ReturnType<typeof definition>)=>cardImage(c)===c.image&&["Atraxa, Praetors' Voice",'The Ur-Dragon','Muldrotha, the Gravetide','Edgar Markov'].includes(c.name)?`/mats/${c.id}.jpg`:cardArt(c);
  const zoned=(id:string,zone:Zone)=>view.cards.filter(c=>c.ownerId===id&&c.zone===zone).sort((a,b)=>(a.zoneOrder??0)-(b.zoneOrder??0));
  const cameraStyle={width:TABLE_WIDTH,height:HEIGHT,transform:`translate(-50%,-50%) translate(${pan.x}px,${pan.y+camera.offsetY*zoom*(overview?1:settings.boardZoom??1)}px) scale(${scale}) perspective(${camera.perspective}px) rotateX(${settings.tableTilt}deg) rotateZ(${rotation}deg) translate(${TABLE_WIDTH/2-center.x}px,${HEIGHT/2-center.y}px)`} as CSSProperties;
  return <section className={`tt-shell ${overview?'tt-overview':'tt-focus'} ${free?'tt-freecam':''} ${cameraMoving?'tt-camera-moving':''} ${view.rules?.turnOnly?'tt-casual-table':''} ${columns===1?'tt-duel':''}`} aria-label="Gemeinsamer Commander-Tisch">
    <nav className="tt-player-nav" aria-label="Tischkamera">
      <button className="tt-overview-button" aria-label="Gesamten Tisch ansehen" aria-pressed={overview} onClick={()=>focusPlayer('table')}><Grid2X2 size={18}/><span>Ganzer Tisch</span><kbd>V</kbd></button>
      <div className="tt-player-tabs">{relative.map((p,i)=>{
        const commander=commanderFor(p);
        return <button key={p.id} className={`tt-player-tab ${view.activePlayer===p.id?'on-turn':''}`} style={{'--seat-color':p.color} as CSSProperties} title={`${i===0?'Dein Board':p.name} · Taste ${i+1}`} aria-label={`${i===0?'Dein Board':`Board von ${p.name}`} ansehen`} aria-pressed={target===p.id} onClick={()=>focusPlayer(p.id)}><img src={matImage(commander)} alt=""/><span><b>{i===0?'Dein Board':p.name}</b></span><kbd>{i+1}</kbd></button>;
      })}</div><TableTools view={view} seat={seat} dispatch={dispatch}/><LandPlayControl view={view} seat={seat} dispatch={dispatch}/><PhysicalCounters view={view} seat={seat} active={active} dispatch={dispatch}/><span className="tt-turn-readout">Zug {view.turn}</span>
    </nav>
    <div ref={viewport} className="tt-viewport" data-camera-target={target} data-camera-mode={free?'free':'locked'} data-camera-scale={scale.toFixed(3)}
      onContextMenu={e=>e.preventDefault()}
      onWheel={e=>{if(!free&&!e.altKey||(e.target as HTMLElement).closest('.battlefield-reader,.random-tools,button,input,select'))return;setZoom(z=>Math.max(.5,Math.min(2,z-e.deltaY*.001)));}}
      onPointerDown={e=>{if(!free||(e.target as HTMLElement).closest('button,input,select,.battlefield-reader'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);gesture.current={x:e.clientX,y:e.clientY,pan,rotation,rotate:e.button===2};}}
      onPointerMove={e=>{const g=gesture.current;if(!g)return;if(g.rotate)setRotation(g.rotation+(e.clientX-g.x)*.16);else setPan({x:g.pan.x+e.clientX-g.x,y:g.pan.y+e.clientY-g.y});}}
      onPointerUp={()=>gesture.current=null} onPointerCancel={()=>gesture.current=null}>
      <TavernEnvironment animated={settings.effects} table/><div className="tt-room-light"/><div className="tt-holo-dust" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{left:`${(i*29+7)%100}%`,top:`${(i*17+11)%100}%`,animationDelay:`-${i*1.3}s`}}/>)}</div>
      <div className="tt-view-caption"><span>{free?'FREIE KAMERA':overview?'GEMEINSAMER TISCH':'KAMERA FIXIERT'}</span><b>{overview?`${view.players.length} Plätze. Ein Spielfeld.`:target===seat?'Deine Playmatte':`${focused?.name} · Playmatte`}</b></div>
      {!overview&&target!==seat&&<button className="tt-back-home" onClick={()=>focusPlayer(seat)}><Home size={14}/> Zurück zu deinem Board <kbd>1</kbd></button>}
      <div className="tt-stage" style={cameraStyle}>
        <div className="tt-table-edge" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i} style={{'--edge-layer':i} as CSSProperties}/>)}</div><div className="tt-table-seams" aria-hidden="true"><i/><i/></div>
        <div className="tt-mats" style={{gridTemplateColumns:columns===1?'1fr':'1fr 1fr',gridTemplateRows:'1fr 1fr',inset:PADDING,gap:GAP}}>
          {seating.map((p,slot)=>{
            const own=p.id===seat,commander=commanderFor(p),board=field(p.id),isFocused=p.id===target;
            const dense=!touch&&(boardModes[p.id]??(board.length>=16?'grouped':'free'))==='grouped';
            const denseLayout=denseBoard(board,MAT_WIDTH-205,MAT_HEIGHT-120,expandedGroups,new Set(board.filter(c=>pinnedCards[c.id]===(c.incarnation??0)).map(c=>c.id)));
            const ordered=touch||!dense&&!overview&&!free&&isFocused&&layout==='ordered';
            return <article key={p.id} className={`tt-mat ${isFocused?'tt-mat-focused':''} ${own?'tt-own-mat':''} ${view.activePlayer===p.id?'tt-seat-active':''} ${slot%columns===0&&columns>1?'tt-outer-left':'tt-outer-right'}`} style={{'--seat-color':p.color,'--mat-art':`url('${matImage(commander)}')`,'--mat-art-opacity':settings.tableArt?'.26':'0'} as CSSProperties} data-player={p.id} data-table-slot={slot} aria-label={`Playmatte ${p.name}`}>
              <div className="tt-mat-art"/><div className="tt-mat-vignette"/>
              <header className="tt-mat-heading"><button className="tt-seat-title" title={`${p.name} · ${p.commander}`} onClick={()=>focusPlayer(p.id)}><img className="tt-seat-portrait" src={matImage(commander)} alt=""/><span><b>{own?'Du':p.name}</b>{view.activePlayer===p.id&&<small className="tt-turn-tag">Am Zug</small>}</span></button>{own?<LifeControl life={p.life} active={active} dispatch={dispatch}/>:<div className="tt-mat-life"><strong>{p.life}</strong></div>}<button className="tt-arrange-toggle" aria-pressed={dense} aria-label={`${own?'Dein Board':p.name}: ${dense?'freie Platzierung':'übersichtlich gruppieren'}`} title={dense?'Freie Platzierung':'Karten ordnen und gleiche Token zusammenfassen'} onClick={()=>setBoardModes(m=>({...m,[p.id]:dense?'free':'grouped'}))}><Grid2X2 size={16}/></button><span className="tt-hand-count" title={`${view.hiddenCounts[p.id].hand} Handkarten`}><Layers size={15}/>{view.hiddenCounts[p.id].hand}</span></header>
              <div className="tt-mat-body">
                <div style={dense?{'--dense-card-width':`${denseLayout.cardWidth}px`} as CSSProperties:undefined} className={`tt-field ${dense?'tt-dense-field':''} ${!ordered?'free-field':''} ${settings.snap&&own&&!ordered?'tt-grid':''}`} ref={own&&!ordered?ownArea:undefined}>
                  {[0,1,2,3].map(i=><i key={i} className={`corner corner-${i}`}/>)}
                  <div className="tt-holo-inlay" aria-hidden="true"><i/><i/><i/></div><div className="tt-battlefield-outline"><span>SPIELFELD</span></div><div className="tt-lands-outline"><span>LÄNDER</span></div>
                  {!ordered&&!dense&&<svg className="attachment-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{board.filter(c=>c.attachedTo).map(c=>{const host=board.find(t=>t.id===c.attachedTo);return host?<line key={c.id} x1={c.position.x*100} y1={c.position.y*100} x2={host.position.x*100} y2={host.position.y*100}/>:null;})}</svg>}
                  {dense?<>{denseLayout.headers.map(h=><div className="tt-dense-lane-label" key={h.section} style={{top:`${h.y*100}%`}}><span>{h.section==='creatures'?'Kreaturen':h.section==='lands'?'Länder':'Weitere Permanents'}</span><b>{h.count}</b><small>{h.untapped} ungetappt</small></div>)}{denseLayout.slots.map(slot=><Fragment key={slot.card.id}>{slot.collapsed&&<i className="tt-group-back" style={{left:`${slot.position.x*100}%`,top:`${slot.position.y*100}%`}}/>}{renderCard({...slot.card,position:slot.position},true)}{slot.collapsed&&<button className="tt-group-count" style={{left:`${slot.position.x*100}%`,top:`${slot.position.y*100}%`}} title={`${slot.group.cards.length} gleiche Karten · Klicken zum Auffächern${own?' · Rechtsklick für Gruppenaktionen':''}`} aria-label={`${slot.group.cards.length} gleiche ${definition(slot.card.cardId).name} auffächern`} onClick={()=>setExpandedGroups(g=>new Set([...g,slot.group.key]))} onContextMenu={e=>{e.preventDefault();e.stopPropagation();if(own)setGroupMenu({ids:slot.group.cards.map(c=>c.id),x:Math.max(8,Math.min(e.clientX,innerWidth-230)),y:Math.max(8,Math.min(e.clientY,innerHeight-175))});}}>×{slot.group.cards.length}</button>}</Fragment>)}</>:ordered?<OpponentBattlefield key={p.id} cards={board} expanded grouped={settings.groupOpponents} onInspect={onInspect} renderCard={card=>renderCard(card)}/>:board.map(card=>renderCard(card,true))}
                  {!board.length&&!ordered&&<div className="tt-empty"><span>✦</span><p>{own?'Keine Karten im Spiel.':'Keine Karten im Spiel.'}</p>{own&&<small>Karte aus deiner Hand hierher ziehen</small>}</div>}
                </div>
                <aside className="tt-mat-rail">
                  <div className={`tt-command-zone ${zoned(p.id,'commander').length>1?'tt-dual-commanders':''}`} data-drop-zone={own?'commander':undefined}><div className="tt-zone-heading"><span>Commander</span><b title="Summe der Commander-Tax; Kosten je Commander stehen an der Karte">+{view.commanderTaxByPlayer[p.id]??0}</b></div>{zoned(p.id,'commander').map(c=><div key={c.id}>{renderCard(c)}{own&&<button disabled={!playWindow(view,seat,c,definition(c.cardId)).allowed} title={playWindow(view,seat,c,definition(c.cardId)).reason} aria-label={`Commander ${definition(c.cardId).name} wirken`} className="cast-commander" onClick={()=>playCard(c)}><Swords size={14}/><span>Wirken · {commanderCost(definition(c.cardId).mana,commanderTax(c))}</span></button>}</div>)}{!zoned(p.id,'commander').length&&<div className="tt-command-empty">◇<small>Commander unterwegs</small></div>}</div>
                  <button className="tt-library-pile" style={{'--pile-color':p.color} as CSSProperties} onClick={()=>openZone(p.id,'library')} aria-label={own?'Eigenes Deck durchsuchen':`Bibliothek von ${p.name} ansehen`}><span className="tt-deck-back pile-cards physical-pile" data-count={view.hiddenCounts[p.id].library}>{Array.from({length:Math.min(7,Math.ceil(view.hiddenCounts[p.id].library/14))},(_,i)=><span className="pile-layer" key={i} style={{'--layer':i+1} as CSSProperties}/>)}<img src={matImage(commander)} alt={`Deckrücken von ${p.name}`}/><i aria-hidden="true">{relative.findIndex(x=>x.id===p.id)+1}</i></span><b>{view.hiddenCounts[p.id].library}</b><small>Deck</small>{own&&<Search className="library-search-icon" size={13}/>}</button>
                  <div className="tt-public-zones">{(['graveyard','exile'] as const).map(zone=><button key={zone} data-drop-zone={own?zone:undefined} aria-label={`${zone==='graveyard'?'Friedhof':'Exil'} von ${p.name} ansehen`} onClick={()=>openZone(p.id,zone)}><span style={{'--pile-color':p.color} as CSSProperties} className={`public-pile pile-cards physical-pile ${zoned(p.id,zone).length?'has-cards':'empty-pile'}`}>{Array.from({length:Math.min(5,Math.max(0,zoned(p.id,zone).length-1))},(_,i)=><span className="pile-layer" key={i} style={{'--layer':i+1} as CSSProperties}/>)}{zoned(p.id,zone).length?<img src={cardImage(definition(zoned(p.id,zone).at(-1)!.cardId))} alt={definition(zoned(p.id,zone).at(-1)!.cardId).name}/>:zone==='graveyard'?<Skull size={25}/>:<Layers size={19}/>}</span><b>{zoned(p.id,zone).length}</b><small>{zone==='graveyard'?'Friedhof':'Exil'}</small></button>)}</div>
                </aside>
              </div>
              <footer className="tt-mat-footer"><div className="tt-player-markers">{playerCounterTypes.filter(type=>(p.counters?.[type]??0)>0).map(type=><span key={type} title={playerCounters[type].name}>{playerCounters[type].short} {p.counters?.[type]}</span>)}{(p.customCounters??[]).map(c=><span key={c.name} title={c.name}>{c.name} {c.value}</span>)}{(p.commanderDamage??[]).filter(d=>d.amount>0).map(d=><span className="damage-badge" key={d.commanderId} title={`${d.name}: ${d.amount}/21 Kampfschaden`}>⚔ {d.amount}/21</span>)}</div>{own?<button className="tt-track-button" onClick={openPlayerCounters}><Swords size={14}/> Counter / Schaden</button>:<button onClick={()=>focusPlayer(p.id)}><Focus size={13}/> Board ansehen</button>}</footer>
            </article>;
          })}
        </div>
      </div>
      <div className="tt-minimap" aria-label="Tischnavigation">{seating.map(p=><button key={p.id} style={{'--seat-color':p.color} as CSSProperties} aria-label={`Kameraziel ${p.name}`} aria-pressed={target===p.id} onClick={()=>focusPlayer(p.id)}><i/>{p.id===seat?'DU':p.name}<span>{p.life}</span></button>)}</div>
    </div>
    {groupMenu&&createPortal(<aside ref={groupMenuRef} className="board-group-menu" style={{left:groupMenu.x,top:groupMenu.y}} aria-label="Gruppenaktionen"><b>{groupMenu.ids.length} gleiche Karten</b><select aria-label="Gruppenkarten verschieben" value="" onChange={e=>{dispatch({type:"batchCards",cardIds:groupMenu.ids,operation:e.target.value as "sacrifice"|"exile"|"hand"});setGroupMenu(null);}}><option value="" disabled>Gemeinsam verschieben</option><option value="sacrifice">Opfern</option><option value="exile">Ins Exil</option><option value="hand">Auf die Hand</option></select><button onClick={()=>{dispatch({type:'batchCards',cardIds:groupMenu.ids,operation:'tap'});setGroupMenu(null);}}>Alle tappen</button><button onClick={()=>{dispatch({type:'batchCards',cardIds:groupMenu.ids,operation:'untap'});setGroupMenu(null);}}>Alle enttappen</button><div className="group-counter-tools"><label>Marke<select aria-label="Gruppenmarke" value={groupCounter} onChange={e=>setGroupCounter(e.target.value as CardCounterType|'custom')}>{cardCounterTypes.map(k=><option key={k} value={k}>{cardCounters[k].name}</option>)}<option value="custom">Eigener Counter</option></select></label>{groupCounter==='custom'&&<input aria-label="Eigener Gruppencounter" maxLength={28} placeholder="Name" value={groupCustom} onChange={e=>setGroupCustom(e.target.value)}/>}<label>Menge je Karte<input aria-label="Gruppencounter Menge" type="number" min="1" max="999" value={groupStep} onChange={e=>setGroupStep(e.target.value)}/></label><div><button disabled={!groupStepValid} aria-label="Marken auf alle Gruppenkarten hinzufügen" onClick={()=>groupMarks(1)}><Plus size={15}/> Alle</button><button disabled={!groupStepValid} aria-label="Marken von allen Gruppenkarten entfernen" onClick={()=>groupMarks(-1)}><Minus size={15}/> Alle</button></div></div><button onClick={()=>setGroupMenu(null)}>Schließen</button></aside>,document.body)}
    <RandomTools view={view} active={active} dispatch={dispatch}/>
    <button className="camera-tools-trigger" aria-label="Tischwerkzeuge" title="Kamera und Kartenanordnung" aria-expanded={toolsOpen} onClick={()=>setToolsOpen(v=>!v)}><Compass size={24}/></button>{toolsOpen&&<div className="tt-toolbar" aria-label="Kamera und Anordnung"><div className="tt-view-tools"><button aria-pressed={free} onClick={()=>setFree(f=>!f)}><Compass size={15}/>{free?'Freie Kamera':'Kamera lösen'}<kbd>F</kbd></button><button aria-label="Kamera zurücksetzen" onClick={()=>focusPlayer(seat)}><Home size={15}/></button><span className="tt-divider"/><button aria-label="Kamera verkleinern" onClick={()=>setZoom(z=>Math.max(.5,z-.15))}><Minus size={14}/></button><span className="tt-zoom-value">{Math.round(zoom*100)}%</span><button aria-label="Kamera vergrößern" onClick={()=>setZoom(z=>Math.min(2,z+.15))}><Plus size={14}/></button><label className="tt-board-zoom">Board<input aria-label="Board-Vergrößerung" type="range" min="1" max="1.35" step=".05" value={settings.boardZoom??1} onChange={e=>setSettings({...settings,boardZoom:+e.target.value})}/></label><label className="tt-tilt">Neigung<input aria-label="Tischneigung" type="range" min="0" max="28" step="1" value={settings.tableTilt} onChange={e=>setSettings({...settings,tableTilt:+e.target.value})}/></label>{free&&<><button aria-label="Tisch links drehen" onClick={()=>setRotation(r=>r-10)}><ArrowLeft size={14}/></button><button aria-label="Tisch rechts drehen" onClick={()=>setRotation(r=>r+10)}><ArrowRight size={14}/></button></>}</div>
      <div className="tt-layout-tools"><label><input type="checkbox" checked={settings.snap} onChange={e=>setSettings({...settings,snap:e.target.checked})}/> Raster</label>{onSeatChange&&<select className="tt-test-seat" aria-label="Spielerperspektive" title="Aktiver Testspieler (nur lokaler Testtisch)" value={seat} onChange={e=>onSeatChange(e.target.value)}>{view.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}{!overview&&!free&&<><button aria-pressed={layout==='free'} onClick={()=>setLayout('free')}>Frei legen</button><button aria-pressed={layout==='ordered'} onClick={()=>setLayout('ordered')}>Kartenübersicht</button>{target===seat&&<button aria-label="Karten aufräumen" title="Karten auf der Playmatte aufräumen" onClick={()=>dispatch({type:'arrange'})}><Grid2X2 size={14}/></button>}</>}{target!==seat&&!overview&&<label><input type="checkbox" checked={settings.groupOpponents} onChange={e=>setSettings({...settings,groupOpponents:e.target.checked})}/> Gleiche Länder / Tokens bündeln</label>}{overview&&<span>Spielernamen anklicken · <kbd>1–4</kbd> Spieler wechseln</span>}</div>
    </div>}
  </section>;
}

