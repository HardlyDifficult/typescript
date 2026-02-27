import{b as r,j as e}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const c={title:"Content/Badge",component:r,argTypes:{variant:{control:"select",options:["default","success","warning","error","info","accent","muted"]},size:{control:"select",options:["sm","md"]},dot:{control:"boolean"},pulse:{control:"boolean"},children:{control:"text"}}},a={args:{variant:"success",children:"Merged",size:"md",dot:!1,pulse:!1}},n={parameters:{controls:{disable:!0}},args:{variant:"error",children:"Live",dot:!0,pulse:!0,size:"md"}},s={parameters:{controls:{disable:!0}},args:{variant:"success",dot:!0,pulse:!1,size:"md"}},t={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem",alignItems:"center"},children:[e.jsx(r,{variant:"default",children:"Draft"}),e.jsx(r,{variant:"success",children:"Merged"}),e.jsx(r,{variant:"warning",children:"Review"}),e.jsx(r,{variant:"error",children:"Failed"}),e.jsx(r,{variant:"info",children:"In progress"}),e.jsx(r,{variant:"accent",children:"New"}),e.jsx(r,{variant:"muted",children:"Archived"})]})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "success",
    children: "Merged",
    size: "md",
    dot: false,
    pulse: false
  }
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    variant: "error",
    children: "Live",
    dot: true,
    pulse: true,
    size: "md"
  }
}`,...n.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    variant: "success",
    dot: true,
    pulse: false,
    size: "md"
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <div style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    alignItems: "center"
  }}>
      <Badge variant="default">Draft</Badge>
      <Badge variant="success">Merged</Badge>
      <Badge variant="warning">Review</Badge>
      <Badge variant="error">Failed</Badge>
      <Badge variant="info">In progress</Badge>
      <Badge variant="accent">New</Badge>
      <Badge variant="muted">Archived</Badge>
    </div>
}`,...t.parameters?.docs?.source}}};const l=["Default","DotWithText","DotOnly","AllVariants"];export{t as AllVariants,a as Default,s as DotOnly,n as DotWithText,l as __namedExportsOrder,c as default};
