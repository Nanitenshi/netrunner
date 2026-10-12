import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitTableCamera} from '../src/table-camera.ts';
test('camera fits all projected corners into wide and narrow viewports at supported tilts',()=>{
 for(const [width,height] of [[2180,1550],[1112,916],[1032,680]])for(const [vw,vh] of [[1392,690],[552,450],[1872,820]])for(const tilt of [0,14,26,28]){
  const {scale,offsetY,perspective}=fitTableCamera(width,height,vw,vh,tilt),a=tilt*Math.PI/180;
  for(const x of [-width/2,width/2])for(const y of [-height/2,height/2]){const k=perspective/(perspective-y*Math.sin(a));assert.ok(Math.abs(x*k*scale)<=vw/2+.001);assert.ok(Math.abs(y*Math.cos(a)*k*scale+offsetY)<=vh/2+.001);}
 }
});
