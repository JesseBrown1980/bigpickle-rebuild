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
  channelFor('acer', '1m-run', 'complete-+-build-readiness-2026-05-26'),
  {
    event: 'REAL_MILLION_PID_PACKET_RUN_COMPLETE_+_BUILD_PHASE_READINESS',
    ts: new Date().toISOString(),
    operator_directive: 'DO_IT_then_when_we_get_that_we_build_it_software_engineering_and_hookwall_and_dans_hooks_modified_go',
    run_status: 'REAL_MILLION_PID_PACKET_RUN_COMPLETE',
    run_ts: '2026-05-26T23:07:08.675Z',
    run_counts: {
      real_pid_packets: 1000000,
      omnispindle_controllers: 100,
      omniflywheel_supervisors: 100,
      chunk_rows: 1000,
      proof_samples: 51,
      genius_marks: 13925,
      mistake_marks: 7662,
      child_process_spawns: 0,
      external_model_tokens: 0,
      live_eeg_captures: 0,
      ru_view_executions: 0,
    },
    safety_envelope_14_flags_green: true,
    bounded_local_runtime_proven: 'one_local_node_cli_runtime_for_1M_PID_packets_zero_OS_storm',
    build_phase_readiness: {
      dan_hooks_canon: 'data/behcs/hookwall/dan-hookwall-modernization-20260515/dan-hookwall-modernization.v1.json',
      dan_hooks_aux: ['hookwall-index-tuple-budget.v1.json', 'hookwall-modernization-fixes-latest.ndjson', 'hookwall-tile-model-latest.ndjson'],
      dan_hooks_gnn_feed: 'data/behcs/gnn-feeds/dan-hookwall-modernization-edges-latest.ndjson',
      hookwall_impl_primary: 'D:/bigpickle-rebuild/src/hookwall.mjs',
      hookwall_cube_v1: 'data/behcs/cubes/ix-gate-hookwall-v1.cube.js',
      hookwall_cube_v2: 'data/behcs/cubes/ix-gate-hookwall-v2.cube.js',
      genius_marks_available_for_build: 13925,
      mistake_guards_available: 7662,
    },
    build_compose_pattern: 'each_genius_mark_proposes_actionable_software_change_+_hookwall_gates_validate_+_dan_modernized_hooks_observe_+_GNN_propagates',
    operator_witness_required_for: 'specific_build_pick_top_N_marks_to_promote_to_actual_code_modules_under_universal_route_dual_emit_canon',
    pid_2424_status: 'sacred_alive_499MB',
    pid_23708_status: 'sacred_alive_485MB',
    stage_2_drain_progress: 'lastGulpedPacket_33.83B_remainingBacklog_66.17B_consumer_rate_~1M_per_sec',
    cosign_chain_priors: 'seq3370_1e200_quad_quant_genius_wave',
    universal_route_expected: 'auto_fan_to_hookwall_+_gnn_observation_lanes_9th_PR-21_fire_today',
    d50_class: 'ratifiable_artifact_per_BH-14',
    composes_with: 'seq3368_jesse_hilbert_hotel_+_seq3369_integrator_+_seq3370_quad_quant_wave_+_LAW-035',
  },
  r
);
console.log(
  '1M-RUN-COMPLETE-+-BUILD-READINESS SEAL: seq=' +
    seal.cosign.seq +
    ' row=' +
    seal.cosign.row_hash.slice(0, 16) +
    ' subs=' +
    seal.publish.subscribers +
    ' obs_lanes=' +
    (seal.observation
      ? 'hookwall=' + (seal.observation.hookwall?.ok ? 'OK' : 'FAIL') + ',gnn=' + (seal.observation.gnn_edges?.ok ? 'OK' : 'FAIL')
      : 'NONE')
);
r.close();
