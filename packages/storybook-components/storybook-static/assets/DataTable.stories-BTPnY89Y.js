import"./iframe-Ba19r_gW.js";import{D as n}from"./Collapsible-DxrLOWAC.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Data/DataTable",component:n,argTypes:{columns:{control:"object"},rows:{control:"object"},rowKey:{control:"text"},selectable:{control:"boolean"},emptyMessage:{control:"text"},onSelectionChange:{action:"onSelectionChange"}}},o=[{id:"1",name:"Alice",role:"Engineer",status:"Active"},{id:"2",name:"Bob",role:"Designer",status:"Away"},{id:"3",name:"Charlie",role:"PM",status:"Active"}],e={args:{columns:[{key:"name",header:"Name"},{key:"role",header:"Role"},{key:"status",header:"Status"}],rows:o,rowKey:"id"}},a={parameters:{controls:{disable:!0}},args:{columns:[{key:"name",header:"Name"},{key:"role",header:"Role"}],rows:o,rowKey:"id",selectable:!0}},r={parameters:{controls:{disable:!0}},args:{columns:[{key:"name",header:"Name"},{key:"role",header:"Role"}],rows:[],rowKey:"id",emptyMessage:"No team members found"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    columns: [{
      key: "name",
      header: "Name"
    }, {
      key: "role",
      header: "Role"
    }, {
      key: "status",
      header: "Status"
    }],
    rows: sampleRows,
    rowKey: "id"
  }
}`,...e.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    columns: [{
      key: "name",
      header: "Name"
    }, {
      key: "role",
      header: "Role"
    }],
    rows: sampleRows,
    rowKey: "id",
    selectable: true
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    columns: [{
      key: "name",
      header: "Name"
    }, {
      key: "role",
      header: "Role"
    }],
    rows: [],
    rowKey: "id",
    emptyMessage: "No team members found"
  }
}`,...r.parameters?.docs?.source}}};const c=["Default","Selectable","Empty"];export{e as Default,r as Empty,a as Selectable,c as __namedExportsOrder,m as default};
