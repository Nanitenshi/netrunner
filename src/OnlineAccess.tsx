import {useState} from 'react';
import type {Network} from './network';

export default function OnlineAccess({net}:{net:Network}){
 const [name,setName]=useState(()=>{try{return localStorage.getItem('nexus.profileName')||'Planeswalker';}catch{return 'Planeswalker';}});
 const [busy,setBusy]=useState(false);
 return <div className="lobby-login">
  {net.guestEnabled&&<form onSubmit={async e=>{e.preventDefault();if(busy||!name.trim())return;setBusy(true);try{await net.guest(name.trim());}finally{setBusy(false);}}}>
   <span className="micro-label">OHNE DISCORD</span><h3>Als Gast online spielen</h3>
   <label>Spielname<input aria-label="Spielname" value={name} maxLength={30} required disabled={busy} onChange={e=>setName(e.target.value)}/></label>
   <button className="nexus-button" type="submit" disabled={busy||!net.available||!name.trim()}>{busy?'Verbindung wird hergestellt …':'Als Gast spielen'}</button>
   <p>Deine Decksammlung wird lokal in diesem Browser gespeichert. Für ein anderes Gerät kannst du deine Decks exportieren und dort importieren.</p>
  </form>}
  <div><h2>{net.guestEnabled?'Discord ist optional':'Discord-Anmeldung'}</h2><p>{net.discordReady?'Mit Discord kannst du Decks zusätzlich in deinem Konto speichern.':'Discord-Anmeldung ist auf diesem Server nicht verfügbar.'}</p>
   {net.discordReady&&<a className="nexus-button" href="/auth/discord">Mit Discord anmelden ↗</a>}
   {!net.guestEnabled&&<p>{net.available?'Der Betreiber hat den Gastzugang deaktiviert.':'Verbindung zum Spielserver wird geprüft.'}</p>}
  </div>
 </div>;
}
