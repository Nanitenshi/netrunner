export function reconcileHand(order:string[],ids:string[]){const present=new Set(ids);return [...new Set([...order.filter(id=>present.has(id)),...ids])];}
export function moveHandCard(order:string[],id:string,target:string,after=false){
 if(id===target||!order.includes(id)||!order.includes(target))return order;
 const next=order.filter(item=>item!==id);next.splice(next.indexOf(target)+(after?1:0),0,id);return next;
}
