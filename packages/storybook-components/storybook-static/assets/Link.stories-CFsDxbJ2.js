import{L as r,j as e,T as o,S as c}from"./Collapsible-BqOtdgWS.js";import"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Content/Link",component:r,argTypes:{href:{control:"text"},external:{control:"boolean"},children:{control:"text"}}},t={args:{href:"https://example.com",children:"Example link"}},n={args:{href:"https://example.com",external:!0,children:"Opens in new tab"}},a={parameters:{controls:{disable:!0}},render:()=>e.jsxs(o,{variant:"body",children:["Read the ",e.jsx(r,{href:"https://example.com",children:"documentation"})," for setup instructions, or visit the"," ",e.jsx(r,{href:"https://github.com",external:!0,children:"GitHub repository"})," ","for source code."]})},s={parameters:{controls:{disable:!0}},render:()=>e.jsxs(c,{direction:"vertical",gap:"sm",children:[e.jsx(r,{href:"https://example.com",children:"Internal link"}),e.jsx(r,{href:"https://example.com",external:!0,children:"External link (new tab)"})]})};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    href: "https://example.com",
    children: "Example link"
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    href: "https://example.com",
    external: true,
    children: "Opens in new tab"
  }
}`,...n.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Text variant="body">
      Read the <Link href="https://example.com">documentation</Link> for setup
      instructions, or visit the{" "}
      <Link href="https://github.com" external>
        GitHub repository
      </Link>{" "}
      for source code.
    </Text>
}`,...a.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Stack direction="vertical" gap="sm">
      <Link href="https://example.com">Internal link</Link>
      <Link href="https://example.com" external>
        External link (new tab)
      </Link>
    </Stack>
}`,...s.parameters?.docs?.source}}};const d=["Default","External","InContext","Variants"];export{t as Default,n as External,a as InContext,s as Variants,d as __namedExportsOrder,m as default};
