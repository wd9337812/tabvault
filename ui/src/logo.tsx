import React from 'react';
export function Logo({vault=false,size=36,...props}:{vault?:boolean,size?:number,[key:string]:any}){
 return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
  <rect x="3" y="3" width="58" height="58" rx="17" fill={vault?'#11836e':'#6154df'}/>
  {vault?<><path d="M17 25v-4a5 5 0 0 1 5-5h12l5 5h5a5 5 0 0 1 5 5v17a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5V25Z" fill="white" fillOpacity=".19"/><path d="M16 27a4 4 0 0 1 4-4h8l4 5h13a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V27Z" fill="white"/><path d="m26 36 7 8 8-8" stroke="#11836e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M33 33v10" stroke="#11836e" strokeWidth="4" strokeLinecap="round"/></>:<><path d="M18 18a5 5 0 0 1 5-5h12l7 7h3a5 5 0 0 1 5 5v20a5 5 0 0 1-5 5H23a5 5 0 0 1-5-5V18Z" fill="white" fillOpacity=".18"/><path d="M14 25a4 4 0 0 1 4-4h10l5 5h10a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V25Z" fill="white"/><path d="m23 37 6 6 10-11" stroke="#6154df" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/></>}
 </svg>;
}
