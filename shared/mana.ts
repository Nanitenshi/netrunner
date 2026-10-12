export const manaColors=['W','U','B','R','G','C'] as const;
export type ManaColor=typeof manaColors[number];
export type ManaPool=Partial<Record<ManaColor,number>>;
export const manaNames:Record<ManaColor,string>={W:'Weiß',U:'Blau',B:'Schwarz',R:'Rot',G:'Grün',C:'Farblos'};
export const manaTotal=(pool?:ManaPool)=>manaColors.reduce((total,color)=>total+(pool?.[color]??0),0);
