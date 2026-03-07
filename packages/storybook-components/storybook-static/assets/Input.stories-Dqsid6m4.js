import{I as s,j as e}from"./Collapsible-BqOtdgWS.js";import{r as a}from"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const g={title:"Inputs/Input",component:s,argTypes:{value:{control:"text"},placeholder:{control:"text"},size:{control:"select",options:["sm","md"]},type:{control:"text"},multiline:{control:"boolean"}}},o={args:{placeholder:"Enter text...",size:"md",multiline:!1},render:t=>{const[n,r]=a.useState(t.value??"");return e.jsx(s,{...t,value:n,onChange:l=>r(l)})}},u={parameters:{controls:{disable:!0}},render:()=>{const[t,n]=a.useState(""),[r,l]=a.useState("");return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem",maxWidth:"320px"},children:[e.jsx(s,{value:t,onChange:n,placeholder:"Small input",size:"sm"}),e.jsx(s,{value:r,onChange:l,placeholder:"Medium input",size:"md"})]})}},i={parameters:{controls:{disable:!0}},render:()=>{const[t,n]=a.useState("");return e.jsx("div",{style:{maxWidth:"400px"},children:e.jsx(s,{value:t,onChange:n,placeholder:"Write a description...",multiline:!0})})}},p={parameters:{controls:{disable:!0}},render:()=>{const[t,n]=a.useState("const x = 42;");return e.jsx("div",{style:{maxWidth:"320px"},children:e.jsx(s,{value:t,onChange:n,placeholder:"Enter code...",mono:!0})})}},c={parameters:{controls:{disable:!0}},render:()=>{const[t,n]=a.useState(""),[r,l]=a.useState(""),[d,m]=a.useState("");return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem",maxWidth:"320px"},children:[e.jsx(s,{value:t,onChange:n,placeholder:"Text input",type:"text"}),e.jsx(s,{value:r,onChange:l,placeholder:"Password input",type:"password"}),e.jsx(s,{value:d,onChange:m,placeholder:"Email input",type:"email"})]})}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: "Enter text...",
    size: "md",
    multiline: false
  },
  render: args => {
    const [value, setValue] = useState(args.value ?? "");
    return <Input {...args} value={value} onChange={v => setValue(v)} />;
  }
}`,...o.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [sm, setSm] = useState("");
    const [md, setMd] = useState("");
    return <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
      maxWidth: "320px"
    }}>
        <Input value={sm} onChange={setSm} placeholder="Small input" size="sm" />
        <Input value={md} onChange={setMd} placeholder="Medium input" size="md" />
      </div>;
  }
}`,...u.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [value, setValue] = useState("");
    return <div style={{
      maxWidth: "400px"
    }}>
        <Input value={value} onChange={setValue} placeholder="Write a description..." multiline />
      </div>;
  }
}`,...i.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [value, setValue] = useState("const x = 42;");
    return <div style={{
      maxWidth: "320px"
    }}>
        <Input value={value} onChange={setValue} placeholder="Enter code..." mono />
      </div>;
  }
}`,...p.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [text, setText] = useState("");
    const [pass, setPass] = useState("");
    const [email, setEmail] = useState("");
    return <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
      maxWidth: "320px"
    }}>
        <Input value={text} onChange={setText} placeholder="Text input" type="text" />
        <Input value={pass} onChange={setPass} placeholder="Password input" type="password" />
        <Input value={email} onChange={setEmail} placeholder="Email input" type="email" />
      </div>;
  }
}`,...c.parameters?.docs?.source}}};const S=["Default","Sizes","Multiline","Mono","Types"];export{o as Default,p as Mono,i as Multiline,u as Sizes,c as Types,S as __namedExportsOrder,g as default};
