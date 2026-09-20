import { useState } from 'react'

import { formatRealLog, formatReport, type Job, type Pipeline } from '../../engine/ci'
import { useDispatch } from '../../store'
import styles from './GitNub.module.css'

const JOB_ICON: Record<Job['status'], string> = {
  waiting: '○',
  running: '↻',
  passed: '✓',
  failed: '✗',
  skipped: '○',
}

export function ChecksPanel({ pipeline }: { pipeline: Pipeline }) {
  return (
    <section className={styles.checks} aria-label="Checks">
      <h3 className={styles.sectionTitle}>Checks</h3>
      {pipeline.stages.map((stage) => (
        <div key={stage.name} className={styles.checkStage}>
          <h4 className={styles.checkStageName}>{stage.name}</h4>
          <ul className={styles.checkJobs}>
            {stage.jobs.map((job) => (
              <CheckJob key={job.id} job={job} pipeline={pipeline} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function CheckJob({ job, pipeline }: { job: Job; pipeline: Pipeline }) {
  const dispatch = useDispatch()
  const [open, setOpen] = useState(job.status === 'failed')
  const [realLog, setRealLog] = useState(false)
  const canRun = job.kind === 'manual' && (job.status === 'waiting' || job.status === 'failed')

  const run = () => {
    dispatch({ type: 'startJob', pipelineId: pipeline.id, jobId: job.id })
    dispatch({ type: 'runJob', pipelineId: pipeline.id, jobId: job.id })
  }

  const report =
    job.result && job.result.length > 0
      ? { service: pipeline.service, startedAt: pipeline.startedAt, tests: job.result }
      : undefined
  const reportText = report
    ? realLog
      ? formatRealLog(report)
      : formatReport(report)
          .map((line) => line.text)
          .join('\n')
    : ''

  return (
    <li className={styles.checkJob} data-status={job.status}>
      <div className={styles.checkJobRow}>
        <span aria-hidden="true">{JOB_ICON[job.status]}</span>
        <span>
          {job.name}{' '}
          <span className={styles.muted}>
            {job.status}
            {job.durationMs > 0 ? ` · ${(job.durationMs / 1000).toFixed(1)}s` : ''}
          </span>
        </span>
        {canRun && (
          <button
            type="button"
            className={styles.runJob}
            data-target={`job:${job.id}`}
            onClick={run}
            aria-label={`Run ${job.name}`}
          >
            ▶ Run
          </button>
        )}
        {report && (
          <button
            type="button"
            className={styles.secondaryButton}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Hide report' : 'Show report'}
          </button>
        )}
      </div>
      {open && report && (
        <div className={styles.report}>
          <label className={styles.yamlToggle}>
            <input
              type="checkbox"
              checked={realLog}
              onChange={(event) => setRealLog(event.target.checked)}
            />
            Show the real log
          </label>
          <pre
            className={styles.reportPre}
            aria-label={realLog ? 'Real log' : 'Plain-English report'}
          >
            {reportText}
          </pre>
        </div>
      )}
    </li>
  )
}
