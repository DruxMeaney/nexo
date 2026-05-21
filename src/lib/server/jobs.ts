import type { PipelineJob } from "@/lib/types";

declare global {
  var __nexoJobs: Map<string, PipelineJob> | undefined;
}

export function getJobStore() {
  if (!globalThis.__nexoJobs) {
    globalThis.__nexoJobs = new Map<string, PipelineJob>();
  }
  return globalThis.__nexoJobs;
}

export function getJob(id: string) {
  return getJobStore().get(id);
}

export function saveJob(job: PipelineJob) {
  job.updatedAt = new Date().toISOString();
  getJobStore().set(job.id, job);
  return job;
}
