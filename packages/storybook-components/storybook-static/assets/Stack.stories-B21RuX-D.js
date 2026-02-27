import{S as i,j as e,B as t,b as s}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const l={title:"Layout/Stack",component:i,argTypes:{direction:{control:"select",options:["vertical","horizontal"]},gap:{control:"select",options:["xs","sm","md","lg"]},align:{control:"select",options:["start","center","end","baseline","stretch"]},wrap:{control:"boolean"}}},n={args:{direction:"vertical",gap:"md",align:"stretch",wrap:!1,children:"Stack content"}},r={parameters:{controls:{disable:!0}},render:()=>e.jsxs(i,{direction:"vertical",gap:"md",children:[e.jsx(s,{variant:"success",children:"Build passing"}),e.jsx(s,{variant:"info",children:"Tests running"}),e.jsx(s,{variant:"warning",children:"Review pending"})]})},a={parameters:{controls:{disable:!0}},render:()=>e.jsxs(i,{direction:"horizontal",gap:"sm",children:[e.jsx(t,{variant:"primary",size:"sm",children:"Approve"}),e.jsx(t,{variant:"secondary",size:"sm",children:"Request changes"}),e.jsx(t,{variant:"ghost",size:"sm",children:"Dismiss"})]})};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    direction: "vertical",
    gap: "md",
    align: "stretch",
    wrap: false,
    children: "Stack content"
  }
}`,...n.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Stack direction="vertical" gap="md">
      <Badge variant="success">Build passing</Badge>
      <Badge variant="info">Tests running</Badge>
      <Badge variant="warning">Review pending</Badge>
    </Stack>
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Stack direction="horizontal" gap="sm">
      <Button variant="primary" size="sm">
        Approve
      </Button>
      <Button variant="secondary" size="sm">
        Request changes
      </Button>
      <Button variant="ghost" size="sm">
        Dismiss
      </Button>
    </Stack>
}`,...a.parameters?.docs?.source}}};const p=["Default","Vertical","Horizontal"];export{n as Default,a as Horizontal,r as Vertical,p as __namedExportsOrder,l as default};
