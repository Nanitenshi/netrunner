import { access, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { normalizeScryfallCard } from '../shared/cards.ts';
const names = ['Atraxa, Praetors\' Voice', 'The Ur-Dragon', 'Muldrotha, the Gravetide', 'Edgar Markov', 'Sol Ring', 'Arcane Signet', 'Command Tower', 'Breeding Pool', 'Forest', 'Island', 'Birds of Paradise', 'Eternal Witness', 'Swords to Plowshares', 'Counterspell', 'Cultivate', 'Rhystic Study', 'Lightning Greaves', 'Skullclamp', 'Vampire Nighthawk', 'Llanowar Elves'];
const root = new URL('../', import.meta.url);
const headers = { 'User-Agent': 'NexusCommander/0.1 (local development)', Accept: 'application/json' };
let previous = [];
try { previous = JSON.parse(await readFile(new URL('src/cards.json', root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
// Preserve selected printings and images while refreshing Oracle metadata.
const identifiers = names.map(name => { const cached = previous.find(c => c.name === name); return cached ? { id: cached.id } : { name }; });
const response = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers }) });
if (!response.ok) throw new Error(`Scryfall ${response.status}`);
const result = await response.json();
if (result.not_found?.length || result.data?.length !== names.length) throw new Error('Unvollständige Kartensammlung. Der vorhandene Cache bleibt erhalten.');
await mkdir(new URL('public/cards/', root), { recursive: true });
const cards = result.data.map(normalizeScryfallCard);
let downloaded = 0;
for (const card of result.data) {
  const file = new URL(`public/cards/${card.id}.jpg`, root);
  try { await access(file); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const uri = (card.image_uris ?? card.card_faces?.[0]?.image_uris).large;
  const image = await fetch(uri, { headers: { 'User-Agent': headers['User-Agent'], Accept: 'image/*' } });
  if (!image.ok) throw new Error(`Image ${image.status}`);
  await writeFile(file, Buffer.from(await image.arrayBuffer()));
  downloaded++;
  await new Promise(resolve => setTimeout(resolve, 120));
}
const temporary = new URL('src/cards.json.tmp', root);
await writeFile(temporary, JSON.stringify(cards, null, 2) + '\n');
await rename(temporary, new URL('src/cards.json', root));
console.log(`Updated ${cards.length} card definitions; downloaded ${downloaded} images.`);
