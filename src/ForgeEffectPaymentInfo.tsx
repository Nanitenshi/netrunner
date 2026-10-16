import type {ForgeChoice} from '../shared/forge-protocol';
export default function ForgeEffectPaymentInfo({choice}:{choice:ForgeChoice}){
 const effect=choice.effectPayment;if(!effect)return null;
 const description=effect.description.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/?[a-z][^>]*>/gi,'');
 return <div className="forge-effect-payment-info" aria-label="Effektzahlung"><p><b>Effektkosten: {effect.cost||'{0}'}</b></p>{description&&<p>{description}</p>}
 <p>Du entscheidest über diese Zahlung. Ohne Zahlung wird der Effekt entsprechend fortgesetzt. Bereits bezahlte Spruch- und Fähigkeitskosten bleiben bezahlt.</p>
 {!effect.canPay&&<p role="status">Diese Kosten sind aktuell nicht bezahlbar.</p>}{effect.alreadyPaid&&<p>Ein anderer Spieler hat bereits bezahlt. Eine weitere Zahlung ändert die verhinderte Wirkung nicht.</p>}</div>;
}
