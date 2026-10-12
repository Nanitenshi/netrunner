import type {Settings} from './settings';
export default function PhaseSettings({settings,onChange}:{settings:Settings;onChange:(settings:Settings)=>void}){
 return <section className="phase-settings"><h3>Hand</h3><label className="setting">Handkartengröße · {Math.round((settings.handScale??1)*100)} %<input aria-label="Handkartengröße" type="range" min=".8" max="1.5" step=".05" value={settings.handScale??1} onChange={e=>onChange({...settings,handScale:Number(e.target.value)})}/></label></section>;
}
