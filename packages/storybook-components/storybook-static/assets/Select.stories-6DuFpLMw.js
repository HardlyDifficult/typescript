import{k as o,j as s}from"./Collapsible-DxrLOWAC.js";import{r as n}from"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Inputs/Select",component:o,argTypes:{placeholder:{control:"text"},value:{control:!1},onChange:{control:!1},options:{control:!1}}},l=[{value:"react",label:"React"},{value:"vue",label:"Vue"},{value:"svelte",label:"Svelte"}],e={args:{placeholder:void 0},render:r=>{const[t,c]=n.useState("react");return s.jsx(o,{...r,value:t,onChange:c,options:l})}},a={parameters:{controls:{disable:!0}},render:()=>{const[r,t]=n.useState("");return s.jsx(o,{value:r,onChange:t,placeholder:"Choose a framework...",options:l})}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: undefined
  },
  render: args => {
    const [value, setValue] = useState("react");
    return <Select {...args} value={value} onChange={setValue} options={FRAMEWORK_OPTIONS} />;
  }
}`,...e.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [value, setValue] = useState("");
    return <Select value={value} onChange={setValue} placeholder="Choose a framework..." options={FRAMEWORK_OPTIONS} />;
  }
}`,...a.parameters?.docs?.source}}};const i=["Default","WithPlaceholder"];export{e as Default,a as WithPlaceholder,i as __namedExportsOrder,m as default};
