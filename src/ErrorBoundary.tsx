import {Component,type ReactNode} from 'react';
export default class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="recovery-screen" role="alert"><span>BATUSMTG</span><h1>Die Ansicht konnte nicht geladen werden.</h1><p>Deine gespeicherten Decks bleiben erhalten. Lade das Hauptmenü neu, um weiterzuspielen.</p><button onClick={()=>{location.hash='home';location.reload();}}>Zurück zum Hauptmenü</button></main>:this.props.children;}
}
