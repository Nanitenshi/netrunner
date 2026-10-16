import type {ForgeCard} from '../shared/forge-protocol';
import {forgeRuleText} from './forge-card-rules';
export default function ForgeRuleStatus({card,cards=[]}:{card:ForgeCard;cards?:ForgeCard[]}){
 const r=card.rules;if(!r)return null;
 const name=(id:string)=>cards.find(c=>c.id===id)?.name??(id.startsWith('player:')?`Spieler ${Number(id.slice(7))+1}`:'Karte');
 return <section className="forge-rule-status" aria-label="Aktueller Kartenstatus"><h3>Aktueller Kartenstatus</h3><p>{card.type}{card.power!==undefined?` · ${card.power}/${card.toughness}`:''}</p>
 <dl><div><dt>Marken</dt><dd>{Object.entries(r.counters).filter(([,n])=>n>0).map(([type,n])=>`${type} ×${n}`).join(' · ')||'keine'}</dd></div><div><dt>Markierter Schaden</dt><dd>{r.damage}</dd></div><div><dt>Regenerationsschutz</dt><dd>{r.regenerationShields||'keiner'}</dd></div>{card.type.includes('Creature')&&<div><dt>Einsatzverzögerung</dt><dd>{r.summoningSick?'aktiv':'keine Einschränkung'}</dd></div>}</dl>
 {r.regenerationShields>0&&<p>Schützt vor der nächsten passenden Zerstörung. Verhindert kein Opfern, Exil oder Sterben durch Widerstandskraft 0.</p>}
 {r.attachedTo&&<p>Angelegt an: <b>{name(r.attachedTo)}</b></p>}{r.attachments.length>0&&<p>Angelegte Karten: {r.attachments.map(name).join(' · ')}</p>}
 {r.keywords.length>0&&<p>Aktuelle Schlüsselwörter: {r.keywords.join(' · ')}</p>}
 <details><summary>Aktuelle Fähigkeiten</summary><p className="forge-oracle">{forgeRuleText(card)||'Keine Fähigkeiten.'}</p></details>
 <small>Aktueller Spielzustand. Das Kartenbild zeigt weiterhin den gedruckten Text.</small></section>;
}
