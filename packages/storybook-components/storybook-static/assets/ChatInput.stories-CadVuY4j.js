import"./iframe-Ba19r_gW.js";import{c as a}from"./Collapsible-DxrLOWAC.js";import"./preload-helper-PPVm8Dsz.js";const c={title:"Inputs/ChatInput",component:a,argTypes:{placeholder:{control:"text"},disabled:{control:"boolean"},contextLabel:{control:"text"},onSend:{control:!1}}},n={args:{onSend:e=>{console.log("Send:",e)},placeholder:"Type a message...",disabled:!1,contextLabel:void 0}},o={parameters:{controls:{disable:!0}},args:{onSend:e=>{console.log("Send:",e)},contextLabel:"workflow: fix-ci-pipeline"}},t={parameters:{controls:{disable:!0}},args:{onSend:e=>{console.log("Send:",e)},disabled:!0,placeholder:"Connecting..."}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    onSend: content => {
      console.log("Send:", content);
    },
    placeholder: "Type a message...",
    disabled: false,
    contextLabel: undefined
  }
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    onSend: content => {
      console.log("Send:", content);
    },
    contextLabel: "workflow: fix-ci-pipeline"
  }
}`,...o.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    onSend: content => {
      console.log("Send:", content);
    },
    disabled: true,
    placeholder: "Connecting..."
  }
}`,...t.parameters?.docs?.source}}};const d=["Default","WithContext","Disabled"];export{n as Default,t as Disabled,o as WithContext,d as __namedExportsOrder,c as default};
