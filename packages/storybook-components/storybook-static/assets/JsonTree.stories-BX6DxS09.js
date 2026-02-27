import"./iframe-Ba19r_gW.js";import{J as d}from"./Collapsible-DxrLOWAC.js";import"./preload-helper-PPVm8Dsz.js";const i={title:"Data/JsonTree",component:d,argTypes:{label:{control:"text"},defaultExpandDepth:{control:{type:"range",min:0,max:5,step:1}}}},e={args:{data:{name:"workflow-123",status:"running",steps:4,enabled:!0,error:null},defaultExpandDepth:1}},a={args:{data:{workflow:{id:"wf-abc",status:"completed",tasks:[{name:"plan",status:"completed",durationMs:1200},{name:"code",status:"completed",durationMs:8500},{name:"test",status:"running",durationMs:3200}],config:{model:"claude-sonnet-4-6",maxSteps:20,tools:["read_file","write_file","bash"]}},metadata:{triggeredBy:"discord",repo:"HardlyDifficult/ai",branch:"feature/chat-ui",cost:.0042}},defaultExpandDepth:1}},n={args:{data:{request:{prompt:"Fix the CI pipeline",model:"claude-sonnet-4-6",tools:["read_file","bash"]},response:{text:"I found the issue in the test configuration.",tokens:{input:1500,output:420}}},defaultExpandDepth:5}},t={args:{data:{a:{b:{c:"deep"}},list:[1,2,3]},defaultExpandDepth:0}},s={args:{label:"Event Details",data:{requestId:"req-456",prompt:"Summarize the PR changes",response:"The PR adds a new chat interface to the dashboard.",inputTokens:2400,outputTokens:180,costUsd:.0018},defaultExpandDepth:1}},r={args:{data:[{id:1,name:"Alice",role:"admin"},{id:2,name:"Bob",role:"user"},{id:3,name:"Charlie",role:"user"}],defaultExpandDepth:1}},o={args:{data:"Just a string",defaultExpandDepth:1}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    data: {
      name: "workflow-123",
      status: "running",
      steps: 4,
      enabled: true,
      error: null
    },
    defaultExpandDepth: 1
  }
}`,...e.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    data: {
      workflow: {
        id: "wf-abc",
        status: "completed",
        tasks: [{
          name: "plan",
          status: "completed",
          durationMs: 1200
        }, {
          name: "code",
          status: "completed",
          durationMs: 8500
        }, {
          name: "test",
          status: "running",
          durationMs: 3200
        }],
        config: {
          model: "claude-sonnet-4-6",
          maxSteps: 20,
          tools: ["read_file", "write_file", "bash"]
        }
      },
      metadata: {
        triggeredBy: "discord",
        repo: "HardlyDifficult/ai",
        branch: "feature/chat-ui",
        cost: 0.0042
      }
    },
    defaultExpandDepth: 1
  }
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    data: {
      request: {
        prompt: "Fix the CI pipeline",
        model: "claude-sonnet-4-6",
        tools: ["read_file", "bash"]
      },
      response: {
        text: "I found the issue in the test configuration.",
        tokens: {
          input: 1500,
          output: 420
        }
      }
    },
    defaultExpandDepth: 5
  }
}`,...n.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    data: {
      a: {
        b: {
          c: "deep"
        }
      },
      list: [1, 2, 3]
    },
    defaultExpandDepth: 0
  }
}`,...t.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Event Details",
    data: {
      requestId: "req-456",
      prompt: "Summarize the PR changes",
      response: "The PR adds a new chat interface to the dashboard.",
      inputTokens: 2400,
      outputTokens: 180,
      costUsd: 0.0018
    },
    defaultExpandDepth: 1
  }
}`,...s.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    data: [{
      id: 1,
      name: "Alice",
      role: "admin"
    }, {
      id: 2,
      name: "Bob",
      role: "user"
    }, {
      id: 3,
      name: "Charlie",
      role: "user"
    }],
    defaultExpandDepth: 1
  }
}`,...r.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    data: "Just a string",
    defaultExpandDepth: 1
  }
}`,...o.parameters?.docs?.source}}};const c=["Default","NestedData","FullyExpanded","FullyCollapsed","WithLabel","ArrayRoot","PrimitiveValue"];export{r as ArrayRoot,e as Default,t as FullyCollapsed,n as FullyExpanded,a as NestedData,o as PrimitiveValue,s as WithLabel,c as __namedExportsOrder,i as default};
