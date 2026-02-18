/**
 * Linear GraphQL API types, response shapes, and query constants.
 *
 * This module contains all Linear-specific protocol knowledge:
 * - Internal response interfaces (not exported from the package)
 * - GraphQL query/mutation strings
 * - Priority mapping
 */

// --- Internal Linear API response shapes ---

export interface LinearProject {
  id: string;
  name: string;
  url: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
}

export interface LinearIssueLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearIssue {
  id: string;
  title: string;
  description: string | null;
  url: string;
  priority: number;
  state: { id: string };
  team: { id: string };
  project: { id: string } | null;
  labels: { nodes: LinearIssueLabel[] };
}

// --- GraphQL response wrappers ---

export interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

export interface TeamsQueryData {
  teams: { nodes: { id: string; name: string }[] };
}

export interface ProjectsQueryData {
  organization: { urlKey: string };
  team: {
    projects: {
      nodes: (LinearProject & {
        issues: { nodes: LinearIssue[] };
      })[];
    };
    states: { nodes: LinearWorkflowState[] };
    labels: { nodes: LinearIssueLabel[] };
  };
}

export interface ProjectQueryData {
  organization: { urlKey: string };
  project: LinearProject & {
    issues: { nodes: LinearIssue[] };
  };
  team: {
    states: { nodes: LinearWorkflowState[] };
    labels: { nodes: LinearIssueLabel[] };
  };
}

export interface IssueQueryData {
  issue: LinearIssue;
  team: {
    states: { nodes: LinearWorkflowState[] };
    labels: { nodes: LinearIssueLabel[] };
  };
}

export interface IssueCreateData {
  issueCreate: {
    issue: LinearIssue;
  };
}

export interface IssueUpdateData {
  issueUpdate: {
    issue: LinearIssue;
  };
}

export interface LabelCreateData {
  issueLabelCreate: {
    issueLabel: LinearIssueLabel;
  };
}

// --- Priority mapping ---

export const PRIORITY_NAME_TO_NUMBER: Partial<Record<string, number>> = {
  none: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

// --- GraphQL fragments and queries ---

export const ISSUE_FIELDS = `
  id title description url priority
  state { id }
  team { id }
  project { id }
  labels { nodes { id name color } }
`;

export const ISSUE_CREATE_MUTATION = `mutation($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    issue { ${ISSUE_FIELDS} }
  }
}`;

export const ISSUE_UPDATE_MUTATION = `mutation($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    issue { ${ISSUE_FIELDS} }
  }
}`;

export const ISSUE_FETCH_QUERY = `query($id: String!) {
  issue(id: $id) { ${ISSUE_FIELDS} }
}`;

export const LABEL_CREATE_MUTATION = `mutation($input: IssueLabelCreateInput!) {
  issueLabelCreate(input: $input) {
    issueLabel { id name color }
  }
}`;

export const LABEL_DELETE_MUTATION = `mutation($id: String!) {
  issueLabelDelete(id: $id) { success }
}`;
