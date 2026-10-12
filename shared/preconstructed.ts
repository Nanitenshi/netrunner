import lists from './preconstructed.json' with {type:'json'};
import {deckSchema} from './protocol.ts';
export const preparedDecks=deckSchema.array().parse(lists);
export const preparedDeckSource='https://magic.wizards.com/en/news/announcements/starter-commander-decks-decklists-2022-10-20';
