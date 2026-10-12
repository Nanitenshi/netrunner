import type {CardInstance} from './game.ts';
export interface CustomCounter {name:string;value:number}
export const normalizeCounterName=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ');
export function changeCustomCounter(counters:CustomCounter[]|undefined,name:string,amount:number):CustomCounter[]{
 if(typeof name!=='string'||/[\p{C}]/u.test(name))throw new Error('Ungültiger Counter-Name');
 const clean=normalizeCounterName(name);
 if(!clean||clean.length>28||!Number.isInteger(amount)||Math.abs(amount)>999)throw new Error('Counter: Name mit 1–28 Zeichen und ganze Zahl bis 999 verwenden');
 const list=(counters??[]).map(c=>({...c})),existing=list.find(c=>c.name.toLowerCase()===clean.toLowerCase());
 if(existing)existing.value=Math.max(0,Math.min(999,existing.value+amount));
 else if(amount>0){if(list.length>=16)throw new Error('Maximal 16 eigene Counter-Arten pro Ziel');list.push({name:clean,value:Math.min(999,amount)});}
 return list.filter(c=>c.value>0);
}
export const customCounterKey=(counters:CustomCounter[]|undefined)=>[...(counters??[])].filter(c=>c.value>0).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>[c.name,c.value]);
export const cardCounterTypes=['plusOne','minusOne','loyalty','charge','shield','stun','lore','oil','time','quest'] as const;
export const playerCounterTypes=['poison','energy','experience','rad'] as const;
export type CardCounterType=typeof cardCounterTypes[number];
export type PlayerCounterType=typeof playerCounterTypes[number];
export const cardCounters:Record<CardCounterType,{name:string;short:string;color:string}>={
 plusOne:{name:'+1/+1',short:'+1',color:'#75dbb3'},minusOne:{name:'−1/−1',short:'−1',color:'#ed8b94'},
 loyalty:{name:'Loyalität',short:'LOY',color:'#b8a1f4'},charge:{name:'Ladung',short:'CHG',color:'#6bd7ec'},
 shield:{name:'Schild',short:'SHD',color:'#eed9a3'},stun:{name:'Betäubung',short:'STN',color:'#83b3f4'},
 lore:{name:'Sage / Lore',short:'LOR',color:'#d7bd9d'},oil:{name:'Öl',short:'OIL',color:'#adadca'},
 time:{name:'Zeit',short:'TIME',color:'#8ee0d5'},quest:{name:'Quest',short:'QST',color:'#c5d690'}
};
export const playerCounters:Record<PlayerCounterType,{name:string;short:string;color:string}>={
 poison:{name:'Gift',short:'GIFT',color:'#b2dc79'},energy:{name:'Energie',short:'ENERGIE',color:'#e8cb80'},
 experience:{name:'Erfahrung',short:'ERF',color:'#bb9de7'},rad:{name:'Strahlung',short:'RAD',color:'#92dabe'}
};
export const markerCount=(card:CardInstance,type:CardCounterType)=>card.markers?.[type]??(type==='plusOne'?card.counters:0);
export function markedStats(card:CardInstance,power:string|null,toughness:string|null){
 const delta=markerCount(card,'plusOne')-markerCount(card,'minusOne');
 const adjust=(value:string|null,bonus=0)=>value!==null&&/^-?\d+$/.test(value)?String(Number(value)+delta+bonus):value;
 return {power:adjust(card.powerOverride??power,card.temporaryPower),toughness:adjust(card.toughnessOverride??toughness,card.temporaryToughness),modified:delta!==0||!!card.temporaryPower||!!card.temporaryToughness||card.powerOverride!==undefined||card.toughnessOverride!==undefined};
}
