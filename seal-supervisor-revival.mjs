import { durableNotify } from './src/cosign-bridge.mjs';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';

const r = new RedisBridge({
  host: '127.0.0.1',
  port: 6379,
  vantage: 'acer',
  bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98',
});
await r.connect();
await r.auth();
const seal = await durableNotify(
  channelFor('acer', 'supervisor', 'partial-revival-2-scheduled-tasks-enabled'),
  {
    event: 'supervisor-constellation-partial-revival-acer-side',
    ts: '2026-05-26T16:18Z',
    enabled_scheduled_tasks: [
      'Asolaria System Supervisor (Keep-Asolaria-SystemSupervisor.ps1, PID 21764, 90s cadence)',
      'Asolaria HyperBEHCS Omnischeduler Tick',
    ],
    still_disabled_tasks: [
      'Asolaria Core Boot Startup (boots :4781)',
      'Asolaria One Button Startup',
      'Asolaria Omni Consolidation Cascade',
      'Asolaria NotebookLM Build Loop',
      'Asolaria NotebookLM Upgrade Loop',
    ],
    prof_supervisor_hbp_files: 'still frozen at 2026-05-24T17:43Z (326 files; per-PID heartbeaters not yet respawned)',
    apex_4949_dashboard: 'still DEAD; not yet probed for launcher',
    side_effect_noted: 'safety-probe Start-Asolaria-SystemSupervisor.ps1 -RunOnce stopped existing PID 6436 before exiting; net regression mitigated by enable+start of scheduled task',
    advance_during_revival_100B: '22.56B -> 23.47B (+910M in 4min, sustained 3.8M/sec)',
    pid_2424_status: 'sacred untouched (786 MB)',
    pid_23708_status: 'sacred untouched (791 MB)',
    self_reflect_daemon: 'live tick 5498',
    authority: 'Quintuple-Authority 2026-05-25 to 2026-07-25 + OP-AMY auto-approve + PROF-GAIA no-external-auth',
    apex_plan_reference: 'AGT-L0-SPECIAL-OP-JESSE-H12D3 wave-18B report 06 + AUTO-SELF-IMPROVE-TOP report 08',
    liris_parallel: 'liris writing universal-route dual-emit PR per her #1 recommendation',
    next_steps: [
      'find per-prof-supervisor-spawner script (not in System Supervisor scope)',
      'enable Asolaria Core Boot Startup to revive :4781 backend',
      'find :4949 apex dashboard launcher (still unidentified)',
    ],
  },
  r
);
console.log(
  'SUPERVISOR-PARTIAL-REVIVAL SEAL: seq=' +
    seal.cosign.seq +
    ' row=' +
    seal.cosign.row_hash.slice(0, 16) +
    ' subs=' +
    seal.publish.subscribers
);
r.close();
