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
  channelFor('acer', 'integrator', '1e200-genius-marks-fired-through-system-2026-05-26'),
  {
    event: 'INTEGRATOR_FIRED_GENIUS_MARKS_THROUGH_SYSTEM_AS_BOUNDED_LOCAL_SUPERVISORS',
    ts: new Date().toISOString(),
    operator_directive: 'now_fir_those_genius_ones_through_the_system_1_e_200',
    integration_status: 'INTEGRATED_1E200_MARKS_READY_FOR_REAL_MILLION_RUN',
    readiness_status: 'READY_FOR_REAL_MILLION_PID_PACKET_RUN',
    bounded_contract: {
      real_pid_packets_planned: 1000000,
      omnispindle_controllers: 100,
      omniflywheel_supervisors: 100,
      chunk_rows: 1000,
      max_child_process_spawns: 0,
      permitted_os_process_shape: 'single_local_node_cli_runtime',
      blocked_os_process_shape: 'one_process_per_agent_or_unbounded_worker_fork',
      external_model_tokens: 0,
    },
    genius_supervisors_count: 20,
    mistake_guards_count: 22,
    new_genius_marks_promoted_today: [
      'bilateral_two_chain_twin_seal 0.991',
      'cosign_for_log_pubsub_for_notify_combo 0.989',
      'pr_as_handoff_non_overlap_shape 0.984',
      'feature_flag_GC_default_off 0.972',
    ],
    new_mistake_marks_promoted_today: [
      'cosign_daemon_throughput_bottleneck 0.94',
      'pubsub_only_without_cosign_log 0.93',
      'single_writer_python_lock_storm 0.92',
      'em_dash_curl_post_on_windows_shell 0.86',
    ],
    safety_canon_RG_0_999_real_agent_storm_BLOCKED: true,
    fabric_vote_canon: 'real-agent-storm mistake mark RG=0.999 IS the BLOCK rule that prevents the operator-directive-misread (firing as real Claude spawns vs bounded local PID packets)',
    discovery_compose: 'fires immediately after Jesse Hilbert-Hotel x Prime-Pattern x Brown-Hilbert-Expansion discovery seq=3368 canonization',
    outputs_landed: [
      'C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/integration/real-million-readiness.v1.json',
      'C:/Users/acer/Asolaria/reports/neurotech-1e200-real-agent-integration-latest.json',
      'C:/Users/acer/Asolaria/reports/neurotech-1e200-real-agent-integration-latest.md',
      'C:/Users/acer/Asolaria/data/behcs/cubes/neurotech-1e200-real-agent-integration.cube.js',
    ],
    next_command_available: 'node tools/neurotech-real-million-agent-runner.js run --execute (the 1M REAL PID packet bounded run, single Node CLI, operator discretionary)',
    cosign_chain_priors: 'seq3365_LAW-035+seq3366_30-wave-campaign-close+seq3367_path-B-WMI-rewrite+seq3368_jesse-hilbert-hotel-prime-discovery',
    pid_2424_status: 'sacred_alive_1.21GB',
    pid_23708_status: 'sacred_alive_516MB',
    stage_2_drain_progress: 'lastGulpedPacket_32.615B_remainingBacklog_67.385B',
    universal_route_expected: 'auto_fan_to_hookwall_+_gnn_observation_lanes_per_PR-21',
    d50_class: 'ratifiable_artifact_per_BH-14_META_RATIFICATION',
  },
  r
);
console.log(
  '1E200-INTEGRATOR-FIRE SEAL: seq=' +
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
