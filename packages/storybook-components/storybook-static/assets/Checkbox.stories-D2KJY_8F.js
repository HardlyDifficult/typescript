import{e as n,j as e}from"./Collapsible-DxrLOWAC.js";import{r as l}from"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const i={title:"Inputs/Checkbox",component:n,argTypes:{checked:{control:"boolean"},label:{control:"text"}}},c={args:{checked:!1,label:"Enable notifications"},render:r=>{const[s,o]=l.useState(r.checked??!1);return e.jsx(n,{...r,checked:s,onChange:t=>o(t)})}},a={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"},children:[e.jsx(n,{checked:!1,onChange:()=>{},label:"Unchecked"}),e.jsx(n,{checked:!0,onChange:()=>{},label:"Checked"}),e.jsx(n,{checked:!1,onChange:()=>{}}),e.jsx(n,{checked:!0,onChange:()=>{}})]})};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    checked: false,
    label: "Enable notifications"
  },
  render: args => {
    const [checked, setChecked] = useState(args.checked ?? false);
    return <Checkbox {...args} checked={checked} onChange={v => setChecked(v)} />;
  }
}`,...c.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem"
  }}>
      <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
      <Checkbox checked={true} onChange={() => {}} label="Checked" />
      <Checkbox checked={false} onChange={() => {}} />
      <Checkbox checked={true} onChange={() => {}} />
    </div>
}`,...a.parameters?.docs?.source}}};const p=["Default","States"];export{c as Default,a as States,p as __namedExportsOrder,i as default};
