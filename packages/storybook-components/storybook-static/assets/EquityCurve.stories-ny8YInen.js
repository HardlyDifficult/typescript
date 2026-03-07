import{i as n,j as u}from"./Collapsible-BqOtdgWS.js";import"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const E=new Date("2025-01-01T12:00:00.000Z");function o(e){return()=>(e=(e*16807+0)%2147483647,e/2147483647)}function i(e,h,g,b,f=.47){const d=[];let m=h;for(let l=0;l<e;l++)m+=(b()-f)*h*.005,d.push({ts:g+l*3e5,equityUsd:m});return d}const p=E.getTime(),c=1e4,S=i(200,c,p,o(10)),x=i(150,c,p,o(20),.42),y=i(100,c,p,o(30),.55),C=i(200,c,p,o(40)),q={title:"Data/EquityCurve",component:n,parameters:{layout:"padded",backgrounds:{default:"dark"}},argTypes:{snapshots:{control:"object"},height:{control:"number"},visiblePoints:{control:"number"},baselineLabel:{control:"text"}}},s={args:{snapshots:S,height:200}},t={parameters:{controls:{disable:!0}},render:()=>u.jsx(n,{snapshots:x,height:200})},r={parameters:{controls:{disable:!0}},render:()=>u.jsx(n,{snapshots:y,height:200})},a={parameters:{controls:{disable:!0}},render:()=>u.jsx(n,{snapshots:C,height:200,baselineLabel:"Starting Capital"})};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    snapshots: snapshots200,
    height: 200
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <EquityCurve snapshots={snapshotsProfitable} height={200} />
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <EquityCurve snapshots={snapshotsLosing} height={200} />
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <EquityCurve snapshots={snapshotsBaseline} height={200} baselineLabel="Starting Capital" />
}`,...a.parameters?.docs?.source}}};const v=["Default","Profitable","Losing","WithBaseline"];export{s as Default,r as Losing,t as Profitable,a as WithBaseline,v as __namedExportsOrder,q as default};
