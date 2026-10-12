import type {CardDefinition} from './cards.ts';
const aliases:Record<string,string>={schatz:'treasure',hinweis:'clue',speise:'food',soldat:'soldier',geist:'spirit',bestie:'beast',elf:'elf',elementarwesen:'elemental',flugfähigkeit:'flying',wachsamkeit:'vigilance',eile:'haste',lebensverknüpfung:'lifelink',bedrohlichkeit:'menace',todesberührung:'deathtouch',trampelschaden:'trample'};
export function searchTokens(tokens:CardDefinition[],query:string,color='any'){
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean).map(w=>aliases[w]??w);
 return tokens.filter(t=>{
  if(color!=='any'&&(color==='C'?t.colors.length!==0:!t.colors.includes(color as 'W')))return false;
  const colors=t.colors.map(c=>({W:'white weiß weiss',U:'blue blau',B:'black schwarz',R:'red rot',G:'green grün gruen'}[c])).join(' ');
  const haystack=`${t.name} ${t.type} ${t.text} ${t.power??''}/${t.toughness??''} ${colors} ${!t.colors.length?'colorless farblos':''}`.toLocaleLowerCase();
  return words.every(w=>/^(?:\d+|\*)\/(?:\d+|\*)$/.test(w)?`${t.power}/${t.toughness}`===w:haystack.includes(w));
 });
}
