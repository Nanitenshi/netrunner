import EffectSourceTags from './EffectSourceTags';
import CardEditor from './CardEditor';
import {instanceDefinition} from '../shared/card-state';
import ZoneBrowser from './ZoneBrowser';
import HiddenCardPlay from './HiddenCardPlay';
import {needsCastDialog,basicLandMana,quickCounter} from './direct-play';
import PhaseControls from './PhaseControls';
import {turnStage,type AutoPriorityPolicy} from '../shared/auto-priority';
import {reconcileHand,moveHandCard} from './hand-order';
import MatchMenu from './MatchMenu';
import {playWindow} from './interaction';
import CardMenu from './CardMenu';
import GameActivity from './GameActivity';
import CommandGuide from './CommandGuide';
import ArtworkPicker from './ArtworkPicker';
import {cardImage} from './artworks';
import Tabletop from './Tabletop';
import SelectionActions from './SelectionActions';
import MechanicsPanel from './MechanicsPanel';
import {enableRules} from '../shared/engine';
import {uuid} from '../shared/id.ts';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Diamond, Expand, Eye, Grid2X2, Layers, Maximize2, Minus, MousePointer2, Move3D, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Settings2, Shield, Sparkles, Swords, Volume2, X } from 'lucide-react';
import { applyAction, phases, projectGame, commanderTax, commanderCost, type GameView, type CardInstance, type GameAction, type Player, type Zone } from '../shared/game';
import { definition, initialGame, cards } from './seed';
import { boardPoint } from './geometry';
import { defaults, discordURL, readSettings, type Settings } from './settings';
import { CardCharacteristics } from './CardCharacteristics';
import SettingsPanel from './SettingsPanel';
import {CounterMenu} from './CounterMenu';
import {cardCounterTypes,cardCounters,playerCounterTypes,playerCounters,markerCount,markedStats} from '../shared/counters';
import './card-characteristics.css';

const zoneNames: Record<Zone,string> = {library:'Bibliothek',hand:'Hand',battlefield:'Spielfeld',graveyard:'Friedhof',exile:'Exil',commander:'Kommandozone',stack:'Stack'};
type Modal = 'settings' | 'help' | 'account' | 'zoom' | 'log' | 'counters' | 'playerCounters' | null;

