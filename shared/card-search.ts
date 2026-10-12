import type {CardDefinition} from './cards.ts';
export const keywordLabels:Record<string,string>={Flying:'Flugfähigkeit',Deathtouch:'Todesberührung',Lifelink:'Lebensverknüpfung',Trample:'Trampelschaden',Haste:'Eile',Vigilance:'Wachsamkeit',Reach:'Reichweite',Hexproof:'Fluchsicher',Shroud:'Verhüllt',Indestructible:'Unzerstörbar','First strike':'Erstschlag','Double strike':'Doppelschlag',Flash:'Aufblitzen',Ward:'Abwehr',Defender:'Verteidiger',Menace:'Bedrohlich',Cascade:'Kaskade',Discover:'Entdeckung',Scry:'Hellsicht',Surveil:'Überwachen'};
const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/ß/g,'ss');
export const rulesText=(c:CardDefinition)=>[c.text,...c.faces.map(f=>f.text)].join('\n');
export const effectFilters=[
 {id:'draw',label:'Kartenziehen',match:/\bdraw\b[^.\n]*\bcards?\b/i},
 {id:'mana',label:'Mana erzeugen',match:/\badds?\b[^.\n]*\{[WUBRGC]\}|\badds?\b[^.\n]*\bmana\b/i},
 {id:'ramp',label:'Länder suchen / Ramp',match:/search[^.\n]*library[^.\n]*land|put[^.\n]*land[^.\n]*onto the battlefield/i},
 {id:'removal',label:'Entfernen / Removal',match:/destroy (?:target|all|each)|exile (?:target|all|each)|return target[^.\n]*owner.s hand/i},
 {id:'counter',label:'Neutralisieren',match:/counter (?:target|all|each)[^.\n]*(?:spell|ability)/i},
 {id:'tokens',label:'Spielsteine erzeugen',match:/\bcreate\b[^.\n]*\btokens?\b/i},
 {id:'graveyard',label:'Aus dem Friedhof zurückholen',match:/return[^.\n]*graveyard|cast[^.\n]*from[^.\n]*graveyard/i},
 {id:'tutor',label:'Bibliothek durchsuchen',match:/search[^.\n]*library/i},
 {id:'lifegain',label:'Leben erhalten',match:/\bgains?\b[^.\n]*\blife\b/i},
 {id:'damage',label:'Schaden verursachen',match:/\bdeals?\b[^.\n]*\bdamage\b/i},
] as const;
export interface SearchFilters{query:string;color:string;effects:string[];keywords:string[];text:string;type:string;maxMana:string;includePreviews?:boolean;}
export function matchesCard(c:CardDefinition,f:SearchFilters):boolean{
 if(f.includePreviews===false&&c.preview)return false;
 const text=rulesText(c),keywords=c.keywords??[];
 const haystack=normalize([c.name,c.type,...c.faces.map(face=>`${face.name} ${face.type}`),text,...keywords,...keywords.map(k=>keywordLabels[k]??'')].join(' '));
 const q=normalize(f.query.trim());
 // Ordinary names remain phrase searches; German keyword names also match the authoritative keyword field.
 if(q&&!haystack.includes(q))return false;
 if(f.color&&(f.color==='C'?c.colorIdentity.length!==0:!c.colorIdentity.includes(f.color as 'W')))return false;
 if(f.type&&![c.type,...c.faces.map(face=>face.type)].some(t=>t.includes(f.type)))return false;
 if(f.maxMana!==''&&c.manaValue>Number(f.maxMana))return false;
 if(f.text&&!normalize(text).includes(normalize(f.text.trim())))return false;
 if(!f.keywords.every(k=>keywords.some(value=>normalize(value)===normalize(k))))return false;
 return f.effects.every(id=>effectFilters.find(e=>e.id===id)?.match.test(text)===true);
}
