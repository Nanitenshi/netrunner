export type Point = { x: number; y: number };
// Solve a projective mapping: CSS perspective remains correct while dragging.
export function boardPoint(corners: Point[], point: Point): Point {
  const targets = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
  const rows: number[][] = [];
  corners.forEach(({x,y}, i) => {
    const p = targets[i];
    rows.push([x,y,1,0,0,0,-p.x*x,-p.x*y,p.x]);
    rows.push([0,0,0,x,y,1,-p.y*x,-p.y*y,p.y]);
  });
  for(let c=0;c<8;c++) {
    let pivot=c; for(let r=c+1;r<8;r++) if(Math.abs(rows[r][c])>Math.abs(rows[pivot][c])) pivot=r;
    [rows[c],rows[pivot]]=[rows[pivot],rows[c]];
    if(Math.abs(rows[c][c])<1e-9) throw new Error('Kamera zu flach');
    const divisor=rows[c][c]; for(let j=c;j<9;j++) rows[c][j]/=divisor;
    for(let r=0;r<8;r++) if(r!==c) {const factor=rows[r][c]; for(let j=c;j<9;j++) rows[r][j]-=factor*rows[c][j];}
  }
  const h=rows.map(r=>r[8]); const d=h[6]*point.x+h[7]*point.y+1;
  return {x:(h[0]*point.x+h[1]*point.y+h[2])/d,y:(h[3]*point.x+h[4]*point.y+h[5])/d};
}
