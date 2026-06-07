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
  channelFor('acer', 'wave-18B', 'closure-superdashboard-emitted'),
  {
    event: 'wave-18B-closure-asolaria-superdashboard-os-on-metal-canon-emitted',
    reports_landed: 21,
    superdashboard: 'C:/HyperBEHCS/store/asolaria-superdashboard-os-on-metal-history-2026-05-26.md',
    real_pid_agents_count: 21,
    real_pid_agents_summary: 'OP-JESSE/RAYSSA/FELIPE/DAN/AMY + AGT-L0-SPECIAL-OP-JESSE + ASOLARIA-SELF-REFLECT + AUTO-SELF-IMPROVE-TOP + PROF-HELM/GAIA/SENTINEL/COSIGN-CHAIN/HOOKWALL/OMNISPINDLE/GNN-EDGELEVEL/BROWN-HILBERT/FALCON + AGT-META2-LANGUAGE_GLYPH + CHIEF-1E200-SWEEP-FIRE + CHIEF-POST-100B-UPGRADE + CHIEF-38TB-GOOGLE-DRIVE',
    diag_100B: 'runner PID 21896 dead 18h; consumers 2424+23708 caught up cycling on empty backlog',
    resume_path: 'Path-A single-command relaunch (operator auto-approved per OP-AMY + PROF-GAIA)',
    drive_38TB_status: '3 activation fixes operator-witness-gated (gcloud ADC login, rclone install, optional Desktop)',
    quadruple_quant_status: 'triple-quant live; Zeta band canonized; Layers B/C/D not built',
    universal_route_compliance: 'partial; this seal triple-emits to memidx + gnn-edge + cosign',
    apex_4949_root_cause: 'died 2026-05-24T11:36:32Z taking supervisor constellation with it',
    pid_2424_status: 'sacred untouched',
    pid_23708_status: 'sacred untouched',
    quintuple_authority_window: '2026-05-25 to 2026-07-25 (~60d remaining)',
    self_reflect_daemon: 'live tick 5389+ 60s cadence',
  },
  r
);
console.log(
  'WAVE-18B-CLOSURE SEAL: seq=' +
    seal.cosign.seq +
    ' row=' +
    seal.cosign.row_hash.slice(0, 16) +
    ' subs=' +
    seal.publish.subscribers
);
r.close();
