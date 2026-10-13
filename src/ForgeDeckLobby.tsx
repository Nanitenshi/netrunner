import {useEffect,useState} from 'react';
import {readDecks} from './decks';
import {api,type Network} from './network';
import type {DeckData} from '../shared/protocol';
import {toForgeDeck} from '../shared/forge-decks';
import PregameDecks from './PregameDecks';
export default function ForgeDeckLobby({net,disabled,onSend}:{net:Network;disabled:boolean;onSend:(event:string,input:unknown)=>Promise<unknown>}){
 const [decks,setDecks]=useState<DeckData[]>(readDecks),[error,setError]=useState('');const room=net.forgeRoom!;
 useEffect(()=>{let live=true;void api<{decks:DeckData[]}>('/api/decks').then(data=>{if(live)setDecks([...new Map([...readDecks(),...data.decks].map(d=>[d.id,d])).values()]);}).catch(()=>{if(live)setError('Kontodecks konnten nicht geladen werden. Lokal gespeicherte Decks bleiben verfügbar.');});return()=>{live=false;};},[net.user?.id]);
 const ready=room.players.find(p=>p.id===net.user?.id)?.ready===true;
 return <section className="forge-deck-lobby"><h2>Commander mit eigenen Decks</h2><p>Zwei Spieler · 40 Leben · kostenlose Mulligans auf sieben · Hausregel: 100–250 Karten einschließlich Commander.</p><p>Wähle ein gespeichertes oder vorbereitetes Deck. Forge prüft beim Start, ob seine Kartenscripts verfügbar sind. Der Modus ist experimentell; einige Sonderkosten und Kartenauswahlen werden noch nicht unterstützt.</p>{error&&<p role="status">{error}</p>}{Boolean(room.deckErrors?.length)&&<div className="forge-deck-errors" role="alert"><strong>Diese Karten kennt die installierte Forge-Version noch nicht:</strong><ul>{room.deckErrors!.map(name=><li key={name}>{name}</li>)}</ul><p>Deck anpassen und erneut auswählen. Es werden keine Ersatzkarten eingesetzt.</p></div>}
 <div className="forge-deck-seats">{room.players.map(p=><article key={p.id}><b>{p.name}</b><span>{p.deckName??'Wählt ein Deck'}{p.cardCount&&(' · '+p.cardCount+' Karten')}</span><small>{p.commander}</small><strong>{p.ready?'Bereit':'Noch nicht bereit'}</strong></article>)}</div>
 <PregameDecks decks={decks} selectedId={room.myDeck?.id??''} disabled={disabled} onChoose={async deck=>{try{toForgeDeck(deck,net.user!.name);setError('');await onSend('forge:deck',deck);}catch(e){setError(e instanceof Error?e.message:'Deck nicht verfügbar');}}}/>
 <button disabled={disabled||!room.myDeck} onClick={()=>void onSend('forge:ready',{ready:!ready})}>{ready?'Bereitschaft zurücknehmen':'Mit diesem Deck bereit'}</button>
 </section>;
}
