import{K as t,j as a}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const i={title:"Data/KeyValue",component:t,argTypes:{label:{control:"text"},children:{control:"text"},direction:{control:"select",options:["horizontal","vertical"]}}},e={args:{label:"Repository",children:"hardlydifficult/storybook-components",direction:"horizontal"}},r={parameters:{controls:{disable:!0}},render:()=>a.jsx(t,{label:"Repository",children:"hardlydifficult/storybook-components"})},o={parameters:{controls:{disable:!0}},render:()=>a.jsx(t,{label:"Description",direction:"vertical",children:"A React component library with Tailwind CSS tokens."})};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Repository",
    children: "hardlydifficult/storybook-components",
    direction: "horizontal"
  }
}`,...e.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <KeyValue label="Repository">hardlydifficult/storybook-components</KeyValue>
}`,...r.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <KeyValue label="Description" direction="vertical">
      A React component library with Tailwind CSS tokens.
    </KeyValue>
}`,...o.parameters?.docs?.source}}};const c=["Default","Horizontal","Vertical"];export{e as Default,r as Horizontal,o as Vertical,c as __namedExportsOrder,i as default};
