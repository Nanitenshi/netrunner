import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './card-characteristics.css';
import './redesign.css';
import './multiplayer.css';
import './counters.css';
import './opponents.css';
import Root from './Root';
import ErrorBoundary from './ErrorBoundary';
import {ArtworkProvider} from './artworks';
import './holo.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><ArtworkProvider><Root /></ArtworkProvider></ErrorBoundary></React.StrictMode>);

import './styles.css';

import './tavern.css';

import './game-polish.css';

import './playtest-ui.css';

import './workshop-tavern.css';

import './entry-tavern.css';

import './match-ui.css';

import './deck-groups.css';

import './intuitive-play.css';
import './game-dock.css';

import './clean-table.css';

import './table-tracking.css';

import './physical-counters.css';

import './effect-links.css';

import './dense-board.css';
