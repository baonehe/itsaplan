import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { noContent } from '#shared/http';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { paginate } from '#shared/pagination';
import {
  WorkflowPageResponse,
  WorkflowResponse,
  WorkflowRunDetailResponse,
  WorkflowRunListResponse,
  createWorkflowBody,
  startWorkflowRunBody,
  updateWorkflowBody,
  workflowPageQuery,
  workflowParams,
  workflowRunParams,
} from './model';
import {
  cancelWorkflowRun,
  createWorkflow,
  deleteWorkflow,
  getWorkflowRun,
  listWorkflowRuns,
  listWorkflows,
  runWorkflow,
  updateWorkflow,
} from './service';

export const agentWorkflowRoutes = new Elysia({
  name: 'agent-workflows',
  detail: { tags: ['Agent Workflows'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/workflows',
    ({ project, query }) => paginate(query, (window) => listWorkflows(project.id, window)),
    {
      permission: ['agent_schedules', 'read'],
      query: workflowPageQuery,
      response: { 200: WorkflowPageResponse, ...accessErrors },
      detail: { summary: 'List agent workflows' },
    },
  )
  .post(
    '/projects/:projectKey/workflows',
    async ({ project, body, user, set }) => {
      const trigger = body.trigger ?? 'manual';
      const row = await createWorkflow(
        project.id,
        {
          name: body.name,
          status: body.status ?? 'active',
          trigger,
          columnId: trigger === 'manual' ? null : (body.columnId ?? null),
          maxRounds: body.maxRounds ?? 3,
          steps: body.steps,
        },
        requireUser(user).id,
      );
      set.status = 201;
      return row;
    },
    {
      permission: ['agent_schedules', 'create'],
      body: createWorkflowBody,
      response: { 201: WorkflowResponse, ...commonErrors },
      detail: { summary: 'Create an agent workflow' },
    },
  )
  .patch(
    '/projects/:projectKey/workflows/:workflowId',
    ({ project, params, body, user }) =>
      updateWorkflow(
        project.id,
        params.workflowId,
        {
          ...body,
          columnId: body.columnId === undefined ? undefined : (body.columnId ?? null),
        },
        requireUser(user).id,
      ),
    {
      permission: ['agent_schedules', 'edit'],
      params: workflowParams,
      body: updateWorkflowBody,
      response: { 200: WorkflowResponse, ...commonErrors },
      detail: { summary: 'Update an agent workflow' },
    },
  )
  .delete(
    '/projects/:projectKey/workflows/:workflowId',
    async ({ project, params }) => {
      await deleteWorkflow(project.id, params.workflowId);
      return noContent();
    },
    {
      permission: ['agent_schedules', 'delete'],
      params: workflowParams,
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Delete an agent workflow' },
    },
  )
  .post(
    '/projects/:projectKey/workflows/:workflowId/runs',
    async ({ project, params, body, user, set }) => {
      const run = await runWorkflow(project.id, params.workflowId, body, requireUser(user).id);
      set.status = 201;
      return run;
    },
    {
      permission: ['agent_schedules', 'edit'],
      params: workflowParams,
      body: startWorkflowRunBody,
      response: { 201: WorkflowRunDetailResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Run an agent workflow' },
    },
  )
  .get(
    '/projects/:projectKey/workflows/:workflowId/runs',
    ({ project, params }) => listWorkflowRuns(project.id, params.workflowId),
    {
      permission: ['agent_schedules', 'read'],
      params: workflowParams,
      response: { 200: WorkflowRunListResponse, ...commonErrors },
      detail: { summary: 'List the runs of an agent workflow' },
    },
  )
  .get(
    '/projects/:projectKey/workflows/:workflowId/runs/:runId',
    ({ project, params }) => getWorkflowRun(project.id, params.workflowId, params.runId),
    {
      permission: ['agent_schedules', 'read'],
      params: workflowRunParams,
      response: { 200: WorkflowRunDetailResponse, ...commonErrors },
      detail: { summary: 'Read a run of an agent workflow' },
    },
  )
  .post(
    '/projects/:projectKey/workflows/:workflowId/runs/:runId/cancel',
    ({ project, params, user }) =>
      cancelWorkflowRun(project.id, params.workflowId, params.runId, requireUser(user).id),
    {
      permission: ['agent_schedules', 'edit'],
      params: workflowRunParams,
      response: { 200: WorkflowRunDetailResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Cancel a run of an agent workflow' },
    },
  );
