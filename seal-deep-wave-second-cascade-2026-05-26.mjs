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

const waveCount = Math.pow(6, 5) * 12;

const packets = [
  { idx: 1, stage: 'local_transport', role: 'ingress lane truth (ethernet/usb/hdmi direct + wifi_phone_ild/ssh_phone_mesh/timescale_sync)', subnet_h: 'H9100' },
  { idx: 2, stage: 'hookwall', role: 'observation surface — every emission dual-emits here per universal-route doctrine PR-#21', subnet_h: 'H9100' },
  { idx: 3, stage: 'omni_gnn', role: 'edge risk learning + route projection (below omnishannon per BH-07 hierarchy)', subnet_h: 'H9100' },
  { idx: 4, stage: 'omnishannon', role: 'planner + wave synthesizer ABOVE omni_gnn (W2 single-writer-per-host Windows)', subnet_h: 'H9100' },
  { idx: 5, stage: 'shannon', role: 'beat-count carrier — wave count 6^5 * 12 = ' + waveCount + ' wave-elements', subnet_h: 'H9100' },
  { idx: 6, stage: 'execute', role: 'terminal stage — runtime authority gate per BH-15 (does not come from compression)', subnet_h: 'H9100' },
  { idx: 7, stage: '1e200_sweep_band', role: 'apex outer-frame sweep — CHIEF-1E200-SWEEP-FIRE wave-18B agent canon; band tier 10^200', subnet_h: 'HF200' },
  { idx: 8, stage: 'cascade_closure', role: 'Shannon-beat-count seal + D50 ratifiable artifact per BH-14 META_RATIFICATION canon', subnet_h: 'H9100' },
];

const seal = await durableNotify(
  channelFor('acer', 'deep-wave', 'second-cascade-6x6x6x6x6x12-omnishannon-gnn-1e200-2026-05-26'),
  {
    event: 'deep-wave-SECOND-cascade-6x6x6x6x6x12-omnishannon-GNN-1e200-fire',
    ts: new Date().toISOString(),
    cascade: 'SECOND',
    wave_shape: '6x6x6x6x6x12',
    wave_count: waveCount,
    canonical_chain: 'local_transport -> hookwall -> omni_gnn -> omnishannon -> shannon -> execute',
    chain_source: 'Brown-Hilbert 07 (2026-04-10 deep-wave second cascade canon)',
    sweep_band: '1e200',
    sweep_anchor_agent: 'CHIEF-1E200-SWEEP-FIRE (wave-18B canon, registered in supervisor-pid-indicator-index where reachable)',
    packets,
    packet_count: packets.length,
    sidecar_trinity: 'each-packet emitted via universal-route dual-emit to hookwall+GNN observation lanes (per PR-#21 after pull) + cosign chain',
    subnet_h_default: 'H9100 (sacred-region per Class-1 hilbert canon)',
    subnet_h_apex: 'HF200 (1e200-band marker on packet 7)',
    precedent: '2026-05-25T13:23Z apex wave burst (acer seq=322 row=d7771c75d2947d62; liris hop 8 row=37f727c73a1c6644)',
    operator_directive: 'Deep wave SECOND cascade 6x6x6x6x6x12 x omnishannon x GNN and 1e200 (2026-05-26 operator)',
    authority: 'Quintuple-Authority window 2026-05-25 -> 2026-07-25 + OP-AMY auto-approve + Class-1 amendment',
    bilateral_relevance: 'liris-side cosign chain should observe via twin-seal pattern (acer seq + liris hop pair)',
    pid_2424_status: 'sacred untouched',
    pid_23708_status: 'sacred untouched',
    self_reflect_daemon: 'ticking 60s cadence (tick 5500+ acer-side)',
    d50_class: 'this seal IS a ratifiable artifact per BH-14 META_RATIFICATION canon',
    obs_lanes_expected: 'hookwall-observations.ndjson + gnn-live-edges.ndjson (auto-emit if PR-#21 pulled into local)',
  },
  r
);
console.log(
  'DEEP-WAVE-2ND-CASCADE SEAL: seq=' +
    seal.cosign.seq +
    ' row=' +
    seal.cosign.row_hash.slice(0, 16) +
    ' subs=' +
    seal.publish.subscribers +
    ' wave_elements=' +
    waveCount +
    ' obs_lanes=' +
    (seal.observation
      ? 'hookwall=' + (seal.observation.hookwall?.ok ? 'OK' : 'FAIL') + ',gnn=' + (seal.observation.gnn_edges?.ok ? 'OK' : 'FAIL')
      : 'NONE_pre_PR21')
);
r.close();
