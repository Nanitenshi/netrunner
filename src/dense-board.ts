import type {CardInstance} from '../shared/game';
import {groupBattlefield,type BattlefieldGroup} from './opponent-layout.ts';
export interface DenseSlot {card:CardInstance;position:{x:number;y:number};group:BattlefieldGroup;collapsed:boolean}
// A finite table layout: every presented card gets its own cell, with no scroll area.
export function denseBoard(cards:CardInstance[],width:number,height:number,expanded:ReadonlySet<string>=new Set(),pinned:ReadonlySet<string>=new Set()){
 const groups=groupBattlefield(cards,true,pinned),sections=['creatures','permanents','lands'] as const;
 const lanes=sections.map(section=>({section,groups:groups.filter(g=>g.section===section).sort((a,b)=>Number(a.cards[0].tapped)-Number(b.cards[0].tapped)),count:groups.filter(g=>g.section===section).reduce((n,g)=>n+g.cards.length,0)})).filter(l=>l.groups.length);
 const entries=(g:BattlefieldGroup)=>expanded.has(g.key)?g.cards:[g.cards[0]];
 const padding=12,gap=12,heading=20,usableWidth=Math.max(100,width-padding*2),usableHeight=Math.max(100,height-padding*2);
 const horizontalFactor=cards.some(c=>c.tapped)?1.395:1;
 let best={columns:4,cardWidth:1};
 for(let columns=2;columns<=12;columns++){
  const rows=lanes.reduce((n,l)=>n+Math.ceil(l.groups.reduce((sum,g)=>sum+entries(g).length,0)/columns),0);
  const cardWidth=Math.min(110,(usableWidth-gap*(columns-1))/columns/horizontalFactor,(usableHeight-heading*lanes.length-gap*Math.max(0,rows-1))/Math.max(1,rows)/1.395);
  if(cardWidth>best.cardWidth)best={columns,cardWidth};
 }
 const slots:DenseSlot[]=[],headers:{section:BattlefieldGroup['section'];count:number;untapped:number;y:number}[]=[];
 let y=padding;
 for(const lane of lanes){headers.push({section:lane.section,count:lane.count,untapped:lane.groups.reduce((n,g)=>n+g.cards.filter(c=>!c.tapped).length,0),y:y/height});y+=heading;let index=0;
  for(const group of lane.groups)for(const card of entries(group)){
   const col=index%best.columns,row=Math.floor(index/best.columns),cellWidth=usableWidth/best.columns;
   slots.push({card,position:pinned.has(card.id)?card.position:{x:(padding+cellWidth*(col+.5))/width,y:(y+row*(best.cardWidth*1.395+gap)+best.cardWidth*1.395/2)/height},group,collapsed:entries(group).length===1&&group.cards.length>1});index++;
  }
  y+=Math.ceil(index/best.columns)*(best.cardWidth*1.395+gap);
 }
 return{slots,headers,cardWidth:Math.max(12,best.cardWidth),groups};
}
