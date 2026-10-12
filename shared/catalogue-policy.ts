export interface CatalogueSource {
 legalities?:{commander?:string}; released_at?:string; games?:string[]; layout?:string;
 security_stamp?:string; type_line?:string; oracle_text?:string; card_faces?:{type_line?:string;oracle_text?:string}[];
}
export function isPreviewCard(card:CatalogueSource,today=new Date().toISOString().slice(0,10)){
 return card.legalities?.commander==='not_legal'&&Boolean(card.released_at&&card.released_at>today)&&card.games?.includes('paper')===true&&card.security_stamp!=='acorn'&&!['token','double_faced_token','emblem','art_series','scheme','vanguard','planar'].includes(card.layout??'');
}
export function includeCatalogueCard(card:CatalogueSource,today?:string){return card.legalities?.commander==='legal'||isPreviewCard(card,today);}
export function previewCommander(card:CatalogueSource){
 const front=card.card_faces?.[0]??card;
 return /Legendary/.test(front.type_line??'')&&/Creature/.test(front.type_line??'')||/can be your commander/i.test(front.oracle_text??'');
}
