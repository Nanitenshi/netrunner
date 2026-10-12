import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {serverURL,allowedNavigation}=createRequire(import.meta.url)('../desktop/url.cjs');
test('Windows server selector accepts HTTPS and local tests but never dangerous schemes or credentials',()=>{
 assert.equal(serverURL('https://game.test/'),'https://game.test');
 assert.equal(serverURL('http://127.0.0.1:17843'),'http://127.0.0.1:17843');
 for(const value of ['javascript:alert(1)','file:///C:/secret','http://remote.test','https://name:secret@game.test','https://game.test/?secret=x','https://game.test/path'])assert.throws(()=>serverURL(value));
 assert.equal(allowedNavigation('https://game.test/#lobby','https://game.test'),true);
 assert.equal(allowedNavigation('https://discord.com/oauth2/authorize?client_id=123','https://game.test'),true);
 assert.equal(allowedNavigation('https://discord.com.evil.test/oauth2/authorize','https://game.test'),false);
 assert.equal(allowedNavigation('file:///C:/secret','https://game.test'),false);
});
