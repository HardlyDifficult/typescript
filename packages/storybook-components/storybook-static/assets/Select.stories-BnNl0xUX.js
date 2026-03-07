import{m as t,j as n}from"./Collapsible-BqOtdgWS.js";import{r}from"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const S={title:"Inputs/Select",component:t,argTypes:{placeholder:{control:"text"},value:{control:!1},onChange:{control:!1},options:{control:!1}}},p=[{value:"react",label:"React"},{value:"vue",label:"Vue"},{value:"svelte",label:"Svelte"}],l={args:{placeholder:void 0},render:e=>{const[a,c]=r.useState("react");return n.jsx(t,{...e,value:a,onChange:c,options:p})}},s={parameters:{controls:{disable:!0}},render:()=>{const[e,a]=r.useState("");return n.jsx(t,{value:e,onChange:a,placeholder:"Choose a framework...",options:p})}},o={parameters:{controls:{disable:!0}},render:()=>{const[e,a]=r.useState("");return n.jsx(t,{value:e,onChange:a,placeholder:"Select a timezone...",options:[{value:"utc",label:"UTC"},{value:"est",label:"Eastern (EST)"},{value:"cst",label:"Central (CST)"},{value:"mst",label:"Mountain (MST)"},{value:"pst",label:"Pacific (PST)"},{value:"gmt",label:"GMT"},{value:"cet",label:"Central European (CET)"},{value:"jst",label:"Japan (JST)"}]})}},u={parameters:{controls:{disable:!0}},render:()=>{const[e,a]=r.useState("react"),[c,i]=r.useState("");return n.jsxs("div",{style:{display:"flex",gap:"0.75rem",alignItems:"center"},children:[n.jsx(t,{value:e,onChange:a,options:p}),n.jsx(t,{value:c,onChange:i,placeholder:"Language...",options:[{value:"ts",label:"TypeScript"},{value:"js",label:"JavaScript"}]})]})}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: undefined
  },
  render: args => {
    const [value, setValue] = useState("react");
    return <Select {...args} value={value} onChange={setValue} options={FRAMEWORK_OPTIONS} />;
  }
}`,...l.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [value, setValue] = useState("");
    return <Select value={value} onChange={setValue} placeholder="Choose a framework..." options={FRAMEWORK_OPTIONS} />;
  }
}`,...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [value, setValue] = useState("");
    return <Select value={value} onChange={setValue} placeholder="Select a timezone..." options={[{
      value: "utc",
      label: "UTC"
    }, {
      value: "est",
      label: "Eastern (EST)"
    }, {
      value: "cst",
      label: "Central (CST)"
    }, {
      value: "mst",
      label: "Mountain (MST)"
    }, {
      value: "pst",
      label: "Pacific (PST)"
    }, {
      value: "gmt",
      label: "GMT"
    }, {
      value: "cet",
      label: "Central European (CET)"
    }, {
      value: "jst",
      label: "Japan (JST)"
    }]} />;
  }
}`,...o.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [framework, setFramework] = useState("react");
    const [lang, setLang] = useState("");
    return <div style={{
      display: "flex",
      gap: "0.75rem",
      alignItems: "center"
    }}>
        <Select value={framework} onChange={setFramework} options={FRAMEWORK_OPTIONS} />
        <Select value={lang} onChange={setLang} placeholder="Language..." options={[{
        value: "ts",
        label: "TypeScript"
      }, {
        value: "js",
        label: "JavaScript"
      }]} />
      </div>;
  }
}`,...u.parameters?.docs?.source}}};const g=["Default","WithPlaceholder","ManyOptions","InContext"];export{l as Default,u as InContext,o as ManyOptions,s as WithPlaceholder,g as __namedExportsOrder,S as default};
