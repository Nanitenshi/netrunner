import SpellTargets,{needsSpellTarget} from './SpellTargets';
import {useState} from 'react';
import {Check,Link2,Unlink,X,RotateCcw} from 'lucide-react';
import type {CardInstance,GameAction,GameView} from '../shared/game';
import {cardKeywords,editableStat,hasPhysicalFaces,instanceDefinition,type CardKeyword} from '../shared/card-state';
import {markedStats} from '../shared/counters';
import {definition} from './seed';
import {cardImage} from './artworks';
import {useTablePanel} from './useTablePanel';
import './card-editor.css';

const keywordNames:Record<CardKeyword,string>={Flying:'Fliegend',Vigilance:'Wachsam',Trample:'Trampeln',Haste:'Eile',Lifelink:'Lebensverknüpfung',Deathtouch:'Todesberührung','First strike':'Erstschlag','Double strike':'Doppelschlag',Reach:'Reichweite',Hexproof:'Fluchsicher',Indestructible:'Unzerstörbar',Menace:'Bedrohlich'};
export default function CardEditor({card,view,dispatch,attaching,onAttach,onClose,onInspect}:{card:CardInstance;view:GameView;dispatch:(a:GameAction)=>void;attaching:boolean;onAttach:(enabled:boolean)=>void;onClose:()=>void;onInspect?:(card:CardInstance)=>void}){
 const data=instanceDefinition(card),base=definition(card.cardId),stats=markedStats(card,data.power,data.toughness);
 const [power,setPower]=useState(card.powerOverride??''),[toughness,setToughness]=useState(card.toughnessOverride??''),[note,setNote]=useState(card.note??'');
 const target=view.cards.find(c=>c.id===card.attachedTo),linked=view.cards.filter(c=>c.attachedTo===card.id);
 const related=view.cards.filter(c=>c.effectLinks?.some(l=>l.sourceId===card.id&&l.sourceIncarnation===(card.incarnation??0)));
 const [copySpellId,setCopySpellId]=useState(''),[copyTarget,setCopyTarget]=useState('');
 const copySpells=related.filter(c=>c.cardId!=='hidden-card'&&/Instant|Sorcery/.test(instanceDefinition(c).type)),copySpell=copySpells.find(c=>c.id===copySpellId)??copySpells[0];
 const invalid=!!power&&!editableStat(power)||!!toughness&&!editableStat(toughness);
 const patch=(values:Parameters<typeof dispatch>[0]&{type:'editCard'})=>dispatch(values);
 useTablePanel('card-editor',true,onClose,'.card-editor,.card,.attachment-prompt');
 return <aside className={`card-editor ${attaching?'is-targeting':''}`} aria-label="Karte bearbeiten">
  <header><img src={cardImage(data)} alt=""/><div><small>KARTE BEARBEITEN</small><b>{data.name}</b></div><button onClick={onClose} aria-label="Karteneditor schließen"><X size={18}/></button></header>
  <div className="card-editor-body">
   {hasPhysicalFaces(base)&&!card.faceDown&&<div className="card-face-choices" aria-label="Kartenseite">{base.faces.map((face,i)=><button key={face.name} aria-pressed={(card.faceIndex??0)===i} onClick={()=>patch({type:'editCard',cardId:card.id,patch:{faceIndex:i}})}><span>{i===0?'Vorderseite':'Rückseite'}</span><b>{face.name}</b></button>)}</div>}
   <form className="card-stat-form" onSubmit={e=>{e.preventDefault();if(!invalid)patch({type:'editCard',cardId:card.id,patch:{power:power||null,toughness:toughness||null}});}}>
    <div className="card-edit-heading"><b>Stärke / Widerstandskraft</b><span>{stats.power??'–'} / {stats.toughness??'–'}</span></div>
    <div className="card-stat-inputs"><label>Stärke<input aria-label="Grundstärke" inputMode="text" maxLength={5} placeholder={data.power??'–'} value={power} onChange={e=>setPower(e.target.value)}/></label><span>/</span><label>Widerstand<input aria-label="Grundwiderstandskraft" maxLength={5} placeholder={data.toughness??'–'} value={toughness} onChange={e=>setToughness(e.target.value)}/></label><button type="submit" disabled={invalid} aria-label="Werte übernehmen" title="Werte übernehmen"><Check size={18}/></button><button type="button" aria-label="Gedruckte Werte wiederherstellen" title="Gedruckte Werte" onClick={()=>{setPower('');setToughness('');patch({type:'editCard',cardId:card.id,patch:{power:null,toughness:null}});}}><RotateCcw size={16}/></button></div>
    <small>{invalid?'Zahl, * oder 1+* eingeben.':'+1/+1- und −1/−1-Marken werden dazugezählt.'}</small>
   </form>
   <section><div className="card-edit-heading"><b>Zusätzliche Fähigkeiten</b><small>Manuell</small></div><div className="card-keywords">{cardKeywords.map(keyword=><button key={keyword} aria-pressed={card.addedKeywords?.includes(keyword)??false} onClick={()=>patch({type:'editCard',cardId:card.id,patch:{keywords:card.addedKeywords?.includes(keyword)?card.addedKeywords.filter(k=>k!==keyword):[...(card.addedKeywords??[]),keyword]}})}>{keywordNames[keyword]}</button>)}</div></section>
   {(target||/(?:Aura|Equipment|Fortification)\b/.test(data.type))&&<section className="card-attachment-editor"><div className="card-edit-heading"><b>Angelegt</b>{target&&<button aria-label="Verbindung lösen" title="Verbindung lösen" onClick={()=>dispatch({type:'attach',cardId:card.id,targetId:null})}><Unlink size={16}/></button>}</div>{target&&<p>{instanceDefinition(target).name}<small>{view.players.find(p=>p.id===target.controllerId)?.name}</small></p>}<button className={attaching?'is-selecting':''} aria-pressed={attaching} onClick={()=>onAttach(!attaching)}><Link2 size={16}/>{attaching?'Zielwahl abbrechen':target?'Anderes Ziel wählen':'An Karte anlegen'}</button><small>Kosten und Ziele mit der Runde regeln.</small></section>}
   {linked.length>0&&<section className="card-linked-list"><b>An dieser Karte</b>{linked.map(c=><span key={c.id}><Link2 size={12}/>{instanceDefinition(c).name}</span>)}</section>}
   {related.length>0&&<section className="source-related-cards"><div className="card-edit-heading"><b>Mit dieser Quelle verbunden</b><small>{related.length}</small></div><div className="linked-action-row">{(["hand","battlefield","copy"] as const).map(operation=><button key={operation} onClick={()=>dispatch({type:"linkedCards",sourceId:card.id,cardIds:related.filter(c=>c.cardId!=="hidden-card"&&(operation!=="copy"||!/Instant|Sorcery/.test(instanceDefinition(c).type))).map(c=>c.id),operation})} disabled={!related.some(c=>c.cardId!=="hidden-card"&&(operation!=="copy"||!/Instant|Sorcery/.test(instanceDefinition(c).type)))}>{operation==="hand"?"Zurück auf die Hand":operation==="battlefield"?"Zurück aufs Feld":"Permanent-Kopien"}</button>)}</div>{copySpell&&<div className="linked-spell-copy"><label>Spruchkarte<select aria-label="Verknüpfte Spruchkarte kopieren" value={copySpell.id} onChange={e=>{setCopySpellId(e.target.value);setCopyTarget('');}}>{copySpells.map(c=><option key={c.id} value={c.id}>{instanceDefinition(c).name}</option>)}</select></label><SpellTargets card={copySpell} view={view} value={copyTarget} onChange={setCopyTarget}/><button disabled={needsSpellTarget(copySpell)&&!copyTarget} onClick={()=>dispatch({type:'linkedCards',sourceId:card.id,cardIds:[copySpell.id],operation:'spellCopy',...(copyTarget?{targetId:copyTarget}:{})})}>Kopie kostenlos wirken</button></div>}<div>{related.map(c=><button key={c.id} aria-label={`Verknüpfte Karte ${c.cardId==='hidden-card'?'Verdeckt':instanceDefinition(c).name} ansehen`} onClick={()=>onInspect?.(c)} title={c.cardId==='hidden-card'?'Verdeckte Karte':instanceDefinition(c).name}><img src={cardImage(instanceDefinition(c))} alt=""/><span>{c.cardId==='hidden-card'?'Verdeckt':instanceDefinition(c).name}<small>{c.zone==='exile'?'Exil':'Friedhof'} · {view.players.find(p=>p.id===c.ownerId)?.name}</small></span></button>)}</div></section>}
   <form className="card-note-form" onSubmit={e=>{e.preventDefault();patch({type:'editCard',cardId:card.id,patch:{note}});}}><label htmlFor="card-public-note">Notiz für den Tisch</label><div><input id="card-public-note" maxLength={160} value={note} placeholder="z. B. +3/+0 bis Zugende" onChange={e=>setNote(e.target.value)}/><button type="submit" aria-label="Notiz speichern"><Check size={16}/></button></div></form>
   <small className="card-edit-footnote">Effekte, Bedingungen und Dauer bleiben manuell. Änderungen gelten bis zum Zonenwechsel.</small>
  </div>
 </aside>;
}
