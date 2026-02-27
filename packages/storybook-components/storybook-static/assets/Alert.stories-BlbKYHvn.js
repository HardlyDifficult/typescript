import{a as r,j as e}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const l={title:"Feedback/Alert",component:r,argTypes:{variant:{control:"select",options:["error","info","warning","success"]},children:{control:"text"}}},a={args:{variant:"error",children:"Build failed. Check the logs for details."}},s={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"},children:[e.jsx(r,{variant:"error",children:"Build failed. Check the logs for details."}),e.jsx(r,{variant:"warning",children:"Your API key expires in 3 days."}),e.jsx(r,{variant:"success",children:"Deployment completed successfully."}),e.jsx(r,{variant:"info",children:"A new version is available."})]})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "error",
    children: "Build failed. Check the logs for details."
  }
}`,...a.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem"
  }}>
      <Alert variant="error">Build failed. Check the logs for details.</Alert>
      <Alert variant="warning">Your API key expires in 3 days.</Alert>
      <Alert variant="success">Deployment completed successfully.</Alert>
      <Alert variant="info">A new version is available.</Alert>
    </div>
}`,...s.parameters?.docs?.source}}};const o=["Default","Variants"];export{a as Default,s as Variants,o as __namedExportsOrder,l as default};
