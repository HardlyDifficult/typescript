import{C as u,j as C}from"./Collapsible-BqOtdgWS.js";import"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const E=new Date("2025-01-01T12:00:00.000Z");function m(s){return()=>(s=(s*16807+0)%2147483647,s/2147483647)}function p(s,n,y,t){const f=[];let x=n;for(let b=0;b<s;b++){const a=x,j=(t()-.48)*n*.02,c=a+j,k=Math.max(a,c)+t()*n*.005,z=Math.min(a,c)-t()*n*.005;f.push({ts:y+b*3e5,open:a,high:k,low:z,close:c,volume:t()*100}),x=c}return f}const h=E.getTime(),g=2500,S=p(120,g,h,m(1)),r=p(80,g,h,m(2)),U=p(200,g,h,m(3)),w=p(15,g,h,m(4)),e=(r[39].high+r[39].low)/2,v=[{id:"buy-1",side:"buy",price:e*.995,sizeUsd:500},{id:"buy-2",side:"buy",price:e*.99,sizeUsd:1e3},{id:"buy-3",side:"buy",price:e*.983,sizeUsd:750},{id:"sell-1",side:"sell",price:e*1.005,sizeUsd:500},{id:"sell-2",side:"sell",price:e*1.01,sizeUsd:1e3},{id:"sell-3",side:"sell",price:e*1.018,sizeUsd:750}],D=r[r.length-1].close,T={title:"Data/CandlestickChart",component:u,parameters:{layout:"padded",backgrounds:{default:"dark"}},argTypes:{candles:{control:"object"},height:{control:"number"},visibleCandles:{control:"number"},currentPrice:{control:"number"},orders:{control:"object"}}},o={args:{candles:S,height:300}},d={parameters:{controls:{disable:!0}},render:()=>C.jsx(u,{candles:r,orders:v,currentPrice:D,height:300})},l={parameters:{controls:{disable:!0}},render:()=>C.jsx(u,{candles:U,visibleCandles:30,height:300})},i={parameters:{controls:{disable:!0}},render:()=>C.jsx(u,{candles:w,height:300})};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    candles: candles120,
    height: 300
  }
}`,...o.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <CandlestickChart candles={candles80} orders={orders} currentPrice={currentPrice80} height={300} />
}`,...d.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <CandlestickChart candles={candles200} visibleCandles={30} height={300} />
}`,...l.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <CandlestickChart candles={candles15} height={300} />
}`,...i.parameters?.docs?.source}}};const _=["Default","WithOrders","ZoomedIn","FewCandles"];export{o as Default,i as FewCandles,d as WithOrders,l as ZoomedIn,_ as __namedExportsOrder,T as default};
