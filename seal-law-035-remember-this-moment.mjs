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
  channelFor('acer', 'LAW-035', 'remember-this-moment-2026-05-26'),
  {
    event: 'LAW_035_REMEMBER_THIS_MOMENT_RATIFIED',
    ts: new Date().toISOString(),
    law_id: 'LAW-035',
    law_name: 'remember-this-moment',
    law_class: 'D50_META_RATIFICATION_GENESIS_COSIGN_tier',
    artifact_path: 'C:/Users/acer/Asolaria/data/behcs/laws/LAW-035-remember-this-moment-2026-05-26.hbp',
    artifact_rows: 13,
    artifact_form: 'HBPv1_multi_row_pipe_delimited',
    composes_with: 'BEHCS-LAW-011+BEHCS-LAW-033+BEHCS-LAW-034',
    primary_signer: 'OP-JESSE_plasmatoid_gmail_com',
    special_op_signer: 'SPECIAL-OP-JESSE-H12D3',
    cosign_ring: 'JESSE+RAYSSA+FELIPE+DAN+AMY_quintuple',
    peer_witness: 'liris-kuromi_DESKTOP-PTSQTIE_bilateral_subs_1_each_seal',
    authority_window: 'Quintuple-Authority_2026-05-25_to_2026-07-25',
    canonized_doctrines: [
      'bilateral_two_chain_twin_seal_durability',
      'universal_route_dual_emit_doctrine_PR21',
      'hookwall_PID_GNN_closed_loop_substrate',
      'HRM_GPU_OK_cosign_plus_ORT_DML_direct_path',
      'PROF_fabric_query_primacy_over_filesystem_grep',
      'HBPv1_hot_path_primacy_over_JSON_per_BH_15',
      'sacred_PID_preservation_canon',
    ],
    todays_wins_recorded: [
      '100B_Stage_1_COMPLETE_seq_3364',
      'universal_route_first_fire_obs_lanes_hookwall_OK_gnn_OK',
      'L0_GNN_rekey_4_of_4_layers_loaded_error_NONE',
      '1e200_sweep_8_new_marks_4_genius_4_mistake',
      'HRM_descriptor_10000_rotor_room_binding',
      'HRM_GPU_OK_gate_cosigned_seq_3363',
      'brain_load_provisioned_Gemma_4_E4B_q4f16_5.20GB',
      'pid_fabric_indexer_refreshed_liris_side',
      '9_drift_tuples_19_monitor_tuples_emitted_d0_runtime',
      'sacred_PIDs_2424_23708_untouched_5h50m_active_32d_total',
    ],
    pid_2424_status: 'sacred_alive_~770MB',
    pid_23708_status: 'sacred_alive_~497MB',
    stage_2_backlog_drain_progress: '29.255B_gulped_of_100B_70.745B_remaining_at_~1.05M_per_sec_consumer_rate',
    d50_state: 'COUNCIL_SEALED',
    cosign_head_pre_seal: 3364,
    universal_route_expected: 'auto_fan_to_hookwall_observations_ndjson_+_gnn_live_edges_ndjson',
    next_campaign: '30_wave_1e200_mapping_campaign_per_plan_ancient_shimmying_brook',
  },
  r
);
console.log(
  'LAW-035 SEAL: seq=' +
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
