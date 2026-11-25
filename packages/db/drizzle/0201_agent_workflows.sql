CREATE TABLE "agent_workflow" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"column_id" integer,
	"max_rounds" integer DEFAULT 3 NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_workflow_status_check" CHECK ("agent_workflow"."status" IN ('active', 'paused')),
	CONSTRAINT "agent_workflow_trigger_check" CHECK (("agent_workflow"."trigger" = 'manual' AND "agent_workflow"."column_id" IS NULL)
        OR ("agent_workflow"."trigger" = 'status' AND "agent_workflow"."column_id" IS NOT NULL)),
	CONSTRAINT "agent_workflow_max_rounds_check" CHECK ("agent_workflow"."max_rounds" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "agent_workflow_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"issue_id" integer,
	"status" text DEFAULT 'running' NOT NULL,
	"input" text DEFAULT '' NOT NULL,
	"steps" jsonb NOT NULL,
	"max_rounds" integer NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"requested_by_user_id" text,
	"started_by_user_id" text,
	"canceled_by_user_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "agent_workflow_run_status_check" CHECK ("agent_workflow_run"."status" IN ('running', 'success', 'failed', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "agent_workflow_run_step" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_run_id" integer NOT NULL,
	"agent_run_id" integer NOT NULL,
	"position" integer NOT NULL,
	"round" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_workflow" ADD CONSTRAINT "agent_workflow_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow" ADD CONSTRAINT "agent_workflow_column_id_project_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."project_column"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "agent_workflow_run_workflow_id_agent_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."agent_workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "agent_workflow_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "agent_workflow_run_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "agent_workflow_run_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "agent_workflow_run_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "agent_workflow_run_canceled_by_user_id_user_id_fk" FOREIGN KEY ("canceled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run_step" ADD CONSTRAINT "agent_workflow_run_step_workflow_run_id_agent_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."agent_workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run_step" ADD CONSTRAINT "agent_workflow_run_step_agent_run_id_agent_run_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_workflow_project_idx" ON "agent_workflow" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_workflow_column_idx" ON "agent_workflow" USING btree ("column_id") WHERE "agent_workflow"."column_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_workflow_run_workflow_idx" ON "agent_workflow_run" USING btree ("workflow_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_workflow_run_running_idx" ON "agent_workflow_run" USING btree ("id") WHERE "agent_workflow_run"."status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX "agent_workflow_run_issue_running_uq" ON "agent_workflow_run" USING btree ("workflow_id","issue_id") WHERE "agent_workflow_run"."status" = 'running' AND "agent_workflow_run"."issue_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_workflow_run_issue_idx" ON "agent_workflow_run" USING btree ("issue_id") WHERE "agent_workflow_run"."issue_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_workflow_run_step_agent_run_uq" ON "agent_workflow_run_step" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "agent_workflow_run_step_run_idx" ON "agent_workflow_run_step" USING btree ("workflow_run_id","id");--> statement-breakpoint
CREATE FUNCTION rev_agent_workflow() RETURNS trigger AS $$
DECLARE pid integer;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD.project_id; ELSE pid := NEW.project_id; END IF;
  IF EXISTS (SELECT 1 FROM project WHERE id = pid) THEN
    PERFORM bump_rev('runner-queue:' || pid, pid);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER agent_workflow_rev AFTER INSERT OR UPDATE OR DELETE ON agent_workflow
  FOR EACH ROW EXECUTE FUNCTION rev_agent_workflow();
--> statement-breakpoint
CREATE TRIGGER agent_workflow_run_rev AFTER INSERT OR UPDATE OR DELETE ON agent_workflow_run
  FOR EACH ROW EXECUTE FUNCTION rev_agent_workflow();
