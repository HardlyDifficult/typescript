import{B as e,j as n,S as c,T as d}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Inputs/Button",component:e,argTypes:{variant:{control:"select",options:["primary","secondary","ghost","danger","link"]},size:{control:"select",options:["sm","md"]},disabled:{control:"boolean"},loading:{control:"boolean"},children:{control:"text"}}},r={args:{variant:"primary",size:"md",children:"Deploy"}},t={parameters:{controls:{disable:!0}},render:()=>n.jsxs(c,{direction:"horizontal",gap:"sm",align:"center",children:[n.jsx(e,{variant:"primary",children:"Primary"}),n.jsx(e,{variant:"secondary",children:"Secondary"}),n.jsx(e,{variant:"ghost",children:"Ghost"}),n.jsx(e,{variant:"danger",children:"Danger"}),n.jsx(e,{variant:"link",children:"Link"})]})},a={parameters:{controls:{disable:!0}},render:()=>n.jsxs(c,{direction:"horizontal",gap:"sm",align:"center",children:[n.jsx(e,{size:"md",children:"Medium"}),n.jsx(e,{size:"sm",children:"Small"})]})},o={parameters:{controls:{disable:!0}},render:()=>n.jsxs(c,{direction:"horizontal",gap:"sm",align:"center",children:[n.jsx(e,{children:"Default"}),n.jsx(e,{loading:!0,children:"Loading"}),n.jsx(e,{disabled:!0,children:"Disabled"})]})},s={parameters:{controls:{disable:!0}},render:()=>n.jsxs(c,{direction:"horizontal",gap:"sm",align:"center",children:[n.jsx(d,{variant:"body",children:"Unsaved changes"}),n.jsx(e,{variant:"secondary",children:"Cancel"}),n.jsx(e,{children:"Save"})]})},i={parameters:{controls:{disable:!0}},render:()=>n.jsxs(d,{variant:"body",children:["See the ",n.jsx(e,{variant:"link",children:"documentation"})," for details."]})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "primary",
    size: "md",
    children: "Deploy"
  }
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Stack direction="horizontal" gap="sm" align="center">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="link">Link</Button>
    </Stack>
}`,...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Stack direction="horizontal" gap="sm" align="center">
      <Button size="md">Medium</Button>
      <Button size="sm">Small</Button>
    </Stack>
}`,...a.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Stack direction="horizontal" gap="sm" align="center">
      <Button>Default</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </Stack>
}`,...o.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Stack direction="horizontal" gap="sm" align="center">
      <Text variant="body">Unsaved changes</Text>
      <Button variant="secondary">Cancel</Button>
      <Button>Save</Button>
    </Stack>
}`,...s.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Text variant="body">
      See the <Button variant="link">documentation</Button> for details.
    </Text>
}`,...i.parameters?.docs?.source}}};const g=["Default","Variants","Sizes","States","InContext","LinkVariant"];export{r as Default,s as InContext,i as LinkVariant,a as Sizes,o as States,t as Variants,g as __namedExportsOrder,p as default};
