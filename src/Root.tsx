import ForgeArena from './ForgeArena';
import BotTraining from './BotTraining';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,ChevronRight,Diamond,Layers,Settings2,Shield,Swords,UserRound,Volume2} from 'lucide-react';
import App from './App';
import {useArtwork} from './artworks';
import HomeGate from './HomeGate';
import Lobby from './Lobby';
import {useNetwork} from './network';
import DeckWorkshop from './DeckWorkshop';
import SettingsPanel from './SettingsPanel';
import {readSettings,discordURL} from './settings';
type Screen='home'|'lobby'|'arena'|'decks'|'account'|'settings'|'forge';
const getScreen=():Screen=>['lobby','arena','decks','account','settings','forge'].includes(location.hash.slice(1))?location.hash.slice(1) as Screen:'home';
const safeProfile=()=>{try{return localStorage.getItem('nexus.profileName')||'Planeswalker';}catch{return 'Planeswalker';}};

export default function Root(){
  useArtwork();
  const net=useNetwork();
  const wasPlaying=useRef(false);
  const [screen,setScreen]=useState<Screen>(getScreen);
  const [settings,setSettings]=useState(readSettings);
  const [profile,setProfile]=useState(safeProfile);
  const [draft,setDraft]=useState(profile);
  const [profileStatus,setProfileStatus]=useState('');
  const [visited,setVisited]=useState(screen==='arena');
  const navigate=(next:Screen)=>{location.hash=next;if(next==='arena')setVisited(true);setScreen(next);};
  useEffect(()=>{const changed=()=>{const next=getScreen();setScreen(next);if(next==='arena')setVisited(true);};window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
  useEffect(()=>{try{localStorage.setItem('nexus.preferences',JSON.stringify(settings));}catch{/* Settings remain active for this session. */}},[settings]);
  const css={'--accent':settings.accent,'--card-scale':settings.cardScale,'--ui-scale':settings.uiScale} as CSSProperties;
  useEffect(()=>{if(net.room?.started){setVisited(true);setScreen('arena');location.hash='arena';wasPlaying.current=true;}else if(wasPlaying.current){wasPlaying.current=false;setScreen(net.room?'lobby':'home');location.hash=net.room?'lobby':'home';}},[net.room?.code,net.room?.started]);
  const displayName=net.user?.name||profile;
  
  return <>
    <div hidden={screen==='arena'||screen==='forge'} className={`entry-shell ${screen==='home'?'gate-shell':''} ${settings.effects?'entry-effects':''}`} style={css}>
      <div className="entry-grid"/><div className="entry-light light-left"/><div className="entry-light light-right"/>
      <header className="entry-header"><button className="brand" onClick={()=>navigate('home')} aria-label="Hauptmenü"><span className="brand-mark"><Diamond size={29}/><span/></span><b>BATUSMTG</b><span className="brand-sub">COMMANDER</span></button><div className="entry-version"><span/> {net.connected?'SERVER VERBUNDEN':'BATUSMTG ONLINE'} <b>03</b></div><button className="profile-button" onClick={()=>navigate('account')}><span>{displayName.slice(0,1).toUpperCase()}</span><div>{displayName}<small>{net.user?.provider==='discord'?'Discord-Konto':net.user?'Testkonto':'Lokales Profil'}</small></div><ChevronRight size={16}/></button></header>
      <nav className="entry-nav" aria-label="Hauptnavigation">{([['home','Übersicht',Diamond],['lobby','Spielen',Swords],['decks','Deckersteller',Layers],['account','Konto',UserRound],['settings','Einstellungen',Settings2]] as const).map(([id,label,Icon],index)=><button key={id} className={screen===id?'active':''} onClick={()=>navigate(id)}><span className="nav-index">0{index+1}</span><Icon size={18}/><span>{label}</span><ArrowUpRight size={14}/></button>)}<div className="nav-bottom"><span className="micro-label">COMMANDER / 2–4 SPIELER</span></div></nav>
      <main className={`entry-content screen-${screen}`}>
        {screen==='home'&&<HomeGate settings={settings} setSettings={setSettings} name={displayName} playing={Boolean(net.room?.started)} serverReady={net.available} roomCode={net.room?.code} playerCount={net.room?.players.length} onNavigate={navigate} onDiscord={()=>{const link=discordURL(settings.discord);if(link)window.open(link,'_blank','noopener,noreferrer');else navigate('settings');}}/>}
        {screen==='lobby'&&<><Lobby net={net} onPlay={()=>navigate('arena')} onAccount={()=>navigate('account')}/>{net.forgeReady&&<button className="nexus-button" onClick={()=>navigate('forge')}>Automatik-Testtisch · Forge</button>}</>}
        {screen==='decks'&&<DeckWorkshop user={net.user}/>}
        {screen==='settings'&&<div className="entry-settings"><div className="section-intro"><h1>Einstellungen</h1><div className="style-orbit"><Diamond size={100}/><Diamond size={55}/></div></div><SettingsPanel settings={settings} onChange={setSettings}/></div>}
        {screen==='account'&&<div className="account-screen"><div className="section-intro"><h1>Konto</h1><div className="profile-emblem"><UserRound size={68}/></div></div><div className="profile-form"><h2>{displayName}</h2>{net.error&&<p className="network-error" role="alert">{net.error}</p>}{net.user?<div className="auth-box"><p>{net.user.provider==='discord'?'Mit Discord angemeldet':'Testkonto auf diesem Spielserver'}</p><button className="nexus-button" onClick={()=>void net.logout()}>Abmelden</button></div>:<div className="auth-box"><a className={`nexus-button ${net.discordReady?'':'disabled'}`} href={net.discordReady?'/auth/discord':undefined} aria-disabled={!net.discordReady}>Mit Discord anmelden ↗</a><p>{net.discordReady?'Discord bestätigt deine Identität. Dein Passwort bleibt bei Discord.':'Discord-Anmeldung ist auf diesem Server noch nicht verfügbar.'}</p><button onClick={()=>navigate('lobby')}>Zum Multiplayer →</button></div>}<form onSubmit={e=>{e.preventDefault();const name=draft.trim();if(!name){setProfileStatus('Bitte gib einen Namen ein.');return;}try{localStorage.setItem('nexus.profileName',name);setProfile(name);setProfileStatus('Profil auf diesem Gerät gespeichert.');}catch{setProfileStatus('Speichern ist in diesem Browser nicht möglich.');}}}><label>Anzeigename<input aria-label="Anzeigename" maxLength={30} value={draft} onChange={e=>setDraft(e.target.value)}/></label><button className="nexus-button" type="submit">Profil speichern <ArrowRight size={17}/></button></form><p role="status" className="profile-status">{profileStatus}</p><div className="discord-connect"><Volume2 size={25}/><div><h3>Discord-Sprachkanal</h3><p>Hinterlege einen Sprachkanal in den Einstellungen und öffne ihn direkt aus deiner Arena.</p><button onClick={()=>{const link=discordURL(settings.discord);if(link)window.open(link,'_blank','noopener,noreferrer');else navigate('settings');}}>{discordURL(settings.discord)?'Sprachkanal öffnen':'Sprachkanal einrichten'} <ArrowUpRight size={15}/></button></div></div><div className="account-status"><Shield size={16}/><p>Deine Decks lassen sich im Deckersteller mit dem angemeldeten Konto auf diesem Server speichern. Der Anzeigename unten wird nur auf diesem Gerät verwendet.</p></div></div></div>}
      </main>
      <footer className="entry-footer"><span><span/> BATUSMTG · COMMANDER</span><span>{net.connected?'SPIELSERVER VERBUNDEN · 2–4 SPIELER':net.publicServer?'ONLINE · MIT DISCORD ANMELDEN':'LOKALER SPIELTISCH'}</span><button onClick={()=>navigate('arena')}><BookOpen size={13}/> Testtisch öffnen <ArrowRight size={13}/></button></footer>
    </div>
    <div hidden={screen!=='arena'}>{visited&&<App active={screen==='arena'} settings={settings} setSettings={setSettings} onExit={()=>navigate('home')} online={net.room?.game?{view:net.room.game,seat:net.room.seat,connected:net.connected,code:net.room.code,dispatch:net.action,error:net.error,revision:net.room.revision,combat:Boolean(net.room.combat),autoPass:(revision,policy)=>net.send('game:autoPass',{revision,policy}),isHost:net.room.hostId===net.room.seat,leave:()=>net.send('room:leave',{}),finish:()=>net.send('room:finish',{})}:undefined}/>} {screen==='arena'&&net.room?.game&&<BotTraining net={net}/>}</div>
    {screen==='forge'&&<ForgeArena net={net} onExit={()=>navigate('lobby')}/>}
  </>;
}