export default function App({active,settings,setSettings,onExit,online}:{online?:{view:GameView;seat:string;connected:boolean;code:string;dispatch:(action:GameAction)=>void;error:string;revision:number;combat:boolean;autoPass:(revision:number,policy:AutoPriorityPolicy)=>Promise<boolean>;isHost:boolean;leave:()=>Promise<boolean>;finish:()=>Promise<boolean>};active:boolean;settings:Settings;setSettings:React.Dispatch<React.SetStateAction<Settings>>;onExit:()=>void}) {
  const [localGame, setGame] = useState(()=>{const state=enableRules(initialGame());state.rules!.turnOnly=true;state.phase=3;return state;});
  const game=online?.view??localGame;
  const [castId,setCastId]=useState<string|null>(null);const [holdCast,setHoldCast]=useState(false);
  const [editorId,setEditorId]=useState<string|null>(null),[attaching,setAttaching]=useState(false);
  const [previewInstance,setPreviewInstance]=useState<string|null>(null);
  const [searchRequest]=useState(0);
  const [localSeat, setSeat] = useState('you');
  const seat=online?.seat??localSeat;
  const [windowSize,setWindowSize]=useState({width:window.innerWidth,height:window.innerHeight});
  useEffect(()=>{const resize=()=>setWindowSize({width:window.innerWidth,height:window.innerHeight});window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const [handOrder,setHandOrder]=useState<string[]>([]);
  const handKey=`nexus.hand.${online?.code??'local'}.${seat}`;
  useEffect(()=>{try{const ids=JSON.parse(localStorage.getItem(handKey)??'[]');setHandOrder(Array.isArray(ids)?ids.filter(id=>typeof id==='string').slice(0,300):[]);}catch{setHandOrder([]);}},[handKey]);
  function saveHandOrder(ids:string[]){setHandOrder(ids);try{localStorage.setItem(handKey,JSON.stringify(ids));}catch{}}
  const [hover,setHover]=useState<{id:string;card:CardInstance;x:number;y:number}|null>(null);
  const hoveredCard=useRef<string|null>(null);
  const hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  function clearHover(){if(hoverTimer.current)clearTimeout(hoverTimer.current);setHover(null);}
  function showHover(card:CardInstance,rect:DOMRect){clearHover();setPreview(card.cardId);setPreviewInstance(card.id);const width=Math.min(320,window.innerWidth-24),height=width*1.395;const x=rect.right+width+24<window.innerWidth?rect.right+14:Math.max(12,rect.left-width-14),y=Math.max(12,Math.min(rect.top,window.innerHeight-height-52));hoverTimer.current=setTimeout(()=>setHover({id:card.cardId,card,x,y}),350);}

  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState(cards.find(c => c.name === "Atraxa, Praetors' Voice")!.id);
  const [matchOpen,setMatchOpen]=useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [damageSource,setDamageSource]=useState<string|undefined>(undefined);
  const [counterTarget,setCounterTarget]=useState<string|null>(null);
  function openCounters(id:string){setCounterTarget(id);setModal('counters');setMenu(null);clearHover();}
  const [zone, setZone] = useState<{player:string; zone:Zone} | null>(null);
  const [menu, setMenu] = useState<{id:string;x:number;y:number} | null>(null);
  const [toast, setToast] = useState('');
  const [ghost, setGhost] = useState<{card:CardInstance;x:number;y:number;point?:{x:number;y:number}} | null>(null);
  const ownArea = useRef<HTMLDivElement>(null);
  const drag = useRef<{card:CardInstance; x:number;y:number; moved:boolean;offset:{x:number;y:number}} | null>(null);
  const lastDrag = useRef(0);
  useEffect(()=>{const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'&&drag.current){lastDrag.current=performance.now();drag.current=null;setGhost(null);if(longPress.current)clearTimeout(longPress.current);}};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[]);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const view = online?.view??projectGame(game,seat);
  useEffect(()=>{clearHover();},[active,modal,zone,menu,castId,matchOpen,editorId]);
  useEffect(()=>{const hide=()=>clearHover();window.addEventListener('nexus-table-panel',hide);return()=>window.removeEventListener('nexus-table-panel',hide);},[]);

  const editorCard=view.cards.find(c=>c.id===editorId&&c.zone==='battlefield'&&c.controllerId===seat);
  function closeEditor(){setEditorId(null);setAttaching(false);}
  useEffect(()=>{if(editorId&&!editorCard)closeEditor();},[editorId,editorCard]);
  useEffect(()=>{if(modal||zone||castId||matchOpen)closeEditor();},[modal,zone,castId,matchOpen]);
  const me = game.players.find(p=>p.id===seat)!;
  useEffect(()=>{setCastId(null);},[seat]);
  const inspectOpponent=(card:CardInstance)=>{setPreview(card.cardId);setPreviewInstance(card.id);setModal('zoom');};
  const getCards = (player:string,z:Zone) => view.cards.filter(c=>c.ownerId===player && c.zone===z);
  const update = <K extends keyof Settings>(key:K,value:Settings[K]) => setSettings(s=>({...s,[key]:value}));
  useEffect(()=>{ try { localStorage.setItem('nexus.preferences',JSON.stringify(settings)); } catch { /* Private mode can disallow persistence. */ } },[settings]);
  useEffect(()=>{ if (!toast) return; const timer=setTimeout(()=>setToast(''),2700); return ()=>clearTimeout(timer); },[toast]);
  useEffect(()=>{ setSelected([]);setZone(null);setMenu(null); },[seat]);
  useEffect(()=>{
    if(!modal&&!zone)return;
    const previous=document.activeElement as HTMLElement|null;
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab')return;
      const nodes=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled),[role="dialog"] a,[role="dialog"] input,[role="dialog"] select'));
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',trap);return()=>{document.removeEventListener('keydown',trap);previous?.focus({preventScroll:true});};
  },[modal,zone]);
  useEffect(()=>()=>{if(longPress.current)clearTimeout(longPress.current);},[]);
  function dispatch(action:GameAction) {
    if(online){online.dispatch(action);return;}
    setGame(current=>{
      try{return applyAction(current,seat,action);}catch(error){setToast(error instanceof Error?error.message:'Aktion fehlgeschlagen');return current;}
    });
  }
  function playCard(card:CardInstance,hold=false){
    setHoldCast(hold);
    if(card.zone==='hand'&&(!(definition(card.cardId).faces[0]?.type??definition(card.cardId).type).includes('Land')||definition(card.cardId).layout==='modal_dfc')||card.zone==='commander'){const data=definition(card.cardId);if(settings.simpleControls!==false&&!settings.autoTap&&!needsCastDialog(data)&&playWindow(view,seat,card,data).allowed){dispatch({type:'cast',cardId:card.id,costsPaid:true,passPriority:!hold&&settings.holdPriority!==true,payFromPool:false});setCastId(null);}else setCastId(card.id);setMenu(null);setModal(null);setZone(null);clearHover();}
    else dispatch({type:'move',cardId:card.id,zone:'battlefield'});
  }
  function actOnSelection(type:'tap'|'copy') {
    selected.forEach(id=>{const c=game.cards.find(c=>c.id===id); if(c?.controllerId===seat && c.zone==='battlefield') dispatch(type==='copy'?{type,cardId:id,newId:uuid()}:{type,cardId:id});});
  }
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      const element=e.target as HTMLElement;
      if(!active)return;
      if(e.key==='Escape'){closeEditor();setModal(null);setZone(null);setMenu(null);setSelected([]);return;}
      if(element.closest('input,textarea,select,[contenteditable="true"]')||modal||zone||castId||editorId||view.rules?.pending||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
      if(e.key.toLowerCase()==='t'){e.preventDefault();const c=view.cards.find(c=>c.id===hoveredCard.current);if(c){if(c.controllerId===seat&&c.zone==='battlefield')dispatch({type:'tap',cardId:c.id});}else actOnSelection('tap');}
      if(e.key.toLowerCase()==='c'){e.preventDefault();actOnSelection('copy');}
      if(e.key.toLowerCase()==='q'&&selected.length){e.preventDefault();view.cards.filter(c=>selected.includes(c.id)&&c.controllerId===seat&&c.zone==='battlefield'&&!c.tapped).forEach(c=>dispatch({type:'tap',cardId:c.id}));}
      if(['+','=','-'].includes(e.key)&&selected.length){e.preventDefault();view.cards.filter(c=>selected.includes(c.id)&&c.controllerId===seat&&c.zone==='battlefield').forEach(c=>{const counter=quickCounter(instanceDefinition(c)),count=markerCount(c,counter),step=e.shiftKey?5:1,amount=e.key==='-'?-Math.min(count,step):Math.min(999-count,step);if(amount)dispatch({type:'cardCounter',cardId:c.id,counter,amount});});}
      if(e.key.toLowerCase()==='m'&&selected[0]){e.preventDefault();openCounters(selected[0]);}
      if(e.key.toLowerCase()==='d'&&canDraw){e.preventDefault();dispatch({type:'draw'});}
      if(e.code==='Space'){e.preventDefault();setModal('zoom');}
      if(e.key==='?')setModal('help');
    };
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  });
  function pointerDown(e:ReactPointerEvent,card:CardInstance) {
    if(e.button!==0||attaching)return;
    lastDrag.current=0;clearHover();
    setPreview(card.cardId);setPreviewInstance(card.id);
    if(e.pointerType==='touch')longPress.current=setTimeout(()=>{drag.current=null;setModal('zoom');},550);
    if(card.controllerId!==seat)return;
    if(e.pointerType==='touch')setSelected([card.id]);
    let offset={x:0,y:0};
    if(card.zone==='battlefield'&&ownArea.current){try{const p=boardPoint(Array.from(ownArea.current.querySelectorAll('.corner')).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y};}),{x:e.clientX,y:e.clientY});offset={x:p.x-card.position.x,y:p.y-card.position.y};}catch{return;}}
    drag.current={card,x:e.clientX,y:e.clientY,moved:false,offset};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e:ReactPointerEvent) {
    const d=drag.current;if(!d)return;
    if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<7&&!d.moved)return;
    d.moved=true;
    if(longPress.current)clearTimeout(longPress.current);
    let point: {x:number;y:number}|undefined;
    if(d.card.zone==='battlefield'&&ownArea.current){try{const p=boardPoint(Array.from(ownArea.current.querySelectorAll('.corner')).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y};}),{x:e.clientX,y:e.clientY});point={x:Math.max(.06,Math.min(.94,p.x-d.offset.x)),y:Math.max(.1,Math.min(.9,p.y-d.offset.y))};if(settings.snap)point={x:Math.round(point.x*14)/14,y:Math.round(point.y*8)/8};}catch{}}
    setGhost({card:d.card,x:e.clientX,y:e.clientY,point});
  }
  function pointerUp(e:ReactPointerEvent) {
    if(longPress.current)clearTimeout(longPress.current);
    const d=drag.current;drag.current=null;setGhost(null);
    if(!d?.moved)return;
    if(d.card.zone==='hand'){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-hand-id]');if(target){const rect=target.getBoundingClientRect();saveHandOrder(moveHandCard(reconcileHand(handOrder,getCards(seat,'hand').map(c=>c.id)),d.card.id,target.dataset.handId!,e.clientX>rect.left+rect.width/2));lastDrag.current=performance.now();return;}}
    if(!ownArea.current)return;
    lastDrag.current=performance.now();
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-drop-zone]');
    if(target){dispatch({type:'move',cardId:d.card.id,zone:target.dataset.dropZone as Zone});return;}
    const corners=Array.from(ownArea.current.querySelectorAll('.corner')).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y};});
    try{
      let p=boardPoint(corners,{x:e.clientX,y:e.clientY});
      if(p.x<0||p.x>1||p.y<0||p.y>1)return;
      if(d.card.zone==='battlefield')p={x:Math.max(.06,Math.min(.94,p.x-d.offset.x)),y:Math.max(.1,Math.min(.9,p.y-d.offset.y))};
      if(settings.snap)p={x:Math.round(p.x*14)/14,y:Math.round(p.y*8)/8};
      if(d.card.zone!=='battlefield'){playCard(d.card,e.shiftKey);setSelected([d.card.id]);return;}
      dispatch({type:'position',cardId:d.card.id,...p});if(ownArea.current?.classList.contains('tt-dense-field'))window.dispatchEvent(new CustomEvent('nexus-card-placed',{detail:{cardId:d.card.id,incarnation:d.card.incarnation??0}}));
      setSelected([d.card.id]);
    }catch{setToast('Bitte die Kamera etwas aufrichten.');}
  }
  function Card({card,small=false,positioned=false}:{card:CardInstance;small?:boolean;positioned?:boolean}) {
    const data=instanceDefinition(card);const own=card.controllerId===seat;const stats=markedStats(card,data.power,data.toughness);
    let position=card.position;let moving=false;
    if(positioned&&ghost?.point&&card.controllerId===seat){let host:CardInstance|undefined=card;const seen=new Set<string>();while(host&&!seen.has(host.id)){seen.add(host.id);if(host.id===ghost.card.id){moving=true;position={x:card.position.x+ghost.point.x-ghost.card.position.x,y:card.position.y+ghost.point.y-ghost.card.position.y};break;}host=view.cards.find(c=>c.id===host!.attachedTo);}}
    const effectLinked=view.cards.filter(c=>c.effectLinks?.some(l=>l.sourceId===card.id&&l.sourceIncarnation===(card.incarnation??0)));
    const link=view.cards.find(c=>c.id===card.attachedTo),linked=view.cards.filter(c=>c.attachedTo===card.id);
    return <button key={card.id} className={`card ${card.combat?`combat-${card.combat.kind}`:''} ${moving?'is-dragging':''} ${attaching&&card.id!==editorId&&card.zone==='battlefield'?'attachment-target':''} ${small?'small':''} ${selected.includes(card.id)?'selected':''} ${card.tapped?'tapped':''} ${card.token?'token':''} ${playWindow(view,seat,card,data).allowed?'ready-to-play':''}`}
      style={positioned?{left:`${position.x*100}%`,top:`${position.y*100}%`}:undefined}
      data-card-id={card.id} title={`${data.name}${own?card.zone==='battlefield'?' · T / Doppelklick: tappen':' · Doppelklick / Ziehen: spielen · Umschalt: Priorität halten':''}`} aria-label={`${data.name}${card.tapped?' (getappt)':''}`}
      onPointerEnter={e=>{hoveredCard.current=card.id;if(editorId||drag.current||document.querySelector('.effect-popover,.mana-popover,.correction-popover,.random-panel,.stack-panel,.choice-tray,.tt-toolbar')||e.pointerType==='touch')return;showHover(card,e.currentTarget.getBoundingClientRect());}} onPointerLeave={()=>{hoveredCard.current=null;clearHover();}}
      onClick={e=>{if(attaching&&editorId&&card.zone==='battlefield'){e.stopPropagation();dispatch({type:'attach',cardId:editorId,targetId:card.id});setAttaching(false);return;}if(performance.now()-lastDrag.current<350)return;setPreview(card.cardId);setPreviewInstance(card.id);if(!own){setModal('zoom');return;}if(own&&settings.quickTap&&data.type.includes('Land')&&card.zone==='battlefield'&&!e.shiftKey&&e.detail<2)dispatch({type:'tap',cardId:card.id});if(own)setSelected(old=>e.shiftKey?(old.includes(card.id)?old.filter(id=>id!==card.id):[...old,card.id]):[card.id]);}}
      onDoubleClick={e=>{if(attaching||editorId||performance.now()-lastDrag.current<350)return;if(own&&settings.quickTap&&data.type.includes('Land')&&card.zone==='battlefield')return;if(own&&card.zone==='battlefield')dispatch({type:'tap',cardId:card.id});else if(own&&['hand','commander'].includes(card.zone))playCard(card,e.shiftKey);else setModal('zoom');}}
      onContextMenu={e=>{e.preventDefault();e.stopPropagation();setPreview(card.cardId);setPreviewInstance(card.id);setMenu({id:card.id,x:Math.max(8,Math.min(e.clientX,window.innerWidth-286)),y:Math.max(8,Math.min(e.clientY,window.innerHeight-440))});}}
      onPointerDown={e=>pointerDown(e,card)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;setGhost(null);if(longPress.current)clearTimeout(longPress.current);}}>
      <img src={cardImage(data)} alt={data.name} draggable={false}/>
      {card.combat&&<span className="combat-card-label" title={card.combat.kind==='attack'?'Greift an':'Blockt'}>{card.combat.kind==='attack'?'→':'↳'} {view.players.find(p=>p.id===card.combat?.targetId)?.name??(view.cards.find(c=>c.id===card.combat?.targetId)?instanceDefinition(view.cards.find(c=>c.id===card.combat?.targetId)!).name:'—')}</span>}
      {(view.timedEffects??[]).some(e=>e.targets.some(t=>t.id===card.id&&t.version===(card.incarnation??0)))&&<span className="card-temporary-effect" title={(view.timedEffects??[]).filter(e=>e.targets.some(t=>t.id===card.id&&t.version===(card.incarnation??0))).map(e=>e.label).join(' · ')}>⌛</span>}
      {card.zone==='battlefield'&&card.ownerId!==card.controllerId&&<span className="control-owner" title={`Besitzer: ${view.players.find(p=>p.id===card.ownerId)?.name??'anderer Spieler'}`} aria-label={`Besitzer: ${view.players.find(p=>p.id===card.ownerId)?.name??'anderer Spieler'}`}>⇄</span>}
      {stats.power !== null && stats.toughness !== null && <span className={`base-pt ${stats.modified?'pt-modified':''}`} aria-label={`Werte mit Marken: Stärke ${stats.power}, Widerstandskraft ${stats.toughness}`}>{stats.power}/{stats.toughness}</span>}
      {card.zone==='battlefield'&&!card.faceDown&&data.type.includes('Planeswalker')&&<span className="loyalty-badge" aria-label={`Loyalität ${markerCount(card,'loyalty')}`}>◆ {markerCount(card,'loyalty')}</span>}<span className="card-counter-badges">{cardCounterTypes.filter(type=>markerCount(card,type)>0&&!(type==='loyalty'&&data.type.includes('Planeswalker'))).slice(0,3).map(type=><span key={type} style={{'--counter-color':cardCounters[type].color} as CSSProperties} title={`${cardCounters[type].name}: ${markerCount(card,type)}`}>{cardCounters[type].short} <b>{markerCount(card,type)}</b></span>)}{(card.customCounters??[]).slice(0,2).map(c=><span className="custom-badge" key={c.name} title={`${c.name}: ${c.value}`}>{c.name.slice(0,9)} <b>{c.value}</b></span>)}{cardCounterTypes.filter(type=>markerCount(card,type)>0).length>3||(card.customCounters?.length??0)>2?<span>…</span>:null}</span>
      {effectLinked.length>0&&<span className="card-effect-link-count" title={`${effectLinked.length} Karte(n) im Exil/Friedhof mit dieser Quelle verbunden`}>↗ {effectLinked.length}</span>}
      {(link||linked.length>0)&&<span className="card-link-badge" title={link?`Angelegt an ${instanceDefinition(link).name}`:linked.map(c=>instanceDefinition(c).name).join(', ')} aria-label={link?`Angelegt an ${instanceDefinition(link).name}`:`${linked.length} angelegte Karten`}>{link?'↗':linked.length}</span>}
      {(card.addedKeywords?.length||card.note)&&<span className="card-state-dot" title={[...(card.addedKeywords??[]),card.note].filter(Boolean).join(' · ')}>{card.addedKeywords?.length?`✦ ${card.addedKeywords.length}`:'✎'}</span>}
      {card.token&&<span className={`copy-label ${card.createdToken?'generated-token-label':''}`}>{card.createdToken?'TOKEN':'KOPIE'}</span>}{card.faceDown&&card.cardId!=='hidden-card'&&<span className="copy-label">VERDECKT</span>}
    </button>;
  }
  function openDiscord(){const link=discordURL(settings.discord);if(link)window.open(link,'_blank','noopener,noreferrer');else{setModal('settings');setToast('Trage deinen Discord-Sprachkanal unter Verbindung ein.');}}
  const previewCard=[...view.cards,...view.choiceCards,...view.libraryCards].find(c=>c.id===previewInstance);
  const peek=previewCard?instanceDefinition(previewCard):definition(preview);
  const hoverData=hover?instanceDefinition(view.cards.find(c=>c.id===hover.card.id)??hover.card):null;
  const selectedCard=menu?game.cards.find(c=>c.id===menu.id):undefined;
  const selectedOwn=selectedCard?.controllerId===seat;
  const canDraw=Boolean(view.rules?.stage==='playing'&&!view.rules.pending&&!view.rules.resolving&&!view.rules.stack.length&&!view.rules.lost.includes(seat)&&view.hiddenCounts[seat].library&&(!online||online.connected));
  const drawReason=!view.hiddenCounts[seat].library?'Bibliothek ist leer':view.rules?.pending||view.rules?.resolving?'Laufenden Effekt zuerst abschließen':view.rules?.stack.length?'Ziehen durch einen Spruch: Spielaktionen verwenden':'Ziehen ist gerade nicht verfügbar';
  const handIds=reconcileHand(handOrder,getCards(seat,'hand').map(c=>c.id));
  const handWidth=Math.max(100,Math.min(140,windowSize.height*.14))*(settings.handScale??1.1);
  const handOverlap=Math.min(handWidth*.68,Math.max(0,(handIds.length*handWidth-(windowSize.width-(settings.preview?650:windowSize.width<1000?290:350)))/Math.max(1,handIds.length-1)));
  const css={'--accent':settings.accent,'--card-scale':settings.cardScale,'--ui-scale':settings.uiScale,'--hand-scale':settings.handScale??1} as CSSProperties;
  return <div className={`app tabletop-app ${settings.effects?'atmosphere':''} ${settings.preview?'':'no-preview'}`} style={css} onClick={e=>{if(menu)setMenu(null);if(!(e.target as HTMLElement).closest('button,a,input,select,textarea,.card-near-actions,.hand-dock,.mechanics,.tt-toolbar,[role=dialog]'))setSelected([]);}}>
    <header className="topbar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();onExit();}} aria-label="Zum Hauptmenü"><span className="brand-mark"><Diamond size={25}/><span/></span><b>BATUSMTG</b><span className="brand-sub">COMMANDER</span></a>
      <div className="top-nav"><span className="nav-active"><Swords size={15}/> Arena</span><MatchMenu onVisibilityChange={setMatchOpen} game={game} seat={seat} onHome={onExit} onConcede={()=>dispatch({type:'concede'})} online={online}/></div>
      <div className="top-actions"><button className="preview-toggle" title="Kartenvorschau umschalten" aria-label="Kartenvorschau umschalten" onClick={()=>update('preview',!settings.preview)}>{settings.preview?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}</button><span className="local-badge"><i/> {online?(online.connected?`Verbunden · ${online.code}`:'Verbindung unterbrochen'):'Lokaler Testtisch'}</span><button title="Discord-Sprachkanal öffnen" aria-label="Discord-Sprachkanal öffnen" onClick={openDiscord}><Volume2 size={17}/><span>Discord</span></button><button title="Bedienung" aria-label="Bedienung" onClick={()=>setModal('help')}><CircleHelp size={18}/></button><button title="Einstellungen" aria-label="Einstellungen" onClick={()=>setModal('settings')}><Settings2 size={18}/></button><button className="avatar" aria-label="Benutzerkonto" onClick={()=>setModal('account')}>B</button></div>
    </header>
    <div className="workspace">
      {settings.preview&&<aside className="inspector">
        <div className="inspector-title"><span>KARTENVORSCHAU</span><button aria-label="Vorschau einklappen" onClick={()=>update('preview',false)}><PanelLeftClose size={16}/></button></div>
        <button className="preview-art" onClick={()=>setModal('zoom')} aria-label="Kartenvorschau vergrößern"><img src={cardImage(peek)} alt={peek.name}/><span><Expand size={15}/> Vergrößern</span></button>
        <div className="card-info"><span className="eyebrow">{peek.mana||'KEINE MANAKOSTEN'}</span><h2>{peek.name}</h2><p className="card-type">{peek.type}</p><CardCharacteristics card={peek}/><ArtworkPicker card={peek}/>{previewCard&&<EffectSourceTags card={previewCard} view={view} seat={seat} dispatch={dispatch} onInspect={c=>{setPreview(c.cardId);setPreviewInstance(c.id);}}/>}<div className="rule-divider"/><p className="oracle">{peek.text}</p>{previewCard&&(previewCard.addedKeywords?.length||previewCard.note||previewCard.powerOverride!==undefined||previewCard.toughnessOverride!==undefined)?<div className="preview-manual-state"><b>Am Tisch angepasst</b><p>{[previewCard.powerOverride!==undefined||previewCard.toughnessOverride!==undefined?`${markedStats(previewCard,peek.power,peek.toughness).power??'–'}/${markedStats(previewCard,peek.power,peek.toughness).toughness??'–'}`:'',...(previewCard.addedKeywords??[]),previewCard.note].filter(Boolean).join(' · ')}</p></div>:null}<a className="artist" href={peek.source} target="_blank" rel="noreferrer">Illustration · {peek.artist} ↗</a></div>
        <div className="inspector-bottom"><MousePointer2 size={16}/><p>Karte auswählen<br/><span><kbd>T</kbd> Tappen <kbd>C</kbd> Kopieren</span></p></div>
      </aside>}
      <main className="game-client">
        <div className="table-heading"><div>{!settings.preview&&<button aria-label="Vorschau ausklappen" onClick={()=>update('preview',true)}><PanelLeftOpen size={18}/></button>}<span className="eyebrow">DEINE ARENA</span><h1>Commander <span>/</span> Regelassistent</h1></div><div className="table-meta"><span><Shield size={13}/> {game.players.length} Plätze</span>{!online&&<label>Sicht <select aria-label="Spielerperspektive" value={seat} onChange={e=>setSeat(e.target.value)}>{game.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}</div></div>
        <div className="turnbar"><div className="turn-label"><span>ZUG <b>{game.turn.toString().padStart(2,'0')}</b></span><i/>{game.players.find(p=>p.id===game.activePlayer)!.name} am Zug</div>{!view.rules?.turnOnly&&<div className="phases">{settings.simpleControls!==false?['Upkeep','Spielzug','Endstep'].map(p=><span key={p} className={p===turnStage(game.phase)?'current':''}>{p}</span>):phases.map((p,i)=><span key={p} className={i===game.phase?'current':''}>{p}</span>)}</div>}{!view.rules?.turnOnly&&settings.simpleControls===false&&<button className="phase-next" disabled={view.rules?.priority!==seat||Boolean(view.rules?.pending)||view.rules?.stage!=='playing'} title="Priorität abgeben" aria-label="Priorität abgeben" onClick={()=>dispatch({type:'nextPhase'})}><ChevronRight size={18}/></button>}</div>
        <MechanicsPanel defaultAutoTap={settings.autoTap===true} onHover={showHover} onHoverEnd={clearHover} directTargets={settings.simpleControls!==false} passPriority={!holdCast&&settings.holdPriority!==true} phaseControls={<PhaseControls view={view} seat={seat} active={active} blocked={Boolean(modal||zone||castId||menu||matchOpen||ghost||editorId)} settings={settings} setSettings={setSettings} dispatch={dispatch} online={online}/>} active={active} autoStack={settings.autoStack===true} searchRequest={searchRequest} view={view} seat={seat} dispatch={dispatch} castId={castId} onCast={id=>{const card=view.cards.find(c=>c.id===id);if(card)playCard(card);}} closeCast={()=>setCastId(null)} onInspect={card=>{setPreview(card.cardId);setPreviewInstance(card.id);setModal('zoom');}}/>
        <Tabletop view={view} seat={seat} active={active} settings={settings} setSettings={setSettings} ownArea={ownArea} renderCard={(card,positioned=false)=>Card({card,positioned})} dispatch={dispatch} playCard={playCard} onInspect={inspectOpponent} openZone={(player,zone)=>{setModal(null);setMenu(null);setZone({player,zone});}} openPlayerCounters={()=>{setDamageSource(undefined);setModal('playerCounters');}} onSeatChange={online?undefined:setSeat}/>
        <section className={`hand-dock ${selected.length?'with-selection':''}`} aria-label="Deine Hand">
          <SelectionActions active={active&&!modal&&!zone&&!menu&&!castId&&!matchOpen&&!editorId} cards={view.cards.filter(c=>selected.includes(c.id)&&c.controllerId===seat&&c.zone!=='stack')} dispatch={dispatch} onInspect={inspectOpponent} onCounter={openCounters} onPlay={playCard} onClear={()=>setSelected([])}/>
          <div className="hand-label"><span className="eyebrow">DEINE HAND <b>{getCards(seat,'hand').length}</b></span><span><Eye size={12}/> Nur für dich sichtbar</span></div>
          <div className="hand-cards" style={{'--hand-overlap':`${handOverlap}px`} as CSSProperties} onWheel={e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&e.currentTarget.scrollWidth>e.currentTarget.clientWidth){e.currentTarget.scrollLeft+=e.deltaY;e.stopPropagation();}}}>{handIds.map((id,index)=>{const c=getCards(seat,'hand').find(c=>c.id===id)!;return <div className="hand-slot" style={{'--fan-angle':`${Math.max(-7,Math.min(7,(index-(handIds.length-1)/2)*1.5))}deg`,'--fan-rise':`${Math.min(18,Math.abs(index-(handIds.length-1)/2)*3)}px`,zIndex:index+1} as CSSProperties} data-hand-id={c.id} key={c.id} onKeyDown={e=>{if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const ids=reconcileHand(handOrder,getCards(seat,'hand').map(c=>c.id)),index=ids.indexOf(c.id),target=ids[index+(e.key==='ArrowLeft'?-1:1)];if(target)saveHandOrder(moveHandCard(ids,c.id,target,e.key==='ArrowRight'));}}}>{Card({card:c})}<span title={definition(c.cardId).name}>{definition(c.cardId).name}</span></div>;})}{getCards(seat,'hand').length===0&&<p className="empty-field">Deine Hand ist leer.</p>}</div>
          <div className="hand-actions"><button title="Counter · M" aria-label="Counter öffnen" className="quick-counters" disabled={!selected.some(id=>game.cards.find(c=>c.id===id)?.controllerId===seat)} onClick={()=>selected[0]&&openCounters(selected[0])}><Layers size={24}/></button><button title={canDraw?'Eine Karte ziehen · D':drawReason} aria-label="Eine Karte ziehen" className="primary" onClick={()=>dispatch({type:'draw'})} disabled={!canDraw}><ArrowDownToLine size={24}/></button><button title="Alles enttappen" aria-label="Alles enttappen" onClick={()=>dispatch({type:'untapAll'})}><RotateCcw size={24}/></button><button title="Raster umschalten" aria-label="Raster umschalten" className="snap-toggle" aria-pressed={settings.snap} onClick={()=>update('snap',!settings.snap)}><Grid2X2 size={24}/></button></div>
        </section>
        <footer className="statusbar"><span><i/> {online?'Multiplayer · Stack & Regelassistent':'Lokaler Testtisch · Regelassistent'}</span><button onClick={()=>setModal('log')}><BookOpen size={12}/>{game.log.at(-1)}<ChevronRight size={12}/></button><button onClick={()=>setModal('help')}><CircleHelp size={12}/> Steuerung</button></footer>
      </main>
    </div>
    {zone&&<ZoneBrowser key={`${zone.player}-${zone.zone}`} zone={zone.zone} player={zone.player} seat={seat} view={view} dispatch={dispatch} onClose={()=>{setZone(null);clearHover();}} onInspect={inspectOpponent} onHover={showHover} onHoverEnd={clearHover}/>}
    <GameActivity view={view} active={active&&settings.activityHints===true}/>{hover&&hoverData&&!modal&&!menu&&!castId&&!matchOpen&&!ghost&&!editorId&&active&&<div className="hover-zoom" style={{left:hover.x,top:hover.y}}><img src={cardImage(hoverData)} alt={`${hoverData.name} vergrößert`}/><span>MANAWERT {hoverData.manaValue} · LEERTASTE FÜR DETAILS</span></div>}
    {online&&(!online.connected||online.error)&&<div className="network-banner" role="status">{online.error||'Verbindung unterbrochen. Dein Platz bleibt reserviert …'}</div>}
    {ghost&&!ghost.point&&<img className="drag-ghost" src={cardImage(instanceDefinition(ghost.card))} style={{left:ghost.x,top:ghost.y}} alt=""/>}
    {active&&editorCard&&<CardEditor key={editorCard.id} card={editorCard} view={view} dispatch={dispatch} attaching={attaching} onAttach={setAttaching} onClose={closeEditor} onInspect={c=>{closeEditor();setPreview(c.cardId);setPreviewInstance(c.id);setModal('zoom');}}/>}
    {attaching&&editorCard&&<div className="attachment-prompt" role="status"><span>Ziel auf dem Spielfeld anklicken</span><button onClick={()=>setAttaching(false)} aria-label="Zielwahl abbrechen"><X size={16}/></button></div>}
    {menu&&selectedCard&&<CardMenu card={selectedCard} own={selectedOwn} playAllowed={playWindow(view,seat,selectedCard,definition(selectedCard.cardId)).allowed} playHint={playWindow(view,seat,selectedCard,definition(selectedCard.cardId)).reason} x={menu.x} y={menu.y} dispatch={dispatch} onInspect={()=>{setModal('zoom');setMenu(null);}} onCounter={()=>openCounters(selectedCard.id)} onDamage={()=>{setDamageSource(selectedCard.id);setMenu(null);setModal('playerCounters');}} onEdit={()=>{setMenu(null);setEditorId(selectedCard.id);setAttaching(false);clearHover();}} onPlay={()=>{playCard(selectedCard);setMenu(null);}} onClose={()=>setMenu(null)}/>}

    {modal&&<div className="scrim" onPointerDown={e=>{if(e.target===e.currentTarget){setModal(null);setZone(null);}}}><section role="dialog" aria-modal="true" aria-label={zone?zoneNames[zone.zone]:modal==='zoom'?peek.name:modal==='settings'?'Einstellungen':modal==='help'?'Steuerung':modal==='account'?'Benutzerkonto':modal==='counters'?'Karten-Counter':modal==='playerCounters'?'Spieler-Counter':'Spielprotokoll'} className={`modal ${modal==='zoom'?'zoom-modal':''} ${modal==='counters'||modal==='playerCounters'?'counter-modal':''}`}><button className="close" aria-label="Schließen" onClick={()=>{setModal(null);setZone(null);}} autoFocus><X size={20}/></button>
      {modal==='zoom'&&<><img className="zoom-image" src={cardImage(peek)} alt={peek.name}/><div><span className="eyebrow">KARTENDETAILS</span><h2>{peek.name}</h2><p>{peek.type}</p><CardCharacteristics card={peek}/><ArtworkPicker card={peek}/>{previewCard&&<EffectSourceTags card={previewCard} view={view} seat={seat} dispatch={dispatch} onInspect={c=>{setPreview(c.cardId);setPreviewInstance(c.id);}}/>}<p className="oracle">{peek.text}</p>{previewCard&&(previewCard.addedKeywords?.length||previewCard.note||previewCard.powerOverride!==undefined||previewCard.toughnessOverride!==undefined)?<div className="preview-manual-state"><b>Am Tisch angepasst</b><p>{[previewCard.powerOverride!==undefined||previewCard.toughnessOverride!==undefined?`${markedStats(previewCard,peek.power,peek.toughness).power??'–'}/${markedStats(previewCard,peek.power,peek.toughness).toughness??'–'}`:'',...(previewCard.addedKeywords??[]),previewCard.note].filter(Boolean).join(' · ')}</p></div>:null}<a href={peek.source} target="_blank" rel="noreferrer">Auf Scryfall ansehen ↗</a>{selected.map(id=>game.cards.find(c=>c.id===id)).filter(c=>c && c.cardId===preview && c.controllerId===seat).slice(0,1).map(c=>c && <div className="touch-actions" key={c.id}><button className="secondary" onClick={()=>openCounters(c.id)}>Counter</button>{c.zone==='battlefield'?<><button className="secondary" onClick={()=>dispatch({type:'tap',cardId:c.id})}>Tappen / Enttappen</button><button className="secondary" onClick={()=>dispatch({type:'copy',cardId:c.id,newId:uuid()})}>Kopie</button></>:<button className="secondary" onClick={()=>{playCard(c);setModal(null);}}>Ins Spiel</button>}<button className="secondary" onClick={()=>{dispatch({type:'move',cardId:c.id,zone:'graveyard'});setModal(null);}}>Friedhof</button></div>)}</div></>}
      {modal==='counters'&&<CounterMenu card={game.cards.find(c=>c.id===counterTarget&&c.controllerId===seat)} dispatch={dispatch}/>}
      {modal==='playerCounters'&&<CounterMenu key={damageSource??'player'} player={me} view={view} dispatch={dispatch} damageSource={damageSource}/>}
      {modal==='settings'&&<SettingsPanel settings={settings} onChange={setSettings}/>}
      {modal==='help'&&<><h2>Steuerung</h2><CommandGuide/></>}
      {modal==='account'&&<><span className="eyebrow">DEIN COMMANDER-ZUHAUSE</span><h2>Ein Konto. Alle deine Decks.</h2><p>Deine Kontoeinstellungen und gespeicherten Decks findest du im Hauptmenü.</p><div className="notice"><Shield size={24}/><div><b>Konto und Discord</b><p>Öffne das Hauptmenü, um dich anzumelden oder deine gespeicherten Decks zu verwalten.</p></div></div></>}
      {modal==='log'&&<><span className="eyebrow">DEINE PARTIE</span><h2>Spielprotokoll</h2><ol className="log-list">{game.log.map((l,i)=><li key={i}>{l}</li>)}</ol>{!online&&<button className="secondary" onClick={()=>{setGame(enableRules(initialGame()));setSelected([]);setModal(null);}}>Beispielspiel zurücksetzen</button>}</>}
    </section></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </div>;
}



