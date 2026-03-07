import{p as n,j as e,B as t,T as c}from"./Collapsible-BqOtdgWS.js";import"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Feedback/Tooltip",component:n,argTypes:{content:{control:"text"}}},r={args:{content:"This is a tooltip."},render:i=>e.jsx(n,{...i,children:e.jsx(t,{variant:"secondary",children:"Hover me"})})},o={parameters:{controls:{disable:!0}},render:()=>e.jsxs(c,{children:["Hover over the"," ",e.jsx(n,{content:"This field is required and must be unique across your organization.",children:e.jsx("span",{style:{borderBottom:"1px dashed currentColor",cursor:"help"},children:"project name"})})," ","to learn more."]})},a={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{display:"flex",gap:"1.5rem",alignItems:"center"},children:[e.jsx(n,{content:"Delete this item permanently.",children:e.jsx(t,{variant:"danger",children:"Delete"})}),e.jsx(n,{content:"Save your changes before leaving.",children:e.jsx(t,{children:"Save"})}),e.jsx(n,{content:"This action cannot be undone.",children:e.jsx(t,{variant:"secondary",children:"Archive"})})]})},s={parameters:{controls:{disable:!0}},render:()=>e.jsx(n,{content:"This tooltip contains a longer description to demonstrate how the component handles wrapping text in a constrained space.",children:e.jsx(t,{variant:"secondary",children:"Hover for details"})})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    content: "This is a tooltip."
  },
  render: args => <Tooltip {...args}>
      <Button variant="secondary">Hover me</Button>
    </Tooltip>
}`,...r.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
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
}`,...o.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
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
}`,...a.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Tooltip content="This tooltip contains a longer description to demonstrate how the component handles wrapping text in a constrained space.">
      <Button variant="secondary">Hover for details</Button>
    </Tooltip>
}`,...s.parameters?.docs?.source}}};const u=["Default","OnText","OnIcon","LongContent"];export{r as Default,s as LongContent,a as OnIcon,o as OnText,u as __namedExportsOrder,m as default};
