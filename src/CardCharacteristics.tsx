import type { CardDefinition, ManaColor } from '../shared/cards';
const colorNames: Record<ManaColor, string> = { W: 'Weiß', U: 'Blau', B: 'Schwarz', R: 'Rot', G: 'Grün' };

export function CardCharacteristics({ card }: { card: CardDefinition }) {
  const hasStats = card.power !== null || card.toughness !== null;
  return <div className="card-characteristics" aria-label="Kartenwerte">
    {card.preview&&<p className="preview-card-note">Preview · im Casual-Spiel verfügbar{card.releasedAt?` · Veröffentlichung: ${new Date(card.releasedAt+'T12:00:00').toLocaleDateString('de-DE')}`:''}</p>}
    <div className="identity-row"><span>Farbidentität{card.faces.length>1?' · beide Seiten':''}</span>
      {card.colorIdentity.length > 0
        ? <span className="identity-symbols" aria-label={card.colorIdentity.map(c => colorNames[c]).join(', ')}>
          {card.colorIdentity.map(color => <span className={`color-symbol color-${color}`} key={color} title={colorNames[color]} aria-label={colorNames[color]}>{color}</span>)}
        </span>
        : <span className="colorless-identity"><span aria-hidden="true">◇</span> Farblos</span>}
    </div>
    <div className="characteristic-numbers">
      <div><span>Manawert</span><strong data-testid="mana-value">{new Intl.NumberFormat('de-DE').format(card.manaValue)}</strong></div>
      <div><span>Stärke</span><strong data-testid="power">{card.power ?? '—'}</strong></div>
      <div><span>Widerstandskraft</span><strong data-testid="toughness">{card.toughness ?? '—'}</strong></div>
    </div>
    {card.faces.length>1&&<div className="face-characteristics">{card.faces.map((face,i)=><section key={face.name}><b>{i===0?'Vorderseite':'Rückseite'} · {face.name}</b><p>{face.mana||'Keine Manakosten'} · Farbe: {face.colors.join(' / ')||'Farblos'}</p><small>{face.text}</small></section>)}</div>}
    <p className="characteristic-note">{hasStats ? 'Grundwerte · ohne Spieleffekte' : 'Keine Stärke / Widerstandskraft'}</p>
  </div>;
}
