import{T as n,j as e,L as a}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const c={title:"Content/Text",component:n,argTypes:{variant:{control:"select",options:["heading","subheading","body","caption","code"]},color:{control:"select",options:["default","secondary","muted","success","error","info","accent"]},children:{control:"text"}}},t={args:{variant:"body",children:"The quick brown fox jumps over the lazy dog."}},o={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{maxWidth:"480px",display:"flex",flexDirection:"column",gap:"0.75rem"},children:[e.jsx(n,{variant:"heading",children:"Build something great"}),e.jsx(n,{variant:"subheading",children:"Focused, opinionated tools"}),e.jsxs(n,{variant:"body",children:["Design systems give teams a shared language. Every component is a decision you only make once — freeing you to focus on what makes your product unique. Learn more at"," ",e.jsx(a,{href:"https://example.com",external:!0,children:"the docs"}),"."]}),e.jsx(n,{variant:"caption",children:"Updated 2 minutes ago"}),e.jsx(n,{variant:"code",children:"npm install @hardlydifficult/storybook-components"}),e.jsx(n,{variant:"body",color:"success",children:"Your changes have been saved."}),e.jsx(n,{variant:"body",color:"error",children:"Something went wrong, please try again."}),e.jsx(n,{variant:"body",color:"info",children:"This action will affect all team members."}),e.jsx(n,{variant:"body",color:"muted",children:"Last updated by system."})]})};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "body",
    children: "The quick brown fox jumps over the lazy dog."
  }
}`,...t.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <div style={{
    maxWidth: "480px",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem"
  }}>
      <Text variant="heading">Build something great</Text>
      <Text variant="subheading">Focused, opinionated tools</Text>
      <Text variant="body">
        Design systems give teams a shared language. Every component is a
        decision you only make once — freeing you to focus on what makes your
        product unique. Learn more at{" "}
        <Link href="https://example.com" external>the docs</Link>.
      </Text>
      <Text variant="caption">Updated 2 minutes ago</Text>
      <Text variant="code">npm install @hardlydifficult/storybook-components</Text>
      <Text variant="body" color="success">Your changes have been saved.</Text>
      <Text variant="body" color="error">Something went wrong, please try again.</Text>
      <Text variant="body" color="info">This action will affect all team members.</Text>
      <Text variant="body" color="muted">Last updated by system.</Text>
    </div>
}`,...o.parameters?.docs?.source}}};const d=["Default","Document"];export{t as Default,o as Document,d as __namedExportsOrder,c as default};
