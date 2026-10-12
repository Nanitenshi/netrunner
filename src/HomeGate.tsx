import TavernEnvironment from './TavernEnvironment';
import type {Settings} from './settings';
import {isCommander} from '../shared/catalogue';
import ArtworkPicker from './ArtworkPicker';
import {cardArt} from './artworks';
import {cardImage} from './artworks';
import {useState,type CSSProperties} from 'react';
import {ArrowUpRight,ArrowRight,Swords,Layers,UserRound,Settings2,Volume2,Compass,Diamond} from 'lucide-react';
import {cards} from './seed';
type Destination='lobby'|'arena'|'decks'|'account'|'settings';
export default function HomeGate({settings,setSettings,name,playing,serverReady,roomCode,playerCount,onNavigate,onDiscord}:{settings:Settings;setSettings:(value:Settings)=>void;name:string;playing:boolean;serverReady:boolean;roomCode?:string;playerCount?:number;onNavigate:(to:Destination)=>void;onDiscord:()=>void}){
 const defaultLegends=['The Ur-Dragon',"Atraxa, Praetors' Voice",'Edgar Markov','Muldrotha, the Gravetide'].map(name=>cards.find(c=>c.name===name)!);
 const legends=defaultLegends.map((fallback,i)=>cards.find(c=>c.id===settings.menuCommanders?.[i]&&isCommander(c))??fallback);
 const [motifsOpen,setMotifsOpen]=useState(false),[motifQuery,setMotifQuery]=useState('');
 const motifChoices=cards.filter(c=>isCommander(c)&&c.name.toLowerCase().includes(motifQuery.toLowerCase())).slice(0,100);
 const changeMotif=(index:number,id:string)=>{const next=legends.map(c=>c.id);next[index]=id;setSettings({...settings,menuCommanders:next});};
 const [legend,setLegend]=useState(0),chosen=legends[legend];
 const commands=[
  {name:playing?'Partie fortsetzen':'Online spielen',sub:playing?'Laufende Partie öffnen':'Raum erstellen oder beitreten',Icon:Swords,action:()=>onNavigate(playing?'arena':'lobby'),theme:'cyan'},
  {name:'Deckersteller',sub:'Decks bauen, importieren und verwalten',Icon:Layers,action:()=>onNavigate('decks'),theme:'violet'},
  {name:playing?'Spielraum':'Freier Testtisch',sub:playing?'Raumcode und Mitspieler':'Lokale Partie zum Testen',Icon:Compass,action:()=>onNavigate(playing?'lobby':'arena'),theme:'gold'},
  {name:'Konto',sub:'Profil, Anmeldung & Decks',Icon:UserRound,action:()=>onNavigate('account'),theme:'cyan'},
  {name:'Einstellungen',sub:'Kamera, Karten und Farben anpassen',Icon:Settings2,action:()=>onNavigate('settings'),theme:'violet'},
  {name:'Sprachkanal',sub:'Deinen hinterlegten Discord-Kanal öffnen',Icon:Volume2,action:onDiscord,theme:'gold'},
 ];
 const menu=(start:number)=><div className={`gate-commands ${start===0?'gate-left':'gate-right'}`}>{commands.slice(start,start+3).map((item,i)=><button className={`gate-command gate-${item.theme}`} onClick={item.action} key={item.name}><span className="gate-command-icon"><item.Icon size={27}/></span><span><small>0{start+i+1}</small><b>{item.name}</b><em>{item.sub}</em></span><ArrowUpRight size={17}/></button>)}</div>;
 return <section className="home-gate" style={{'--gate-art':`url('${cardArt(chosen)}')`} as CSSProperties} aria-label="BatusMTG Hauptmenü">
  <TavernEnvironment animated={settings.effects}/><div className="gate-art"/><div className="gate-grid"/><div className="gate-beam beam-one"/><div className="gate-beam beam-two"/>
  <div className="gate-welcome"><span className="gate-live"><i/>{serverReady?'SPIELSERVER ERREICHBAR':'LOKALER SPIELTISCH'}</span><p><b>{name}</b></p></div>
  <div className="gate-layout">{menu(0)}<div className="gate-center">
   <div className="gate-title"><h1>BATUS<span>MTG</span></h1><p><i/> COMMANDER <i/></p></div>
   <div className="gate-summoning" aria-hidden="true"><div className="gate-ring ring-a"/><div className="gate-ring ring-b"/><div className="gate-ring ring-c"/><div className="gate-card-halo"/><img className="gate-flank flank-left" src={cardImage(legends[(legend+1)%4])} alt=""/><img className="gate-flank flank-right" src={cardImage(legends[(legend+2)%4])} alt=""/><img key={chosen.id+cardImage(chosen)} className="gate-legend" src={cardImage(chosen)} alt=""/><div className="gate-plinth"/><div className="gate-sigil"><Diamond size={20}/></div></div>
   <div className="gate-legend-picker" aria-label="Menümotiv wählen">{legends.map((l,i)=><button key={l.id} aria-label={`Menümotiv ${l.name}`} aria-pressed={i===legend} onClick={()=>setLegend(i)}><img src={cardImage(l)} alt=""/></button>)}</div>
   <p className="gate-legend-name">{chosen.name}</p><button className="motif-toggle" onClick={()=>setMotifsOpen(v=>!v)} aria-expanded={motifsOpen}>Commander-Motive ändern</button>{motifsOpen&&<div className="motif-editor"><label>Commander-Motiv suchen<input aria-label="Commander-Motiv suchen" value={motifQuery} placeholder="Beliebigen Commander suchen …" onChange={e=>setMotifQuery(e.target.value)}/></label>{legends.map((c,i)=>{const options=[c,...motifChoices.filter(x=>x.id!==c.id)];return <label key={i}>Motiv {i+1}<select aria-label={`Commander-Motiv ${i+1}`} value={c.id} onChange={e=>changeMotif(i,e.target.value)}>{options.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>;})}<ArtworkPicker card={chosen}/><button onClick={()=>setSettings({...settings,menuCommanders:undefined})}>Standardmotive wiederherstellen</button></div>}
   <button className="gate-play" onClick={()=>onNavigate(playing?'arena':'lobby')}><Swords size={20}/><span>{playing?'PARTIE FORTSETZEN':'ONLINE SPIELEN'}</span><ArrowRight size={20}/></button>
   <span className="gate-mode">COMMANDER <i/> 2–4 SPIELER</span>
  </div>{menu(3)}</div>
  {playing&&<div className="gate-room-status"><span className="gate-live"><i/> PARTIE LÄUFT</span><b>Raum {roomCode}</b><span>{playerCount} Spieler · dein Platz ist reserviert</span><button onClick={()=>onNavigate('arena')}>Partie fortsetzen <ArrowRight size={14}/></button></div>}

 </section>;
}

