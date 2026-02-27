import{n,j as e,B as a,T as i}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Feedback/Tooltip",component:n,argTypes:{content:{control:"text"}}},r={args:{content:"This is a tooltip."},render:s=>e.jsx(n,{...s,children:e.jsx(a,{variant:"secondary",children:"Hover me"})})},t={parameters:{controls:{disable:!0}},render:()=>e.jsxs(i,{children:["Hover over the"," ",e.jsx(n,{content:"This field is required and must be unique across your organization.",children:e.jsx("span",{style:{borderBottom:"1px dashed currentColor",cursor:"help"},children:"project name"})})," ","to learn more."]})},o={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{display:"flex",gap:"1.5rem",alignItems:"center"},children:[e.jsx(n,{content:"Delete this item permanently.",children:e.jsx(a,{variant:"danger",children:"Delete"})}),e.jsx(n,{content:"Save your changes before leaving.",children:e.jsx(a,{children:"Save"})}),e.jsx(n,{content:"This action cannot be undone.",children:e.jsx(a,{variant:"secondary",children:"Archive"})})]})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    content: "This is a tooltip."
  },
  render: args => <Tooltip {...args}>
      <Button variant="secondary">Hover me</Button>
    </Tooltip>
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Text>
      Hover over the{" "}
      <Tooltip content="This field is required and must be unique across your organization.">
        <span style={{
        borderBottom: "1px dashed currentColor",
        cursor: "help"
      }}>project name</span>
      </Tooltip>{" "}
      to learn more.
    </Text>
}`,...t.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <div style={{
    display: "flex",
    gap: "1.5rem",
    alignItems: "center"
  }}>
      <Tooltip content="Delete this item permanently.">
        <Button variant="danger">Delete</Button>
      </Tooltip>
      <Tooltip content="Save your changes before leaving.">
        <Button>Save</Button>
      </Tooltip>
      <Tooltip content="This action cannot be undone.">
        <Button variant="secondary">Archive</Button>
      </Tooltip>
    </div>
}`,...o.parameters?.docs?.source}}};const u=["Default","OnText","OnIcon"];export{r as Default,o as OnIcon,t as OnText,u as __namedExportsOrder,p as default};
