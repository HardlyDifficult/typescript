import{G as o,j as t,S as i,b as n}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const l=[{label:"Store",items:[{href:"/",label:"Home"},{href:"/products",label:"Products"},{href:"/orders",label:"Orders"}]},{label:"Marketing",items:[{href:"/campaigns",label:"Campaigns"},{href:"/analytics",label:"Analytics"}]},{label:"Admin",items:[{href:"/team",label:"Team"},{href:"/settings",label:"Settings"}]}],u={title:"Navigation/GlobalNav",component:o,parameters:{layout:"fullscreen"},argTypes:{title:{control:"text"},currentPath:{control:"select",options:["/","/products","/orders","/campaigns","/analytics","/team","/settings"]},theme:{control:"radio",options:["light","dark"]},categories:{table:{disable:!0}},indicators:{table:{disable:!0}},renderLink:{table:{disable:!0}},onSignOut:{table:{disable:!0}},onToggleTheme:{table:{disable:!0}}},args:{title:"Acme Store",categories:l,onSignOut:()=>{alert("Sign out")}}},e={args:{currentPath:"/"}},a={parameters:{controls:{disable:!0}},args:{currentPath:"/orders",indicators:t.jsxs(i,{direction:"horizontal",gap:"sm",align:"center",children:[t.jsx(n,{variant:"success",size:"sm",children:"3 online"}),t.jsx(n,{variant:"default",size:"sm",children:"v2.1.0"})]})}},r={parameters:{controls:{disable:!0}},args:{currentPath:"/campaigns"}},s={parameters:{controls:{disable:!0}},args:{title:"Admin",categories:[{label:"Pages",items:[{href:"/",label:"Dashboard"},{href:"/users",label:"Users"}]}],currentPath:"/users"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    currentPath: "/"
  }
}`,...e.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    currentPath: "/orders",
    indicators: <Stack direction="horizontal" gap="sm" align="center">
        <Badge variant="success" size="sm">3 online</Badge>
        <Badge variant="default" size="sm">v2.1.0</Badge>
      </Stack>
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    currentPath: "/campaigns"
  }
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    title: "Admin",
    categories: [{
      label: "Pages",
      items: [{
        href: "/",
        label: "Dashboard"
      }, {
        href: "/users",
        label: "Users"
      }]
    }],
    currentPath: "/users"
  }
}`,...s.parameters?.docs?.source}}};const g=["Default","WithIndicators","ActiveSubpage","Minimal"];export{r as ActiveSubpage,e as Default,s as Minimal,a as WithIndicators,g as __namedExportsOrder,u as default};
