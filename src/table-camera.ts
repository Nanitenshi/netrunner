// Fit the projected top surface, including the perspective expansion at its front edge.
export function fitTableCamera(width:number,height:number,viewportWidth:number,viewportHeight:number,tilt:number,perspective=2800){
 const angle=tilt*Math.PI/180,half=height/2,near=perspective/(perspective-half*Math.sin(angle)),far=perspective/(perspective+half*Math.sin(angle));
 const top=-half*Math.cos(angle)*far,bottom=half*Math.cos(angle)*near;
 const scale=Math.max(.05,Math.min(viewportWidth/(width*Math.max(near,far)),viewportHeight/(bottom-top)));
 return {scale,offsetY:-(top+bottom)*scale/2,perspective};
}
