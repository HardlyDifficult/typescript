import{l as r,j as n}from"./Collapsible-DxrLOWAC.js";import{r as l}from"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const b={title:"Navigation/Tabs",component:r,argTypes:{tabs:{control:"object"}}},u=[{value:"overview",label:"Overview"},{value:"activity",label:"Activity"},{value:"settings",label:"Settings"}],a={args:{tabs:u},render:e=>{const[s,o]=l.useState(e.tabs[0]?.value??"");return n.jsx(r,{tabs:e.tabs,value:s,onChange:o})}},t={parameters:{controls:{disable:!0}},render:()=>{const[e,s]=l.useState("overview");return n.jsx(r,{tabs:[{value:"overview",label:"Overview"},{value:"activity",label:"Activity"},{value:"settings",label:"Settings"},{value:"logs",label:"Logs"},{value:"metrics",label:"Metrics"}],value:e,onChange:s})}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    tabs: DEFAULT_TABS
  },
  render: args => {
    const [value, setValue] = useState(args.tabs[0]?.value ?? "");
    return <Tabs tabs={args.tabs} value={value} onChange={setValue} />;
  }
}`,...a.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [value, setValue] = useState("overview");
    return <Tabs tabs={[{
      value: "overview",
      label: "Overview"
    }, {
      value: "activity",
      label: "Activity"
    }, {
      value: "settings",
      label: "Settings"
    }, {
      value: "logs",
      label: "Logs"
    }, {
      value: "metrics",
      label: "Metrics"
    }]} value={value} onChange={setValue} />;
  }
}`,...t.parameters?.docs?.source}}};const g=["Default","ManyTabs"];export{a as Default,t as ManyTabs,g as __namedExportsOrder,b as default};
