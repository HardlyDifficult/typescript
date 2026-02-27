import{M as r,j as e,B as o,S as u,T as c,f as m}from"./Collapsible-DxrLOWAC.js";import{r as d}from"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const C={title:"Feedback/Modal",component:r,argTypes:{title:{control:"text"},size:{control:"select",options:["sm","md","lg","full"]}}},s={args:{title:"Modal Title",size:"md"},render:t=>{const[n,p]=d.useState(!1);return e.jsxs(e.Fragment,{children:[e.jsx(o,{onClick:()=>{p(!0)},children:"Open Modal"}),n&&e.jsx(r,{...t,onClose:()=>{p(!1)},children:e.jsx(c,{children:"Modal content goes here."})})]})}},a={parameters:{controls:{disable:!0}},render:()=>{const[t,n]=d.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(o,{onClick:()=>{n(!0)},children:"Open Modal"}),t&&e.jsx(r,{title:"Confirm Action",size:"sm",onClose:()=>{n(!1)},children:e.jsxs(u,{direction:"vertical",gap:"md",children:[e.jsx(c,{children:"Are you sure you want to delete this workflow? This cannot be undone."}),e.jsxs(u,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(o,{variant:"danger",children:"Delete"}),e.jsx(o,{variant:"secondary",onClick:()=>{n(!1)},children:"Cancel"})]})]})})]})}},l={parameters:{controls:{disable:!0}},render:()=>{const[t,n]=d.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(o,{onClick:()=>{n(!0)},children:"View Details"}),t&&e.jsx(r,{title:"Build Output",size:"md",onClose:()=>{n(!1)},children:e.jsxs(u,{direction:"vertical",gap:"sm",children:[e.jsx(c,{variant:"caption",color:"muted",children:"Build #482 completed in 34s"}),e.jsx(m,{language:"text",children:`Installing dependencies...
Compiling 24 modules...
Bundle size: 33.7 kB (gzip: 7.4 kB)
Build successful.`})]})})]})}},i={parameters:{controls:{disable:!0}},render:()=>{const[t,n]=d.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(o,{onClick:()=>{n(!0)},children:"Open Editor"}),t&&e.jsx(r,{title:"Edit Configuration",size:"lg",onClose:()=>{n(!1)},children:e.jsx(c,{variant:"caption",color:"muted",children:"The lg size takes most of the viewport, suited for editors or long-form content."})})]})}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Modal Title",
    size: "md"
  },
  render: args => {
    const [open, setOpen] = useState(false);
    return <>
        <Button onClick={() => {
        setOpen(true);
      }}>Open Modal</Button>
        {open && <Modal {...args} onClose={() => {
        setOpen(false);
      }}>
            <Text>Modal content goes here.</Text>
          </Modal>}
      </>;
  }
}`,...s.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [open, setOpen] = useState(true);
    return <>
        <Button onClick={() => {
        setOpen(true);
      }}>Open Modal</Button>
        {open && <Modal title="Confirm Action" size="sm" onClose={() => {
        setOpen(false);
      }}>
            <Stack direction="vertical" gap="md">
              <Text>Are you sure you want to delete this workflow? This cannot be undone.</Text>
              <Stack direction="horizontal" gap="sm" align="center">
                <Button variant="danger">Delete</Button>
                <Button variant="secondary" onClick={() => {
              setOpen(false);
            }}>Cancel</Button>
              </Stack>
            </Stack>
          </Modal>}
      </>;
  }
}`,...a.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [open, setOpen] = useState(true);
    return <>
        <Button onClick={() => {
        setOpen(true);
      }}>View Details</Button>
        {open && <Modal title="Build Output" size="md" onClose={() => {
        setOpen(false);
      }}>
            <Stack direction="vertical" gap="sm">
              <Text variant="caption" color="muted">Build #482 completed in 34s</Text>
              <CodeBlock language="text">
                {\`Installing dependencies...\\nCompiling 24 modules...\\nBundle size: 33.7 kB (gzip: 7.4 kB)\\nBuild successful.\`}
              </CodeBlock>
            </Stack>
          </Modal>}
      </>;
  }
}`,...l.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => {
    const [open, setOpen] = useState(true);
    return <>
        <Button onClick={() => {
        setOpen(true);
      }}>Open Editor</Button>
        {open && <Modal title="Edit Configuration" size="lg" onClose={() => {
        setOpen(false);
      }}>
            <Text variant="caption" color="muted">
              The lg size takes most of the viewport, suited for editors or long-form content.
            </Text>
          </Modal>}
      </>;
  }
}`,...i.parameters?.docs?.source}}};const h=["Default","ConfirmAction","MediumContent","LargeContent"];export{a as ConfirmAction,s as Default,i as LargeContent,l as MediumContent,h as __namedExportsOrder,C as default};
