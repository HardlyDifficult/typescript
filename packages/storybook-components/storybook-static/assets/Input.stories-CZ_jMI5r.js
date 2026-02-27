import{I as r,j as t}from"./Collapsible-DxrLOWAC.js";import{r as o}from"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Inputs/Input",component:r,argTypes:{value:{control:"text"},placeholder:{control:"text"},size:{control:"select",options:["sm","md"]},type:{control:"text"},multiline:{control:"boolean"}}},s={args:{placeholder:"Enter text...",size:"md",multiline:!1},render:e=>{const[n,u]=o.useState(e.value??"");return t.jsx(r,{...e,value:n,onChange:i=>u(i)})}},a={parameters:{controls:{disable:!0}},render:()=>{const[e,n]=o.useState(""),[u,i]=o.useState("");return t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem",maxWidth:"320px"},children:[t.jsx(r,{value:e,onChange:n,placeholder:"Small input",size:"sm"}),t.jsx(r,{value:u,onChange:i,placeholder:"Medium input",size:"md"})]})}},l={parameters:{controls:{disable:!0}},render:()=>{const[e,n]=o.useState("");return t.jsx("div",{style:{maxWidth:"400px"},children:t.jsx(r,{value:e,onChange:n,placeholder:"Write a description...",multiline:!0})})}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: "Enter text...",
    size: "md",
    multiline: false
  },
  render: args => {
    const [value, setValue] = useState(args.value ?? "");
    return <Input {...args} value={value} onChange={v => setValue(v)} />;
  }
}`,...s.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
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
}`,...a.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
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
}`,...l.parameters?.docs?.source}}};const x=["Default","Sizes","Multiline"];export{s as Default,l as Multiline,a as Sizes,x as __namedExportsOrder,p as default};
