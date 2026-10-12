import {useState} from 'react';
import {effectFilters,keywordLabels,type SearchFilters} from '../shared/card-search';
export default function CardSearchFilters({filters,onChange,keywords}:{filters:SearchFilters;onChange:(next:SearchFilters)=>void;keywords:string[]}){
 const [keywordQuery,setKeywordQuery]=useState('');
 const active=filters.effects.length+filters.keywords.length+Number(Boolean(filters.text))+Number(Boolean(filters.type))+Number(filters.maxMana!=='');
 const toggle=(field:'effects'|'keywords',value:string)=>onChange({...filters,[field]:filters[field].includes(value)?filters[field].filter(v=>v!==value):[...filters[field],value]});
 return <details className="card-search-filters"><summary>Effekte & Keywords {active>0&&<b>{active}</b>}</summary><div className="search-filter-content">
  <p>Filter werden kombiniert. Effekte sind Vorschläge aus dem Kartentext; beide Kartenseiten werden berücksichtigt.</p>
  <label className="preview-search-toggle"><input type="checkbox" checked={filters.includePreviews!==false} onChange={e=>onChange({...filters,includePreviews:e.target.checked})}/> Vorveröffentlichte Karten anzeigen</label>
  <div className="effect-chips" aria-label="Effekte filtern">{effectFilters.map(e=><button key={e.id} aria-pressed={filters.effects.includes(e.id)} onClick={()=>toggle('effects',e.id)}>{e.label}</button>)}</div>
  <div className="search-filter-fields"><label>Kartentext<input aria-label="Kartentext filtern" placeholder="z. B. whenever oder sacrifice" value={filters.text} onChange={e=>onChange({...filters,text:e.target.value})}/></label><label>Kartentyp<select aria-label="Kartentyp filtern" value={filters.type} onChange={e=>onChange({...filters,type:e.target.value})}><option value="">Alle Typen</option>{[['Creature','Kreatur'],['Land','Land'],['Artifact','Artefakt'],['Enchantment','Verzauberung'],['Instant','Spontanzauber'],['Sorcery','Hexerei'],['Planeswalker','Planeswalker'],['Battle','Schlacht']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>Max. Manawert<input aria-label="Maximaler Manawert" type="number" min="0" max="100" value={filters.maxMana} onChange={e=>onChange({...filters,maxMana:e.target.value})}/></label></div>
  <label className="keyword-search">Keywords finden<input aria-label="Keywords suchen" placeholder="Deutsch oder Englisch …" value={keywordQuery} onChange={e=>setKeywordQuery(e.target.value)}/></label>
  <div className="keyword-chips">{keywords.filter(k=>`${k} ${keywordLabels[k]??''}`.toLocaleLowerCase().includes(keywordQuery.toLocaleLowerCase())||filters.keywords.includes(k)).map(k=><button key={k} aria-pressed={filters.keywords.includes(k)} onClick={()=>toggle('keywords',k)} title={k}>{keywordLabels[k]??k}</button>)}</div>
  <button className="clear-search-filters" onClick={()=>{onChange({...filters,effects:[],keywords:[],text:'',type:'',maxMana:''});setKeywordQuery('');}}>Zusatzfilter zurücksetzen</button>
 </div></details>;
}
