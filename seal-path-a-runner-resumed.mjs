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
  channelFor('acer', '100B', 'path-A-runner-resumed-2026-05-26'),
  {
    event: 'path-A-100B-runner-resumed-after-18h-stall',
    runner_relaunch_ts: '2026-05-26T15:00:49Z',
    runner_cmdline: 'node tools/neurotech-real-100b-agent-runner.js daemon --execute --packets=5000000 --sleep-ms=1000',
    pre_resume_state: {
      processedPackets: 1980000000,
      completedChunks: 1980,
      geniusHits: 5500447,
      mistakeHits: 2202884,
      proofSamples: 5,
      lastPacketPid: 'BH.REAL100B.OPENCODE.PID.001980000000',
      runner_dead_since: '2026-05-25T20:02:58Z',
      stall_duration_h: 18,
    },
    post_resume_state_after_15s: {
      processedPackets: 2080000000,
      completedChunks: 2080,
      geniusHits: 5778247,
      mistakeHits: 2313984,
      proofSamples: 15,
      lastPacketPid: 'BH.REAL100B.OPENCODE.PID.002080000000',
      packets_advanced: 100000000,
      genius_advanced: 277800,
      mistake_advanced: 111100,
    },
    daemon_status_flip: 'CAUGHT_UP -> BACKFILLING (auto-detected within 1s as apex predicted)',
    rate_observed: '6.7M packets/sec burst',
    estimated_completion_at_burst_rate: '~4h to 100B target from 2.08B',
    authority: 'OP-AMY auto-approved + PROF-GAIA no-external-auth + Quintuple-window 2026-05-25 to 2026-07-25',
    apex_plan_source: 'AGT-L0-SPECIAL-OP-JESSE-H12D3 wave-18B report 06',
    pid_2424_status: 'sacred untouched',
    pid_23708_status: 'sacred untouched',
    next_action: 'add intermediate heartbeat sibling files (chunk/100-gulp/10M-packet cadence) per Task #2',
  },
  r
);
console.log(
  'PATH-A-RESUMED SEAL: seq=' +
    seal.cosign.seq +
    ' row=' +
    seal.cosign.row_hash.slice(0, 16) +
    ' subs=' +
    seal.publish.subscribers
);
r.close();
