import {readFile,writeFile} from 'node:fs/promises';
const source='https://magic.wizards.com/en/news/announcements/starter-commander-decks-decklists-2022-10-20';
const themes={'First Flight':'Fliegende Kreaturen','Grave Danger':'Zombies & Friedhof','Chaos Incarnate':'Politik & Schaden','Draconic Destruction':'Drachen','Token Triumph':'Kreaturenspielsteine'};
const r=await fetch(source);if(!r.ok)throw Error(`Decklisten ${r.status}`);const html=await r.text();
const cards=JSON.parse(await readFile('src/cards.json','utf8')),byName=new Map(cards.map(c=>[c.name,c])),decks=[];
for(const match of html.matchAll(/<deck-list deck-title="([^"]+)"[^>]*>\s*<main-deck>(.*?)<\/main-deck>/gs)){
 const name=match[1];if(!themes[name])continue;const lines=match[2].trim().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);let commanderId;const quantities={};
 for(const [i,line] of lines.entries()){const m=line.replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").match(/^(\d+) (.+)$/);if(!m)throw Error('Unbekanntes Decklistenformat');const c=byName.get(m[2]);if(!c)throw Error(`Karte fehlt: ${m[2]}`);if(i===0)commanderId=c.id;else quantities[c.id]=Number(m[1]);}
 if(Object.values(quantities).reduce((a,b)=>a+b,0)!==99)throw Error(`Unvollständiges Deck: ${name}`);
 decks.push({id:'precon-'+name.toLowerCase().replaceAll(' ','-'),name,commanderId,quantities,notes:'Offizielle Starter-Commander-Deckliste (2022). '+themes[name]});
}
if(decks.length!==5)throw Error('Unvollständige Sammlung; vorhandene Decks unverändert');
await writeFile('shared/preconstructed.json',JSON.stringify(decks));console.log('Fünf vollständige Starter-Commander-Decks aktualisiert');
