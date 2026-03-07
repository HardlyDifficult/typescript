import{f as n,j as e}from"./Collapsible-BqOtdgWS.js";import{r as h}from"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Inputs/Checkbox",component:n,argTypes:{checked:{control:"boolean"},label:{control:"text"}}},c={args:{checked:!1,label:"Enable notifications"},render:s=>{const[l,a]=h.useState(s.checked??!1);return e.jsx(n,{...s,checked:l,onChange:t=>a(t)})}},o={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"},children:[e.jsx(n,{checked:!1,onChange:()=>{},label:"Unchecked"}),e.jsx(n,{checked:!0,onChange:()=>{},label:"Checked"}),e.jsx(n,{checked:!1,onChange:()=>{}}),e.jsx(n,{checked:!0,onChange:()=>{}})]})},r={parameters:{controls:{disable:!0}},render:()=>{const[s,l]=h.useState({email:!0,sms:!1,push:!0}),a=t=>l(i=>({...i,[t]:!i[t]}));return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"},children:[e.jsx(n,{checked:s.email,onChange:()=>a("email"),label:"Email notifications"}),e.jsx(n,{checked:s.sms,onChange:()=>a("sms"),label:"SMS notifications"}),e.jsx(n,{checked:s.push,onChange:()=>a("push"),label:"Push notifications"})]})}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    checked: false,
    label: "Enable notifications"
  },
  render: args => {
    const [checked, setChecked] = useState(args.checked ?? false);
    return <Checkbox {...args} checked={checked} onChange={v => setChecked(v)} />;
  }
}`,...c.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
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
}`,...o.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [items, setItems] = useState({
      email: true,
      sms: false,
      push: true
    });
    const toggle = (key: keyof typeof items) => setItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    return <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem"
    }}>
        <Checkbox checked={items.email} onChange={() => toggle("email")} label="Email notifications" />
        <Checkbox checked={items.sms} onChange={() => toggle("sms")} label="SMS notifications" />
        <Checkbox checked={items.push} onChange={() => toggle("push")} label="Push notifications" />
      </div>;
  }
}`,...r.parameters?.docs?.source}}};const k=["Default","States","Group"];export{c as Default,r as Group,o as States,k as __namedExportsOrder,p as default};
