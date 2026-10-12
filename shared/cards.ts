export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';
export interface CardFace {
  image?:string; art?:string|null;
  name: string; mana: string; type: string; text: string; colors: ManaColor[];
  power: string | null; toughness: string | null; loyalty?:string|null;
}
export interface CardDefinition extends CardFace {
  layout?:string; displayFace?:number;
  preview?:boolean; releasedAt?:string;
  oracleId?: string; commanderEligible?: boolean; commanderLegal?: boolean; keywords?: string[];
  id: string; image: string; art: string | null; artist: string; source: string;
  colorIdentity: ManaColor[]; manaValue: number; faces: CardFace[];
}
interface ScryfallFace {
  name: string; mana_cost?: string; type_line?: string; oracle_text?: string;
  loyalty?:string; colors?: string[]; power?: string; toughness?: string; artist?: string;
  image_uris?: { large: string; art_crop?: string };
}
export interface ScryfallCard extends ScryfallFace {
  layout?:string;
  id: string; cmc: number; color_identity: string[]; scryfall_uri: string;
  card_faces?: ScryfallFace[];
}
const colorOrder: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
function normalizeColors(value: string[]): ManaColor[] {
  if (!Array.isArray(value) || value.some(c => !colorOrder.includes(c as ManaColor))) throw new Error('Ungültige Farbdaten');
  return colorOrder.filter(c => value.includes(c));
}
function faceData(face: ScryfallFace): CardFace {
  return {
    ...(face.image_uris?{image:face.image_uris.large,art:face.image_uris.art_crop??null}:{}),
    name: face.name, mana: face.mana_cost ?? '', type: face.type_line ?? '', text: face.oracle_text ?? '',
    colors: normalizeColors(face.colors ?? []),
    // Oracle characteristics can contain *, 1+*, etc. Never coerce them into numbers.
    power: face.power ?? null, toughness: face.toughness ?? null, loyalty:face.loyalty??null,
  };
}
/** Normalize authoritative Oracle fields. Mana cost, card color and color identity are distinct. */
export function normalizeScryfallCard(card: ScryfallCard): CardDefinition {
  if (!card.id || !card.name || !Number.isFinite(card.cmc) || card.cmc < 0) throw new Error('Ungültige Kartendaten oder fehlender Manawert');
  const front = card.card_faces?.[0];
  const images = card.image_uris ?? front?.image_uris;
  if (!images?.large) throw new Error(`Kein Kartenbild: ${card.name}`);
  const face = faceData({ ...front, ...card,
    mana_cost: card.mana_cost ?? front?.mana_cost, colors: card.colors ?? front?.colors,
    oracle_text: card.oracle_text ?? front?.oracle_text,
    loyalty:card.loyalty??front?.loyalty, power: card.power ?? front?.power, toughness: card.toughness ?? front?.toughness,
  });
  return {
    ...face, layout:card.layout, id: card.id, image: `/cards/${card.id}.jpg`, art: images.art_crop ?? null,
    artist: card.artist ?? front?.artist ?? '', source: card.scryfall_uri,
    colorIdentity: normalizeColors(card.color_identity), manaValue: card.cmc,
    faces: (card.card_faces ?? []).map(faceData),
  };
}
