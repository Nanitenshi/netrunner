import type {CSSProperties} from 'react';
import './tavern.css';

/** Decorative room layers never intercept tabletop input. */
export default function TavernEnvironment({animated,table=false}:{animated:boolean;table?:boolean}){
 return <div className={`tavern-environment ${animated?'tavern-animated':''} ${table?'tavern-table':''}`} aria-hidden="true">
  <div className="tavern-room"/><div className="tavern-shade"/>
  <div className="tavern-portal"><i/><i/><i/><b/></div>
  <div className="tavern-lantern lantern-left"/><div className="tavern-lantern lantern-right"/>
  <div className="tavern-projection"/><div className="tavern-mist"/>
  <div className="tavern-sparks">{Array.from({length:24},(_,i)=><i key={i} style={{'--x':`${(i*37+3)%100}%`,'--delay':`${-i*1.17}s`,'--duration':`${9+i%6}s`,'--drift':`${i%2?40:-40}px`} as CSSProperties}/>)}</div>
  <div className="tavern-floor-rune"><i/><i/></div>
 </div>;
}
