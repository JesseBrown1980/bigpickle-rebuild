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
  channelFor('acer', 'path-b', 'wmi-rewrite-2026-05-26'),
  {
    event: 'PATH_B_WMI_REWRITE_COMPLETE',
    ts: new Date().toISOString(),
    operator_directive: 'do_path_B',
    liris_originator: 'relay_with_recommendation_2026-05-26',
    target_file: 'C:/Users/acer/Asolaria/tools/behcs/device-pid-indicator-index.js',
    backup_preserved: 'device-pid-indicator-index.pre-wmi-rewrite-2026-05-26.js',
    rewrite_summary: '17_Get-CimInstance_Win32_*_replaced_with_Get-PnpDevice_+_Get-Disk_+_Get-PhysicalDisk_+_Get-NetAdapter_+_registry_HKLM_reads',
    new_non_cim_commands_count: 30,
    helper_added: '_SafeRows_scriptblock_wrapper_for_try_catch_per_query',
    output_shape_preserved: true,
    backward_compat_with_classify_downstream: true,
    test_run_result: 'indexer_succeeded_2026-05-26T22:19:13Z',
    device_observations_pre: 356,
    device_observations_post: 475,
    index_file_size_pre_bytes: 336398,
    index_file_size_post_bytes: 452725,
    hazard_closed_liris_ethernet_drop: true,
    bilateral_asymmetry_closed: true,
    pid_2424_status: 'sacred_alive_1.20GB',
    pid_23708_status: 'sacred_alive_495MB',
    cosign_chain_priors: 'seq3365_LAW-035+seq3366_30-wave-campaign-close',
    universal_route_expected: 'auto_fan_to_hookwall_+_gnn_observation_lanes_per_PR-21',
    feedback_canon_resolved: 'feedback_avoid_WMI_CIM_probes_on_liris_2026-05-12_class1_ethernet_drop_incident',
    liris_next_action: 'liris_can_now_fire_her_device_indexer_safely_via_same_rewrite_pattern',
    d50_class: 'ratifiable_artifact_per_BH-14_META_RATIFICATION',
  },
  r
);
console.log(
  'PATH-B-WMI-REWRITE SEAL: seq=' +
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
