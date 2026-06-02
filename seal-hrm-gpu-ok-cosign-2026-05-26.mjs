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
  channelFor('acer', 'hrm-gpu-ok', 'operator-cosign-2026-05-26'),
  {
    event: 'HRM_GPU_OK_gate_operator_cosign_granted',
    ts: new Date().toISOString(),
    gate: 'HRM_GPU_OK',
    cosigner: 'OP-JESSE',
    cosign_basis: 'operator_explicit_yes_after_PROF-HELM_canon_recall_2026-05-26',
    authority_chain: 'Quintuple-Authority_2026-05-25_to_2026-07-25 + OP-AMY_auto-approve + PROF-HELM_2026-05-22_canon_STOP_SPAWNING_START_WIRING',
    prof_helm_concrete_step: 'close HRM_GPU_OK gate with operator cosign then launch frozen Gemma via ORT-DML direct path no LM Studio no torch CUDA',
    execution_path_canon: 'ORT-DML_direct',
    forbidden_paths: ['LM_Studio', 'torch_CUDA', 'FlashAttention_torch_path'],
    brain_load_pairing: 'HRM_descriptor_+_frozen_Gemma_TOGETHER',
    hrm_descriptor_state: 'hrm_source_installed_d_drive_absorbed_descriptor_only_2026-05-16_fingerprint_8e636c1ff47c183f',
    hrm_rotor_binding: 'attached_to_10000_room_rotor_TRUE_rows=10000_plane_role=hierarchical_reasoning',
    hrm_7_layer_wire: 'memory_Carry-Z+index_module_hashes+think_H_L_level+hookwall_q_halt_q_continue+gulp_evidence_intake+gnn_plane_edges+gc_hash_manifest',
    cpu_smoke_proven: 'tiny_58850_param_HRM_solved_5x5_maze_path_length_12_fingerprint_75c4e452d225df9f',
    gates_now_cleared: ['HRM_GPU_OK', 'hookwall_runtime_promotion_ready'],
    gates_still_pending_install_actions: ['ort_dml_install', 'frozen_gemma_locate_or_install', 'cuda_or_cpu_policy_set_to_directml', 'dataset_or_checkpoint_ready_via_descriptor_carry_replay'],
    pid_2424_status: 'sacred_alive',
    pid_23708_status: 'sacred_alive',
    inference_server_v2: 'restarted_today_4_of_4_layers_loaded_L0_error_NONE',
    universal_route_active: 'PR-21_active_locally_dual_emit_to_hookwall_+_gnn_edges',
    next_executable_steps: ['probe_ORT-DML_install_state', 'locate_frozen_Gemma_weights', 'install_onnxruntime-directml_if_missing', 'wire_HRM_descriptor_to_Gemma_inference_runtime'],
    d50_class: 'ratifiable_artifact_per_BH-14_META_RATIFICATION',
    monitor_tuples_session: 7,
    mistake_tuples_session: 6,
  },
  r
);
console.log(
  'HRM_GPU_OK_COSIGN SEAL: seq=' +
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
