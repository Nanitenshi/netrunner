import {verifyForgeRuntime} from '../server/forge-runtime.ts';
import {forgeRuntimeLock as lock} from '../shared/forge-runtime-lock.ts';
const runtime=process.env.FORGE_RUNTIME;
if(!runtime)throw Error('Set FORGE_RUNTIME to the installed runtime directory.');
verifyForgeRuntime(runtime);
console.log(`PASS tested Forge ${lock.forgeVersion}: engine and card-script hashes match.`);
