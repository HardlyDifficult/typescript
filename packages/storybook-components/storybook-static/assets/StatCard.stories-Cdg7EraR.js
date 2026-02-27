import{h as e,j as o}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Data/StatCard",component:e,argTypes:{label:{control:"text"},value:{control:"text"},trend:{control:"number"},caption:{control:"text"}}},r={args:{label:"Monthly Revenue",value:"$84,200",trend:12.5,caption:"vs last 30 days"}},a={parameters:{controls:{disable:!0}},render:()=>o.jsx(e,{label:"Monthly Revenue",value:"$84,200",trend:12.5,caption:"vs last 30 days"})},t={parameters:{controls:{disable:!0}},render:()=>o.jsx(e,{label:"Active Users",value:"12,459",trend:8.2,caption:"past 7 days"})},s={parameters:{controls:{disable:!0}},render:()=>o.jsx(e,{label:"Error Rate",value:"0.3%",trend:-41,caption:"vs last week"})},n={parameters:{controls:{disable:!0}},render:()=>o.jsx(e,{label:"API Requests",value:"2.4M"})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Monthly Revenue",
    value: "$84,200",
    trend: 12.5,
    caption: "vs last 30 days"
  }
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <StatCard label="Monthly Revenue" value="$84,200" trend={12.5} caption="vs last 30 days" />
}`,...a.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <StatCard label="Active Users" value="12,459" trend={8.2} caption="past 7 days" />
}`,...t.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <StatCard label="Error Rate" value="0.3%" trend={-41.0} caption="vs last week" />
}`,...s.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <StatCard label="API Requests" value="2.4M" />
}`,...n.parameters?.docs?.source}}};const u=["Default","Revenue","ActiveUsers","ErrorRate","NoTrend"];export{t as ActiveUsers,r as Default,s as ErrorRate,n as NoTrend,a as Revenue,u as __namedExportsOrder,p as default};
